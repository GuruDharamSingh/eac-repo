// Test script to verify Supabase Auth is working
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://localhost:9999';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDMxMTI5NDksImV4cCI6MTkxODY4ODk0OX0.vCiIxe5m9r7dLh3fh8MkV0b_3NwGZHZB2bXrGEaJhs8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('Testing Supabase Auth Connection...\n');

  // Test 1: Sign up a new user
  console.log('1. Testing user signup...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'testpassword123',
    options: {
      data: {
        display_name: 'Test User'
      }
    }
  });

  if (signUpError) {
    console.error('Signup error:', signUpError.message);
  } else {
    console.log('✓ User signed up successfully!');
    console.log('  User ID:', signUpData.user?.id);
    console.log('  Email:', signUpData.user?.email);
  }

  // Test 2: Sign in
  console.log('\n2. Testing user signin...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123'
  });

  if (signInError) {
    console.error('Signin error:', signInError.message);
  } else {
    console.log('✓ User signed in successfully!');
    console.log('  Session:', signInData.session ? 'Created' : 'Not created');
  }

  // Test 3: Get current user
  console.log('\n3. Testing get current user...');
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();

  if (getUserError) {
    console.error('Get user error:', getUserError.message);
  } else if (user) {
    console.log('✓ Current user retrieved!');
    console.log('  User ID:', user.id);
    console.log('  Email:', user.email);
  } else {
    console.log('  No user currently signed in');
  }

  // Test 4: Sign out
  console.log('\n4. Testing signout...');
  const { error: signOutError } = await supabase.auth.signOut();

  if (signOutError) {
    console.error('Signout error:', signOutError.message);
  } else {
    console.log('✓ User signed out successfully!');
  }

  console.log('\n✅ All tests completed!');
  process.exit(0);
}

testAuth().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});