import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, SessionItem, EventNote } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { useFavorites } from "@/src/useFavorites";
import { colors, spacing, radius, shadow } from "@/src/theme";

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  session: "document-text",
  break: "cafe",
  meal: "restaurant",
  social: "wine",
  tour: "bus",
};
const CATEGORY_COLOR: Record<string, string> = {
  session: colors.brand,
  break: colors.warning,
  meal: colors.warning,
  social: colors.brandTertiary,
  tour: colors.success,
};
const CATEGORY_LABEL: Record<string, string> = {
  session: "Technical",
  break: "Break",
  meal: "Meal",
  social: "Social",
  tour: "Tour",
};

const CATEGORIES = ["session", "break", "meal", "social", "tour"];

const buildMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const snapshotForStaleCheck = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value;
  if (typeof Blob !== "undefined" && value instanceof Blob) return null;
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) return null;
  if (Array.isArray(value)) return value.map((item) => snapshotForStaleCheck(item));

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      const next = snapshotForStaleCheck(obj[key]);
      if (next !== undefined) out[key] = next;
    });
  return out;
};

const stableJsonSnapshot = (value: unknown) => JSON.stringify(snapshotForStaleCheck(value));

const isTechnicalTalk = (event: SessionItem | null) =>
  !!event && event.category === "session" && /technical session|paper/i.test(`${event.title} ${event.description || ""}`);

const isRegistrationReceptionEvent = (event: SessionItem | null) => {
  if (!event) return false;
  return /registration\s*&\s*welcome reception|reception\s*&\s*welcome reception/i.test(event.title || "");
};

const isRosslynKelpiesPartnersTourEvent = (event: SessionItem | null) => {
  if (!event) return false;
  const title = (event.title || "").toLowerCase();
  return title.includes("partner's tour") && /rosslyn chapel|the kelpies/.test(title);
};

const isPartnersWalkingTourEvent = (event: SessionItem | null) => {
  if (!event) return false;
  const title = (event.title || "").toLowerCase();
  return title.includes("partner") && title.includes("walking") && title.includes("tour");
};

const isTechnicalBoatTourEvent = (event: SessionItem | null) => {
  if (!event) return false;
  const title = (event.title || "").toLowerCase();
  return title.includes("technical") && title.includes("boat") && title.includes("tour");
};

const PARTNERS_TOUR_ROUTE_URL = "https://maps.app.goo.gl/1M2J8i5YVtxDkWVFA";
const WALKING_TOUR_MAP_URL = "https://maps.app.goo.gl/i7NvbVqTaMmrNzNT8";
const TECHNICAL_BOAT_TOUR_MAP_URL = "https://maps.app.goo.gl/5aXPtbcsrDGBNDmp9";
const TECHNICAL_BOAT_TOUR_SECONDARY_MAP_URL = "https://maps.app.goo.gl/xvL7zdpkp96tu4gV6";
const LANDING_FEE_LINK = "https://pay.collctiv.com/inchcolm-island-landing-fee-74966";

const isPartnersTourEvent = (event: SessionItem | null): boolean => {
  if (!event) return false;
  const title = (event.title || "").toLowerCase();
  const desc = (event.description || "").toLowerCase();
  const location = (event.location || "").toLowerCase();
  const looksLikePartnersTour = title.includes("partner") && title.includes("tour");
  const mentionsStops = /rosslyn|kelpies|linlithgow/.test(desc);
  const departsHotel = location.includes("departs") && location.includes("courtyard");
  return looksLikePartnersTour || mentionsStops || departsHotel;
};

const isTasteOfScotlandEvent = (event: SessionItem | null): boolean => {
  if (!event) return false;
  return event.date === "2026-07-27" && /taste of scotland social/i.test(event.title || "");
};

const isRoyalYachtReceptionEvent = (event: SessionItem | null): boolean => {
  if (!event) return false;
  return event.date === "2026-07-28" && /royal yacht britannia(?:\s+networking)?\s+reception/i.test(event.title || "");
};

const isSymposiumBanquetEvent = (event: SessionItem | null): boolean => {
  if (!event) return false;
  return event.date === "2026-07-29" && /symposium banquet/i.test(event.title || "");
};

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const { favorites, toggle } = useFavorites();
  const isAdmin = !!auth.username;
  const fav = id ? favorites.has(id) : false;

  const [event, setEvent] = useState<SessionItem | null>(null);
  const [varOriginalRecord, setVarOriginalRecord] = useState<SessionItem | null>(null);
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<SessionItem>>({});
  const [saving, setSaving] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [e, n] = await Promise.all([
        api.getSession(id),
        api.listEventNotes(id).catch(() => []),
      ]);
      setEvent(e);
      setVarOriginalRecord(e);
      setNotes(n);
    } catch (err) {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    if (!event) return;
    setDraft({
      title: event.title,
      location: event.location,
      time: event.time,
      end_time: event.end_time || "",
      description: event.description || "",
      category: event.category,
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraft({}); };

  const saveEdit = async () => {
    if (!id || !event) return;
    setSaving(true);
    try {
      const latest = await api.getSession(id);
      const originalSnapshot = stableJsonSnapshot(varOriginalRecord || event);
      const latestSnapshot = stableJsonSnapshot(latest);

      if (originalSnapshot !== latestSnapshot) {
        setEvent(latest);
        setVarOriginalRecord(latest);
        Alert.alert(
          "Record changed",
          "This record has been modified by another user since you opened it. Please refresh and review the latest changes before saving."
        );
        return;
      }

      const updated = await api.updateSession(id, draft);
      setEvent(updated);
      setVarOriginalRecord(updated);
      setEditing(false);
    } catch (e) {
      // surface but don't crash
    } finally {
      setSaving(false);
    }
  };

  const postNote = async () => {
    if (!id || !newNote.trim()) return;
    setPosting(true);
    try {
      const created = await api.createEventNote(id, newNote.trim());
      setNotes((prev) => [created, ...prev]);
      setNewNote("");
    } finally {
      setPosting(false);
    }
  };

  const removeNote = async (noteId: string) => {
    if (!id) return;
    try {
      await api.deleteEventNote(id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {}
  };

  const doDeleteSession = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.deleteSession(id);
      setConfirmDelete(false);
      // Clear the cached schedule so the list refreshes on return
      try {
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        await AsyncStorage.removeItem("cache:schedule");
      } catch {}
      router.back();
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.xl }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.onSurfaceMuted} />
        <Text style={styles.emptyText}>Event not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnFallback}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const cIcon = CATEGORY_ICON[event.category] || "ellipse";
  const cColor = CATEGORY_COLOR[event.category] || colors.brand;
  const isPartnersTour = isPartnersTourEvent(event);
  const isTasteOfScotland = isTasteOfScotlandEvent(event);
  const isRoyalYachtReception = isRoyalYachtReceptionEvent(event);
  const isSymposiumBanquet = isSymposiumBanquetEvent(event);
  const isWalkingTour = isPartnersWalkingTourEvent(event);
  const isTechnicalBoatTour = isTechnicalBoatTourEvent(event);
  const coachMeta =
    event.transportDetails?.trim() ||
    (event.coachTime ? `${event.coachTime} – Coach leaves hotel` : "") ||
    (isPartnersTour && !isWalkingTour ? "09:45 Coach Leaves" : "");
  const mapRouteUrl =
    (isTasteOfScotland
      ? ""
      : isTechnicalBoatTour
        ? TECHNICAL_BOAT_TOUR_MAP_URL
        : isWalkingTour
          ? WALKING_TOUR_MAP_URL
          : event.maps_url) ||
    (isPartnersTour ? PARTNERS_TOUR_ROUTE_URL : "");
  const isReceptionEvent = isRegistrationReceptionEvent(event);
  const isRosslynKelpiesPartnersTour = isRosslynKelpiesPartnersTourEvent(event);
  const locationLabel = isReceptionEvent ? "Apex Grassmarket Hotel" : event.location;
  const askSpeaker = isTechnicalTalk(event);
  const hasSpeakerBios = (event.speakerBios || []).length > 0 || !!event.speakerId;

  const openLocationMap = async () => {
    const url = mapRouteUrl || buildMapsSearchUrl(`${event.location} ${event.title}`.trim());
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unable to open map", "Please try again in a few moments.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open map", "Please try again in a few moments.");
    }
  };

  const openMapUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unable to open map", "Please try again in a few moments.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open map", "Please try again in a few moments.");
    }
  };

  const openLandingFeePayment = async () => {
    try {
      const supported = await Linking.canOpenURL(LANDING_FEE_LINK);
      if (!supported) {
        Alert.alert("Unable to open payment link", "Please try again in a few moments.");
        return;
      }
      await Linking.openURL(LANDING_FEE_LINK);
    } catch {
      Alert.alert("Unable to open payment link", "Please try again in a few moments.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      {/* Header bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="event-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.topActions}>
          {isAdmin && !editing ? (
            <Pressable onPress={startEdit} hitSlop={10} style={styles.iconBtn} testID="event-edit">
              <Ionicons name="create-outline" size={22} color={colors.brand} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => id && toggle(id)} hitSlop={10} style={styles.iconBtn} testID="event-fav">
            <Ionicons
              name={fav ? "bookmark" : "bookmark-outline"}
              size={22}
              color={fav ? colors.brandTertiary : colors.onSurface}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category pill */}
        <View style={[styles.catPill, { backgroundColor: cColor }]}>
          <Ionicons name={cIcon} size={14} color="#fff" />
          <Text style={styles.catPillText}>{CATEGORY_LABEL[event.category] || event.category}</Text>
        </View>

        {/* Title + meta (or editor) */}
        {!editing ? (
          <>
            <Text style={styles.title}>{event.title}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar" size={16} color={colors.onSurfaceMuted} />
              <Text style={styles.metaText}>{event.day_label}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time" size={16} color={colors.onSurfaceMuted} />
              <Text style={styles.metaText}>
                {event.time}{event.end_time ? ` – ${event.end_time}` : ""}
              </Text>
            </View>
            {coachMeta ? (
              <View style={styles.metaRow}>
                <Ionicons name="bus" size={16} color={colors.onSurfaceMuted} />
                <Text style={styles.coachMetaText}>{coachMeta}</Text>
              </View>
            ) : null}
            {mapRouteUrl && event.date !== "2026-07-27" && event.date !== "2026-07-28" && event.date !== "2026-07-29" && !askSpeaker && !isReceptionEvent && !isRosslynKelpiesPartnersTour && !isWalkingTour && !isTechnicalBoatTour ? (
              <Pressable onPress={openLocationMap} hitSlop={8} style={styles.metaRow} testID="event-route-link">
                <Ionicons name="navigate" size={16} color={colors.onSurfaceMuted} />
                <Text style={styles.mapLinkText}>{mapRouteUrl}</Text>
              </Pressable>
            ) : null}
            {isTasteOfScotland ? (
              <View style={styles.metaRow}>
                <Ionicons name="location" size={16} color={colors.onSurfaceMuted} />
                <Text style={styles.metaText}>{event.location}</Text>
              </View>
            ) : (
              <Pressable onPress={openLocationMap} hitSlop={8} style={styles.metaRow} testID="event-map-link">
                <Ionicons name="location" size={16} color={colors.onSurfaceMuted} />
                <Text style={styles.metaText}>{locationLabel}</Text>
              </Pressable>
            )}
            {isTasteOfScotland ? (
              <View style={[styles.ticketReminderBtn, styles.ticketReminderBtnCentered]}>
                <Text style={[styles.ticketReminderBtnText, styles.ticketReminderBtnTextCentered]}>Please remember your ticket for entry to this event</Text>
              </View>
            ) : null}
            {isRoyalYachtReception ? (
              <View style={[styles.ticketReminderBtn, styles.ticketReminderBtnCentered]}>
                <Text style={[styles.ticketReminderBtnText, styles.ticketReminderBtnTextCentered]}>Please remember your invitation for the Royal Yacht</Text>
              </View>
            ) : null}
            {isSymposiumBanquet ? (
              <View style={[styles.ticketReminderBtn, styles.ticketReminderBtnCentered]}>
                <Text style={[styles.ticketReminderBtnText, styles.ticketReminderBtnTextCentered]}>Please remember to bring your name badge</Text>
              </View>
            ) : null}
            {isTechnicalBoatTour ? (
              <Pressable
                onPress={openLandingFeePayment}
                style={[styles.ticketReminderBtn, styles.ticketReminderBtnCentered]}
                testID="technical-boat-landing-fee"
              >
                <Text style={[styles.ticketReminderBtnText, styles.ticketReminderBtnTextCentered]}>Please pay your landing fee before the event</Text>
              </Pressable>
            ) : null}
            {isTechnicalBoatTour ? (
              <Pressable
                onPress={() => openMapUrl(TECHNICAL_BOAT_TOUR_SECONDARY_MAP_URL)}
                hitSlop={8}
                style={styles.metaRow}
                testID="event-map-link-technical-boat-secondary"
              >
                <Ionicons name="navigate" size={16} color={colors.onSurfaceMuted} />
                <Text style={styles.mapLinkText}>Forth Boat Tours</Text>
              </Pressable>
            ) : null}

            {askSpeaker && hasSpeakerBios ? (
              <Pressable
                onPress={() => router.push(`/speaker-bios/${event.id}`)}
                style={styles.speakerBtn}
                testID="event-speaker-bios"
              >
                <Ionicons name="people-outline" size={16} color={colors.brand} />
                <Text style={styles.speakerBtnText}>Speaker Bio's</Text>
              </Pressable>
            ) : null}

            {askSpeaker ? (
              <Pressable
                onPress={() => router.push({ pathname: "/questions", params: { event_id: event.id, event_title: event.title } })}
                style={styles.askBtn}
                testID="event-ask-speaker"
              >
                <Ionicons name="mic-outline" size={16} color={colors.success} />
                <Text style={styles.askBtnText}>Ask the speaker</Text>
              </Pressable>
            ) : null}

            {event.description ? (
              <>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.body}>{event.description}</Text>
              </>
            ) : null}
          </>
        ) : (
          <View>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={draft.title || ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))}
              testID="edit-title"
            />
            <View style={styles.rowSplit}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start</Text>
                <TextInput
                  style={styles.input}
                  value={draft.time || ""}
                  onChangeText={(v) => setDraft((d) => ({ ...d, time: v }))}
                  placeholder="HH:MM"
                  testID="edit-time"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End</Text>
                <TextInput
                  style={styles.input}
                  value={(draft.end_time as string) || ""}
                  onChangeText={(v) => setDraft((d) => ({ ...d, end_time: v }))}
                  placeholder="(optional)"
                  testID="edit-end"
                />
              </View>
            </View>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={draft.location || ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, location: v }))}
              testID="edit-location"
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={draft.description || ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))}
              multiline
              testID="edit-description"
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => {
                const sel = draft.category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setDraft((d) => ({ ...d, category: c }))}
                    style={[styles.catChip, sel && { backgroundColor: CATEGORY_COLOR[c], borderColor: CATEGORY_COLOR[c] }]}
                  >
                    <Text style={[styles.catChipText, sel && { color: "#fff" }]}>
                      {CATEGORY_LABEL[c]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.editActions}>
              <Pressable onPress={cancelEdit} style={[styles.btn, styles.btnGhost]} testID="edit-cancel">
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                disabled={saving}
                style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.5 }]}
                testID="edit-save"
              >
                <Text style={styles.btnPrimaryText}>{saving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setConfirmDelete(true)}
              style={styles.deleteBtn}
              testID="edit-delete"
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>Delete this session</Text>
            </Pressable>
          </View>
        )}

        {/* Notes & Updates */}
        <View style={styles.notesHeader}>
          <Text style={styles.sectionTitle}>Notes & Updates</Text>
          {notes.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{notes.length}</Text>
            </View>
          ) : null}
        </View>

        {isAdmin ? (
          <View style={[styles.composer, shadow.card]}>
            <TextInput
              style={styles.composerInput}
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Add an update or note for delegates…"
              placeholderTextColor={colors.onSurfaceMuted}
              multiline
              testID="note-input"
            />
            <Pressable
              onPress={postNote}
              disabled={posting || !newNote.trim()}
              style={[styles.postBtn, (!newNote.trim() || posting) && { opacity: 0.5 }]}
              testID="note-post"
            >
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.postBtnText}>{posting ? "Posting…" : "Post"}</Text>
            </Pressable>
          </View>
        ) : null}

        {notes.length === 0 ? (
          <View style={styles.notesEmpty}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.onSurfaceMuted} />
            <Text style={styles.emptyText}>
              {isAdmin ? "Be the first to add a note." : "No updates yet for this session."}
            </Text>
          </View>
        ) : (
          notes.map((n) => (
            <View key={n.id} style={[styles.noteCard, shadow.card]} testID={`note-${n.id}`}>
              <View style={styles.noteHead}>
                <View style={styles.noteAvatar}>
                  <Ionicons name="person" size={14} color={colors.brand} />
                </View>
                <Text style={styles.noteAuthor}>{n.author}</Text>
                <Text style={styles.noteWhen}>{formatWhen(n.created_at)}</Text>
                {isAdmin ? (
                  <Pressable
                    onPress={() => removeNote(n.id)}
                    hitSlop={8}
                    style={{ marginLeft: 6 }}
                    testID={`note-delete-${n.id}`}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.noteText}>{n.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Confirm delete modal */}
      <Modal
        visible={confirmDelete}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete this session?</Text>
            <Text style={styles.confirmText}>
              "{event.title}" will be removed from the schedule for everyone. Any notes attached to it will also be deleted. This can't be undone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setConfirmDelete(false)}
                style={[styles.btn, styles.btnGhost]}
                testID="delete-cancel"
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={doDeleteSession}
                disabled={deleting}
                style={[styles.btn, styles.confirmDanger, deleting && { opacity: 0.5 }]}
                testID="delete-confirm"
              >
                <Text style={styles.btnPrimaryText}>{deleting ? "Deleting…" : "Delete"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  } catch { return iso; }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", flex: 1 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  topActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  iconBtn: { padding: 4 },

  catPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, marginBottom: spacing.md,
  },
  catPillText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },

  title: { fontSize: 28, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", lineHeight: 34 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm },
  metaText: { fontSize: 14, color: colors.onSurfaceMuted },
  mapLinkText: { fontSize: 14, color: colors.brand, textDecorationLine: "underline", flex: 1 },
  coachMetaText: { fontSize: 14, color: colors.onSurfaceMuted, fontFamily: "Georgia", fontStyle: "italic", fontWeight: "700" },
  ticketReminderBtn: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: "#B3261E",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ticketReminderBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  ticketReminderBtnCentered: { alignSelf: "stretch", alignItems: "center" },
  ticketReminderBtnTextCentered: { textAlign: "center" },
  askBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "#EAF5EE",
  },
  askBtnText: { fontSize: 12, fontWeight: "800", color: colors.success },
  speakerBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "#E8ECF2",
  },
  speakerBtnText: { fontSize: 12, fontWeight: "800", color: colors.brand },

  sectionTitle: {
    fontSize: 13, fontWeight: "800", letterSpacing: 1.2, color: colors.onSurfaceMuted,
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  body: { fontSize: 15, color: colors.onSurface, lineHeight: 22 },

  label: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted, letterSpacing: 0.8, marginTop: spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15,
  },
  inputMulti: { minHeight: 100, textAlignVertical: "top" },
  rowSplit: { flexDirection: "row", gap: spacing.md },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  catChipText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceMuted },

  editActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  btn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.onSurface, fontWeight: "600" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },

  notesHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  countBadge: {
    backgroundColor: colors.brand, minWidth: 22, height: 18, paddingHorizontal: 6,
    borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: spacing.xl,
  },
  countBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  composer: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    marginTop: spacing.sm, marginBottom: spacing.md,
  },
  composerInput: {
    minHeight: 60, color: colors.onSurface, fontSize: 14, textAlignVertical: "top",
  },
  postBtn: {
    alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  notesEmpty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.onSurfaceMuted, marginTop: spacing.sm, textAlign: "center" },

  noteCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  noteAvatar: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#E8ECF2",
    alignItems: "center", justifyContent: "center",
  },
  noteAuthor: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  noteWhen: { fontSize: 11, color: colors.onSurfaceMuted, marginLeft: "auto" },
  noteText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },

  backBtnFallback: {
    marginTop: spacing.lg, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.md, backgroundColor: colors.brand,
  },
  backBtnText: { color: "#fff", fontWeight: "700" },

  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: spacing.lg, paddingVertical: 12,
    borderWidth: 1, borderColor: "#F5C0BD", borderRadius: radius.md,
    backgroundColor: "#FBEDEC",
  },
  deleteBtnText: { color: colors.error, fontWeight: "700", fontSize: 13 },

  confirmBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg },
  confirmCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl },
  confirmTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface, fontFamily: "Georgia", textAlign: "center" },
  confirmText: { fontSize: 13, color: colors.onSurfaceMuted, textAlign: "center", marginTop: spacing.sm, lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  confirmDanger: { backgroundColor: colors.error },
});
