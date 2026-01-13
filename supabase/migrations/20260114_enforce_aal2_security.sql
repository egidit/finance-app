-- ================================================================
-- AAL2 SECURITY ENFORCEMENT: Zero Trust Database Layer
-- Run this in Supabase Dashboard → SQL Editor
-- ================================================================

-- ================================================================
-- STEP 1: Create function to check AAL2 level from JWT
-- ================================================================

CREATE OR REPLACE FUNCTION public.check_aal2()
RETURNS BOOLEAN AS $$
BEGIN
  -- Extract AAL claim from JWT and verify it's 'aal2'
  RETURN (current_setting('request.jwt.claims', true)::json->>'aal')::text = 'aal2';
EXCEPTION
  WHEN OTHERS THEN
    -- If JWT claims cannot be read, deny access
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- STEP 2: Secure profiles-bak table (restrict to service role)
-- ================================================================

-- Drop existing user-facing policy
DROP POLICY IF EXISTS "Users can view own profile backup" ON public."profiles-bak";

-- Only service role can access backup table
CREATE POLICY "Only service role can access backup table"
  ON public."profiles-bak"
  FOR ALL
  USING (auth.role() = 'service_role');

-- ================================================================
-- STEP 3: Add AAL2 enforcement to sensitive operations
-- ================================================================

-- EXPENSES: Modifying/deleting expenses requires AAL2
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

CREATE POLICY "Users can update own expenses (AAL2 required)"
  ON public.expenses
  FOR UPDATE
  USING (
    auth.uid() = user_id AND 
    (
      -- Allow AAL2 sessions
      public.check_aal2() OR
      -- OR allow if user has no MFA enrolled (backward compatibility)
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    (
      public.check_aal2() OR
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  );

CREATE POLICY "Users can delete own expenses (AAL2 required)"
  ON public.expenses
  FOR DELETE
  USING (
    auth.uid() = user_id AND 
    (
      public.check_aal2() OR
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  );

-- INCOME: Modifying/deleting income requires AAL2
DROP POLICY IF EXISTS "Users can update own income" ON public.income;
DROP POLICY IF EXISTS "Users can delete own income" ON public.income;

CREATE POLICY "Users can update own income (AAL2 required)"
  ON public.income
  FOR UPDATE
  USING (
    auth.uid() = user_id AND 
    (
      public.check_aal2() OR
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    (
      public.check_aal2() OR
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  );

CREATE POLICY "Users can delete own income (AAL2 required)"
  ON public.income
  FOR DELETE
  USING (
    auth.uid() = user_id AND 
    (
      public.check_aal2() OR
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  );

-- PROFILES: Updating MFA-related fields requires AAL2
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (AAL2 for security)"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id AND 
    (
      -- Allow AAL2 sessions
      public.check_aal2() OR
      -- OR allow if user has no MFA enrolled
      NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors 
        WHERE user_id = auth.uid() AND status = 'verified'
      )
    )
  )
  WITH CHECK (auth.uid() = id);

-- ================================================================
-- STEP 4: Add helper function to check if user has MFA
-- ================================================================

CREATE OR REPLACE FUNCTION public.user_has_mfa(user_id_param uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.mfa_factors 
    WHERE user_id = user_id_param AND status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Check that auth.check_aal2() function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'check_aal2';

-- Check updated policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%(AAL2%'
ORDER BY tablename, policyname;

-- Should show 5 new AAL2-enforcing policies
