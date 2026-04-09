-- Migration to integrate Supabase Auth with existing schema
-- This keeps your existing users table and all foreign key relationships intact

-- Step 1: Add auth_user_id column to link with Supabase Auth
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Step 2: Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- Step 3: Make email nullable temporarily (Supabase handles email validation)
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Step 4: Create a function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, auth_user_id, email, display_name, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger to auto-create user profile when someone signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Create a view for easier querying (joins auth and profile data)
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  u.*,
  au.email as auth_email,
  au.created_at as auth_created_at,
  au.last_sign_in_at,
  au.raw_user_meta_data
FROM public.users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id;

-- Step 7: Create RLS (Row Level Security) policies for the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to view all profiles (you can make this more restrictive)
CREATE POLICY "Profiles are viewable by everyone"
ON public.users FOR SELECT
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Step 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- Step 9: Create helper function to get current user
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_current_user_id() IS 'Gets the public.users.id for the currently authenticated user';