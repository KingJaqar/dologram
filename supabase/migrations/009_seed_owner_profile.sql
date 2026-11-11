-- M1-09: Seed owner profile and initial data
-- Run: supabase migration up

-- Insert the initial owner profile (replace the UUID with the actual supabase auth user ID after signup)
-- This is typically run once after the first user signs up, or via an edge function

-- Note: The actual owner user ID should come from auth.users after onboarding.
-- This migration sets up the structure; the seeded data is added via the onboarding flow.

comment on table public.profiles is 'User profile extension with display name and password change flag';
-- End of migrations;
