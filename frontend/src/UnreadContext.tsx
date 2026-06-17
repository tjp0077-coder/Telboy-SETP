import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api } from "@/src/api";

const KEY = "setp_messages_last_read_at";

type Ctx = {
  unreadCount: number;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

const UnreadCtx = createContext<Ctx | null>(null);

export const UnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadAtRef = useRef<string>("");

  const refresh = useCallback(async () => {
    try {
      const lastRead = lastReadAtRef.current;
      const feed = await api.listFeed();
      // First-ever launch: treat all existing items as already seen so the user
      // doesn't see a dot from the seeded welcome message right after install.
      if (!lastRead) {
        const newest = feed[0]?.created_at || new Date().toISOString();
        lastReadAtRef.current = newest;
        await AsyncStorage.setItem(KEY, newest);
        setUnreadCount(0);
        return;
      }
      const count = feed.filter((f) => (f.created_at || "") > lastRead).length;
      setUnreadCount(count);
    } catch {
      // network failure — keep previous count
    }
  }, []);

  // Bootstrap from storage + initial fetch
  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem(KEY)) || "";
      lastReadAtRef.current = stored;
      refresh();
    })();
  }, [refresh]);

  // Poll every 30s + on app foreground
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    lastReadAtRef.current = now;
    await AsyncStorage.setItem(KEY, now);
    setUnreadCount(0);
  }, []);

  return (
    <UnreadCtx.Provider value={{ unreadCount, markAllRead, refresh }}>
      {children}
    </UnreadCtx.Provider>
  );
};

export function useUnread(): Ctx {
  const c = useContext(UnreadCtx);
  if (!c) throw new Error("useUnread must be inside UnreadProvider");
  return c;
}
