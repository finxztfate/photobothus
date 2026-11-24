import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearAuth, getStoredUser, getToken, isNetworkError, setAuth } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(!!getToken());
  const [apiUnreachable, setApiUnreachable] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest('/api/auth/me');
        if (!cancelled) {
          setUser(data.user);
          setAuth(token, data.user);
          setApiUnreachable(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (isNetworkError(err)) {
            setApiUnreachable(true);
          } else {
            clearAuth();
            setUser(null);
            setApiUnreachable(false);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (credential, mode = 'login') => {
    const data = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: { credential, mode },
    });
    setAuth(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async () => {
    throw new Error('Email signup is disabled. Please sign up with Google.');
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  // Swaps in a new token for the signed-in user, e.g. after a password change.
  const replaceSession = useCallback((token, changes = {}) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...changes };
      setAuth(token, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      apiUnreachable,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isCustomer: user?.role === 'customer',
      login,
      loginWithGoogle,
      register,
      logout,
      replaceSession,
    }),
    [user, loading, apiUnreachable, login, loginWithGoogle, register, logout, replaceSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
