/**
 * useAuth Hook - Gestión de autenticación
 */

import { useState, useCallback } from 'react';
import type { User } from '../types';
import { storageService } from '../services/storage/localStorage';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => storageService.getUser());
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback((userData: User) => {
    try {
      storageService.setUser(userData);
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }, []);

  const logout = useCallback(() => {
    storageService.clearUser();
    storageService.clearStravaToken();
    setUser(null);
    setError(null);
  }, []);

  const isAuthenticated = !!user;

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
  };
};
