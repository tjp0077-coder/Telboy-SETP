import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const KEY = "setp_favorites";

type Ctx = {
  favorites: Set<string>;
  toggle: (id: string) => void;
  ready: boolean;
};

const FavoritesCtx = createContext<Ctx | null>(null);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        try { setFavorites(new Set(JSON.parse(raw))); } catch {}
      }
      setReady(true);
    })();
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      AsyncStorage.setItem(KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  return (
    <FavoritesCtx.Provider value={{ favorites, toggle, ready }}>
      {children}
    </FavoritesCtx.Provider>
  );
};

export function useFavorites(): Ctx {
  const c = useContext(FavoritesCtx);
  if (!c) throw new Error("useFavorites must be used inside FavoritesProvider");
  return c;
}
