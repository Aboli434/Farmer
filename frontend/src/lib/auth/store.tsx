'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@/types/auth';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch (_) {
      // Ignore logout errors
    }
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await apiClient<{ success: boolean; data: { user: User } }>('/auth/me');
      setState({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to authenticate user', error);
      // Don't call logout which hits API, just clear state to avoid loop
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    // We always attempt to refresh the user on mount because we rely on HttpOnly cookie
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  const login = (user: User) => {
    setState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
