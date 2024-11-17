'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User, AuthError, SignupResponse } from '@/lib/types';

type AuthContextType = {
  user: (User & { role?: string }) | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string) => Promise<SignupResponse>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  signup: async () => ({ user: null, error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setUser(data.user);
    router.refresh();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  const signup = async (email: string, password: string): Promise<SignupResponse> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: 'user'
          }
        }
      });

      if (error) {
        return {
          user: null,
          error: {
            message: error.message,
            status: error.status || 500,
            code: error.code
          }
        };
      }

      if (data.user && !data.user.confirmed_at) {
        return {
          user: data.user,
          error: null,
          needsEmailConfirmation: true
        };
      }

      return {
        user: data.user,
        error: null
      };
    } catch (err: any) {
      return {
        user: null,
        error: {
          message: err.message || 'An unexpected error occurred',
          status: err.status || 500
        }
      };
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // メタデータからロールを取得
          const role = session.user.user_metadata?.role;
          setUser({ ...session.user, role });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // メタデータからロールを取得
          const role = session.user.user_metadata?.role;
          setUser({ ...session.user, role });
        } else {
          setUser(null);
        }
        setLoading(false);
        router.refresh();
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};