-- ================================================================
-- CRITICAL SECURITY FIX: Enable Row Level Security
-- Run this immediately in Supabase Dashboard → SQL Editor
-- ================================================================

-- ================================================================
-- STEP 1: Enable RLS on all tables
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

-- Drop backup table if not needed (it's exposed!)
-- Uncomment if you don't need it:
-- DROP TABLE IF EXISTS public."profiles-bak";

-- Or secure it if you need it:
ALTER TABLE public."profiles-bak" ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 2: Create RLS Policies for PROFILES table
-- ================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users cannot delete their profile (optional - remove if you want deletion)
-- If you want deletion, add: FOR DELETE USING (auth.uid() = id)

-- ================================================================
-- STEP 3: Create RLS Policies for EXPENSES table
-- ================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

-- Users can only view their own expenses
CREATE POLICY "Users can view own expenses"
  ON public.expenses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create expenses for themselves only
CREATE POLICY "Users can create own expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own expenses
CREATE POLICY "Users can update own expenses"
  ON public.expenses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own expenses
CREATE POLICY "Users can delete own expenses"
  ON public.expenses
  FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- STEP 4: Create RLS Policies for INCOME table
-- ================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own income" ON public.income;
DROP POLICY IF EXISTS "Users can create own income" ON public.income;
DROP POLICY IF EXISTS "Users can update own income" ON public.income;
DROP POLICY IF EXISTS "Users can delete own income" ON public.income;

-- Users can only view their own income
CREATE POLICY "Users can view own income"
  ON public.income
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create income records for themselves only
CREATE POLICY "Users can create own income"
  ON public.income
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own income
CREATE POLICY "Users can update own income"
  ON public.income
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own income
CREATE POLICY "Users can delete own income"
  ON public.income
  FOR DELETE
  USING (auth.uid() = user_id);

-- ================================================================
-- STEP 5: Secure backup table (if you're keeping it)
-- ================================================================

DROP POLICY IF EXISTS "Users can view own profile backup" ON public."profiles-bak";

CREATE POLICY "Users can view own profile backup"
  ON public."profiles-bak"
  FOR SELECT
  USING (auth.uid() = id);

-- ================================================================
-- STEP 6: Add MFA tracking columns to profiles table
-- (For the 24-hour cooling period enforcement)
-- ================================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS last_mfa_change TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_factors_count INTEGER DEFAULT 0;

-- ================================================================
-- STEP 7: Create trigger to enforce 24-hour cooling period
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_mfa_cooling_period ON public.profiles;

-- ================================================================

CREATE OR REPLACE FUNCTION check_mfa_cooling_period()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when going from 1+ factors to 0 factors (disabling last MFA)
  IF OLD.mfa_factors_count > 0 AND NEW.mfa_factors_count = 0 THEN
    -- Check if last change was within 24 hours
    IF OLD.last_mfa_change IS NOT NULL AND 
       EXTRACT(EPOCH FROM (NOW() - OLD.last_mfa_change)) < 86400 THEN
      RAISE EXCEPTION 'Cannot disable last MFA factor within 24 hours of last change. Please wait % more hours.', 
        CEIL((86400 - EXTRACT(EPOCH FROM (NOW() - OLD.last_mfa_change))) / 3600);
    END IF;
  END IF;
  
  -- Update timestamp whenever MFA factor count changes
  IF OLD.mfa_factors_count != NEW.mfa_factors_count THEN
    NEW.last_mfa_change = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_mfa_cooling_period
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_mfa_cooling_period();

-- ================================================================
-- STEP 8: Add audit logging table for security events
-- ================================================================

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL, -- 'mfa_disabled', 'password_changed', 'login_aal2', etc.
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.security_audit_log;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.security_audit_log;

-- Enable RLS on audit log (users can only see their own logs)
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON public.security_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert audit logs (Edge Functions)
CREATE POLICY "Service role can insert audit logs"
  ON public.security_audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- VERIFICATION QUERIES (Run these to test)
-- ================================================================

-- Check RLS is enabled on all tables:
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'expenses', 'income', 'profiles-bak')
ORDER BY tablename;

-- Should show rowsecurity = true for all tables

-- Check policies exist:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Should show multiple policies for each table
