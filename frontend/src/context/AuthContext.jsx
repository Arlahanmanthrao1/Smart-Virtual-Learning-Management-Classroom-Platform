import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch, login as loginRequest } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (reportError = false) => {
    const token = localStorage.getItem("lms_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch("/auth/me");
      setUser(me);
    } catch (error) {
      // Token expired or invalid - clear it so the login page shows again.
      localStorage.removeItem("lms_token");
      setUser(null);
      if (reportError) throw error;
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
    await loadUser(true);
  };

  const loginWithGoogle = async (credential, nonce) => {
    const { access_token } = await apiFetch("/auth/google", { method: "POST", body: JSON.stringify({ credential, nonce }) });
    localStorage.setItem("lms_token", access_token);
    await loadUser(true);
  };

  const logout = () => {
    window.google?.accounts?.id?.disableAutoSelect();
    localStorage.removeItem("lms_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
