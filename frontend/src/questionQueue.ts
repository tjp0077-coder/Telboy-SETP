import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "./api";

export type QueuedQuestion = {
  id: string;
  name: string;
  email?: string;
  question: string;
  event_id?: string | null;
  event_title?: string | null;
  created_at: string;
};

const QUEUE_KEY = "queue:ask-speaker-questions";

export function isRetryableQuestionError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || "");
  return /Failed to fetch|Network request failed|NetworkError|TypeError|HTTP 5\d\d|500|502|503|504/i.test(message);
}

async function loadQueue(): Promise<QueuedQuestion[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueuedQuestion[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueQuestionSubmission(data: Omit<QueuedQuestion, "id" | "created_at">) {
  const queue = await loadQueue();
  const item: QueuedQuestion = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    created_at: new Date().toISOString(),
  };
  queue.push(item);
  await saveQueue(queue);
  return item;
}

export async function flushQueuedQuestionSubmissions() {
  const queue = await loadQueue();
  if (queue.length === 0) {
    return { sent: 0, remaining: 0 };
  }

  const remaining: QueuedQuestion[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      await api.submitQuestion({
        name: item.name,
        email: item.email,
        question: item.question,
        event_id: item.event_id || null,
      });
      sent += 1;
    } catch (error) {
      if (isRetryableQuestionError(error)) {
        remaining.push(item);
        break;
      }
    }
  }

  const tailStart = sent + remaining.length;
  if (tailStart < queue.length) {
    remaining.push(...queue.slice(tailStart));
  }

  await saveQueue(remaining);
  return { sent, remaining: remaining.length };
}
