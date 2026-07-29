import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch, login as loginRequest } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("lms_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch("/auth/me");
      setUser(me);
    } catch {
      // Token expired or invalid - clear it so the login page shows again.
      localStorage.removeItem("lms_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const { access_token } = await loginRequest(email, password);
    localStorage.setItem("lms_token", access_token);
    await loadUser();
  };

  const logout = () => {
    localStorage.removeItem("lms_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}