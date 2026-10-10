import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, LoginRequest, RegisterRequest, authApi } from "../../lib/api/auth";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me);
    } catch {
      // If access token fails, try refreshing
      try {
        const refreshed = await authApi.refreshToken();
        if (refreshed) {
          const me = await authApi.getMe();
          setUser(me);
          return;
        }
      } catch {
        // ignore
      }
      setUser(null);
      authApi.setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      if (authApi.getAccessToken()) {
        await refreshUser();
      } else {
        // Check if there is an active session via refresh cookie
        try {
          const refreshed = await authApi.refreshToken();
          if (refreshed) {
            setUser(refreshed.user);
          }
        } catch {
          // not logged in
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  const login = async (credentials: LoginRequest) => {
    const res = await authApi.login(credentials);
    setUser(res.user);
  };

  const register = async (data: RegisterRequest) => {
    const res = await authApi.register(data);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
