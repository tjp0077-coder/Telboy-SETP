import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "setp_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        try {
          setFavorites(new Set(JSON.parse(raw)));
        } catch {}
      }
      setReady(true);
    })();
  }, []);

  const toggle = useCallback(async (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  return { favorites, toggle, ready };
}
