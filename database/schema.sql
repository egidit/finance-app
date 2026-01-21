-- ============================================================================
-- Subscription Tracker Database Schema
-- ============================================================================
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- Subscriptions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic subscription info
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  
  -- Lifecycle constraint: must have one of these
  total_payments INTEGER CHECK (total_payments IS NULL OR total_payments > 0),
  explicit_end_date DATE,
  
  -- Additional info
  category VARCHAR(50),
  website VARCHAR(500),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Enforce lifecycle constraint: must have total_payments OR explicit_end_date
  CONSTRAINT lifecycle_constraint CHECK (
    (total_payments IS NOT NULL AND explicit_end_date IS NULL) OR
    (total_payments IS NULL AND explicit_end_date IS NOT NULL)
  )
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_start_date ON subscriptions(start_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Sample Data (Optional)
-- ============================================================================
-- Uncomment to insert sample data for testing
-- Note: Replace 'your-user-id' with an actual auth.uid()
/*
INSERT INTO subscriptions (user_id, name, amount, currency, billing_cycle, start_date, total_payments, category) VALUES
  ('your-user-id', 'Netflix', 15.99, 'USD', 'monthly', '2024-01-01', 12, 'entertainment'),
  ('your-user-id', 'Spotify', 9.99, 'USD', 'monthly', '2024-01-15', 12, 'entertainment'),
  ('your-user-id', 'Adobe Creative Cloud', 54.99, 'USD', 'monthly', '2024-02-01', 24, 'productivity'),
  ('your-user-id', 'Gym Membership', 29.99, 'USD', 'monthly', '2024-01-01', 12, 'health');
*/
