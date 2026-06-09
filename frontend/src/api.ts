import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "setp_admin_token";

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function deleteToken() {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export const tokenStore = { saveToken, getToken, deleteToken };

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (withAuth) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Cached read helpers (offline support) ---
async function cachedGet<T>(path: string, cacheKey: string): Promise<T> {
  try {
    const data = await request<T>(path);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (e) {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as T;
    throw e;
  }
}

export type SessionItem = {
  id: string;
  date: string;
  day_label: string;
  time: string;
  end_time?: string | null;
  title: string;
  location: string;
  description?: string;
  category: string;
};

export type MessageItem = {
  id: string;
  text: string;
  title?: string;
  priority: "info" | "important" | "urgent";
  author: string;
  created_at: string;
};

export type EventNote = {
  id: string;
  event_id: string;
  text: string;
  author: string;
  created_at: string;
};

export type AdminInfo = { username: string; name: string; role: string };

export const api = {
  // schedule
  listSchedule: () => cachedGet<SessionItem[]>("/schedule", "cache:schedule"),
  getSession: (id: string) => request<SessionItem>(`/schedule/${id}`),
  createSession: (data: Partial<SessionItem>) =>
    request<SessionItem>("/schedule", { method: "POST", body: JSON.stringify(data) }, true),
  updateSession: (id: string, data: Partial<SessionItem>) =>
    request<SessionItem>(`/schedule/${id}`, { method: "PUT", body: JSON.stringify(data) }, true),
  deleteSession: (id: string) =>
    request<{ deleted: boolean }>(`/schedule/${id}`, { method: "DELETE" }, true),

  // per-event notes
  listEventNotes: (id: string) =>
    request<EventNote[]>(`/schedule/${id}/notes`),
  createEventNote: (id: string, text: string) =>
    request<EventNote>(`/schedule/${id}/notes`, {
      method: "POST", body: JSON.stringify({ text }),
    }, true),
  deleteEventNote: (id: string, noteId: string) =>
    request<{ deleted: boolean }>(`/schedule/${id}/notes/${noteId}`, { method: "DELETE" }, true),

  // messages
  listMessages: () => cachedGet<MessageItem[]>("/messages", "cache:messages"),
  listFeed: () => cachedGet<FeedItem[]>("/feed", "cache:feed"),
  createMessage: (data: { text: string; title?: string; priority?: string }) =>
    request<MessageItem>("/messages", { method: "POST", body: JSON.stringify(data) }, true),
  deleteMessage: (id: string) =>
    request<{ deleted: boolean }>(`/messages/${id}`, { method: "DELETE" }, true),

  // contact
  submitContact: (data: { name: string; email?: string; subject: string; message: string; event_id?: string | null }) =>
    request<{ id: string; ok: boolean }>("/contact", {
      method: "POST", body: JSON.stringify(data),
    }),
  listContact: () => request<ContactItem[]>("/contact", {}, true),
  markContactRead: (id: string) =>
    request<{ ok: boolean }>(`/contact/${id}/read`, { method: "PATCH" }, true),
  deleteContact: (id: string) =>
    request<{ deleted: boolean }>(`/contact/${id}`, { method: "DELETE" }, true),

  // auth
  login: (username: string, password: string) =>
    request<{ access_token: string; username: string; name: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<AdminInfo>("/auth/me", {}, true),

  // city guide
  cityGuide: () => cachedGet<any>("/city-guide", "cache:cityguide"),
};
