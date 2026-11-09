import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('lumie_token'));
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await authService.getProfile();
      setUser(data);
    } catch {
      // Token invalid or expired
      localStorage.removeItem('lumie_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = (userData, authToken) => {
    localStorage.setItem('lumie_token', authToken);
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('lumie_token');
    setToken(null);
    setUser(null);
  };

  const isManager = () => user?.role === 'MANAGER';
  const isStaff = () => user?.role === 'STAFF';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isManager, isStaff, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
