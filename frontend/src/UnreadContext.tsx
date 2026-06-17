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
  // Cache of the most recently fetched feed so markAllRead can anchor to
  // a SERVER timestamp (avoids client-vs-server clock skew issues).
  const newestSeenRef = useRef<string>("");

  const refresh = useCallback(async () => {
    try {
      const lastRead = lastReadAtRef.current;
      const feed = await api.listFeed();
      const newest = feed[0]?.created_at || "";
      newestSeenRef.current = newest;
      // First-ever launch: treat all existing items as already seen so the user
      // doesn't see a dot from the seeded welcome message right after install.
      if (!lastRead) {
        const initial = newest || new Date().toISOString();
        lastReadAtRef.current = initial;
        await AsyncStorage.setItem(KEY, initial);
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

  // Anchor "read up to" to the SERVER's newest known timestamp (not client time)
  // to avoid clock-skew bugs where a freshly-posted message has an earlier
  // server timestamp than the client's local clock.
  const markAllRead = useCallback(async () => {
    let anchor = newestSeenRef.current;
    if (!anchor) {
      // No cache yet — fetch once so we have a server-side anchor.
      try {
        const feed = await api.listFeed();
        anchor = feed[0]?.created_at || "";
        newestSeenRef.current = anchor;
      } catch {
        // fall back to client time if offline
      }
    }
    if (!anchor) anchor = new Date().toISOString();
    lastReadAtRef.current = anchor;
    await AsyncStorage.setItem(KEY, anchor);
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
