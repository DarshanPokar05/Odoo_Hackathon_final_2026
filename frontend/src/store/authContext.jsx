import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

/** Decode a JWT payload without verifying the signature (client-side only). */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem('df360_token'));

  const user = token ? decodeToken(token) : null;

  const setToken = useCallback((t) => {
    if (t) { localStorage.setItem('df360_token', t); }
    else    { localStorage.removeItem('df360_token'); }
    setTokenState(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('df360_token');
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
