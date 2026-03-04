-- Phase 2: Password Reset - Simplified Schema
-- Created: March 5, 2026
-- Note: Phase 2 now uses Supabase's built-in password reset
-- No custom tokens needed - more secure!

-- Add password reset tracking to user_profiles
-- This column tracks when user last reset password
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS 
    last_password_reset_at TIMESTAMP NULL;

-- Optional: Create tables for audit logging if needed
-- These are optional - Supabase logs password changes automatically

CREATE TABLE IF NOT EXISTS password_reset_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    INDEX idx_user_id (user_id),
    INDEX idx_reset_at (reset_at)
);

-- Set Row Level Security (RLS)
ALTER TABLE password_reset_audit ENABLE ROW LEVEL SECURITY;

-- Optional: Add policy for audit logs
CREATE POLICY "Only users can view their own reset history" ON password_reset_audit
    FOR SELECT
    USING (user_id = auth.uid());

