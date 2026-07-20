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
  coachTime?: string | null;
  transportDetails?: string | null;
  maps_url?: string | null;
  speakerId?: string | null;
  speakerBios?: SessionSpeakerBio[];
  title: string;
  location: string;
  description?: string;
  category: string;
};

export type SessionSpeakerBio = {
  id: string;
  paperTitle: string;
  name: string;
  title: string;
  company: string;
  bioText: string;
  imageUrl: string;
};

export type SpeakerItem = {
  id: string;
  name: string;
  title: string;
  company: string;
  bioText: string;
  imageUrl: string;
};

export type MessageItem = {
  id: string;
  text: string;
  title?: string;
  priority: "info" | "important" | "urgent";
  author: string;
  created_at: string;
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type EventNote = {
  id: string;
  event_id: string;
  text: string;
  author: string;
  created_at: string;
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type AdminInfo = { username: string; name: string; role: string };

// Aggregated comms feed item (global messages + event notes)
export type FeedItem = {
  kind: "announcement" | "event_note";
  id: string;
  text: string;
  title?: string;
  priority?: "info" | "important" | "urgent" | null;
  author?: string;
  created_at: string;
  event_id?: string | null;
  event_title?: string | null;
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

// Contact form submission (admin inbox)
export type ContactThreadMessage = {
  id: string;
  sender_role: "delegate" | "admin" | string;
  sender_name: string;
  sender_email?: string | null;
  subject?: string | null;
  message: string;
  created_at: string;
};

export type ContactItem = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  updated_at: string;
  read: boolean;
  event_id?: string | null;
  event_title?: string | null;
  messages: ContactThreadMessage[];
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type PrototypeIdea = {
  id: string;
  title: string;
  summary: string;
  proposed_screen?: string;
  mock_link?: string;
  status: "draft" | "published";
  created_by: string;
  created_at: string;
  published_at?: string | null;
  published_by?: string | null;
};

export type QuestionItem = {
  id: string;
  name: string;
  email?: string | null;
  question: string;
  created_at: string;
  updated_at: string;
  reviewed: boolean;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  event_id?: string | null;
  event_title?: string | null;
  deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type CommitteeBioItem = {
  id: string;
  name: string;
  bio: string;
  updated_at?: string | null;
  updated_by?: string | null;
};

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

  // speakers
  listSpeakers: () => cachedGet<SpeakerItem[]>("/speakers", "cache:speakers"),
  getSpeaker: (id: string) => request<SpeakerItem>(`/speakers/${id}`),
  updateSpeaker: (id: string, data: Partial<SpeakerItem>) =>
    request<SpeakerItem>(`/speakers/${id}`, { method: "PUT", body: JSON.stringify(data) }, true),

  // per-event notes
  listEventNotes: (id: string) =>
    request<EventNote[]>(`/schedule/${id}/notes`),
  createEventNote: (id: string, text: string) =>
    request<EventNote>(`/schedule/${id}/notes`, {
      method: "POST", body: JSON.stringify({ text }),
    }, true),
  deleteEventNote: (id: string, noteId: string) =>
    request<{ deleted: boolean }>(`/schedule/${id}/notes/${noteId}`, { method: "DELETE" }, true),
  restoreEventNote: (id: string, noteId: string) =>
    request<{ ok: boolean }>(`/schedule/${id}/notes/${noteId}/restore`, { method: "POST" }, true),
  permanentDeleteEventNote: (id: string, noteId: string) =>
    request<{ deleted: boolean }>(`/schedule/${id}/notes/${noteId}/permanent`, { method: "DELETE" }, true),

  // messages
  listMessages: () => cachedGet<MessageItem[]>("/messages", "cache:messages"),
  listFeed: () => cachedGet<FeedItem[]>("/feed", "cache:feed"),
  listDeletedFeed: () => request<FeedItem[]>("/feed/deleted", {}, true),
  createMessage: (data: { text: string; title?: string; priority?: string }) =>
    request<MessageItem>("/messages", { method: "POST", body: JSON.stringify(data) }, true),
  deleteMessage: (id: string) =>
    request<{ deleted: boolean }>(`/messages/${id}`, { method: "DELETE" }, true),
  restoreMessage: (id: string) =>
    request<{ ok: boolean }>(`/messages/${id}/restore`, { method: "POST" }, true),
  permanentDeleteMessage: (id: string) =>
    request<{ deleted: boolean }>(`/messages/${id}/permanent`, { method: "DELETE" }, true),

  // prototype lab
  listPrototypeIdeas: () => cachedGet<PrototypeIdea[]>("/prototype-ideas", "cache:prototypeideas"),
  listAdminPrototypeIdeas: () => request<PrototypeIdea[]>("/admin/prototype-ideas", {}, true),
  createPrototypeIdea: (data: { title: string; summary: string; proposed_screen?: string; mock_link?: string }) =>
    request<PrototypeIdea>("/admin/prototype-ideas", { method: "POST", body: JSON.stringify(data) }, true),
  publishPrototypeIdea: (id: string) =>
    request<PrototypeIdea>(`/admin/prototype-ideas/${id}/publish`, { method: "PATCH" }, true),
  deletePrototypeIdea: (id: string) =>
    request<{ deleted: boolean }>(`/admin/prototype-ideas/${id}`, { method: "DELETE" }, true),

  // contact
  submitContact: (data: { name: string; email?: string; subject: string; message: string; event_id?: string | null }) =>
    request<{ id: string; ok: boolean }>("/contact", {
      method: "POST", body: JSON.stringify(data),
    }),
  listContact: () => request<ContactItem[]>("/contact", {}, true),
  listDeletedContact: () => request<ContactItem[]>("/contact/deleted", {}, true),
  markContactRead: (id: string) =>
    request<{ ok: boolean }>(`/contact/${id}/read`, { method: "PATCH" }, true),
  replyContact: (id: string, data: { message: string; subject?: string }) =>
    request<{ ok: boolean; message: ContactThreadMessage }>(`/contact/${id}/reply`, {
      method: "POST", body: JSON.stringify(data),
    }, true),
  deleteContact: (id: string) =>
    request<{ deleted: boolean }>(`/contact/${id}`, { method: "DELETE" }, true),
  restoreContact: (id: string) =>
    request<{ ok: boolean }>(`/contact/${id}/restore`, { method: "POST" }, true),
  permanentDeleteContact: (id: string) =>
    request<{ deleted: boolean }>(`/contact/${id}/permanent`, { method: "DELETE" }, true),

  // speaker questions
  submitQuestion: (data: { name: string; email?: string; question: string; event_id?: string | null }) =>
    request<{ id: string; ok: boolean }>("/questions", {
      method: "POST", body: JSON.stringify(data),
    }),
  listQuestions: () => request<QuestionItem[]>("/questions", {}, true),
  listDeletedQuestions: () => request<QuestionItem[]>("/questions/deleted", {}, true),
  markQuestionReviewed: (id: string) =>
    request<{ ok: boolean }>(`/questions/${id}/review`, { method: "PATCH" }, true),
  deleteQuestion: (id: string) =>
    request<{ deleted: boolean }>(`/questions/${id}`, { method: "DELETE" }, true),
  restoreQuestion: (id: string) =>
    request<{ ok: boolean }>(`/questions/${id}/restore`, { method: "POST" }, true),
  permanentDeleteQuestion: (id: string) =>
    request<{ deleted: boolean }>(`/questions/${id}/permanent`, { method: "DELETE" }, true),

  // committee bios
  listCommitteeBios: () => request<CommitteeBioItem[]>("/committee-bios"),
  updateCommitteeBio: (id: string, data: { name?: string; bio?: string }) =>
    request<CommitteeBioItem>(`/committee-bios/${id}`, { method: "PUT", body: JSON.stringify(data) }, true),

  // admins (committee management)
  listAdmins: () => request<AdminInfo[]>("/admins", {}, true),
  createAdmin: (data: { username: string; name: string; password: string }) =>
    request<AdminInfo>("/admins", { method: "POST", body: JSON.stringify(data) }, true),
  deleteAdmin: (username: string) =>
    request<{ deleted: boolean }>(`/admins/${username}`, { method: "DELETE" }, true),

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
