// Direct GoTrue (Supabase Auth) client
// This bypasses the need for the full Supabase stack

const AUTH_URL =
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://localhost:9999';

interface AuthResponse {
  user?: any;
  session?: any;
  error?: string;
}

class AuthClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  async signUp(email: string, password: string, metadata?: any): Promise<AuthResponse> {
    try {
      const response = await fetch(`${AUTH_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          data: metadata,
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        this.token = data.access_token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.access_token);
        }
      }

      return { user: data.user, session: data, error: data.error };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${AUTH_URL}/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        this.token = data.access_token;
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.access_token);
        }
      }

      return { user: data.user, session: data, error: data.error };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  async signOut(): Promise<void> {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  async getUser(): Promise<AuthResponse> {
    if (!this.token) {
      return { error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${AUTH_URL}/user`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      const data = await response.json();
      return { user: data, error: data.error };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  getToken(): string | null {
    return this.token;
  }
}

export const authClient = new AuthClient();
