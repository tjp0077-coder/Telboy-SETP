import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore } from "./api";

type AuthState = {
  username: string | null;
  name: string | null;
  loading: boolean;
};

type AuthCtx = {
  auth: AuthState;
  login: (u: string, p: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({ username: null, name: null, loading: true });

  useEffect(() => {
    (async () => {
      const t = await tokenStore.getToken();
      if (!t) {
        setAuth({ username: null, name: null, loading: false });
        return;
      }
      try {
        const me = await api.me();
        setAuth({ username: me.username, name: me.name, loading: false });
      } catch {
        await tokenStore.deleteToken();
        setAuth({ username: null, name: null, loading: false });
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await api.login(username, password);
      await tokenStore.saveToken(res.access_token);
      setAuth({ username: res.username, name: res.name, loading: false });
      return { ok: true };
    } catch (e: any) {
      const msg = String(e?.message || "");
      let error = "Invalid username or password";
      if (/Invalid credentials|401|Unauthorized/i.test(msg)) {
        error = "Invalid username or password";
      } else if (msg === "" || /Failed to fetch|Network request failed|NetworkError|TypeError/i.test(msg)) {
        error = "Cannot reach the server. Check your connection and try again.";
      } else if (/500|Internal Server Error|502|503|504/i.test(msg)) {
        error = "Server error. Please try again shortly.";
      }
      return { ok: false, error };
    }
  }, []);

  const logout = useCallback(async () => {
    await tokenStore.deleteToken();
    setAuth({ username: null, name: null, loading: false });
  }, []);

  return <Ctx.Provider value={{ auth, login, logout }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
