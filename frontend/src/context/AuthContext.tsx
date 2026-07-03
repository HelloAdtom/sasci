import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getUser, clearAuth, getToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  logout: () => void;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, logout: () => {}, setUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getUser());

  useEffect(() => {
    if (!getToken()) setUser(null);
  }, []);

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
