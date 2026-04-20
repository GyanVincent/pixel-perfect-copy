import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "smartprep:groups:lastRead";
const NOTIF_PROMPT_KEY = "smartprep:notif:prompted";

type LastReadMap = Record<string, string>; // groupId -> ISO timestamp

function readLastRead(): LastReadMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LastReadMap) : {};
  } catch {
    return {};
  }
}

function writeLastRead(map: LastReadMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function markGroupRead(groupId: string) {
  const map = readLastRead();
  map[groupId] = new Date().toISOString();
  writeLastRead(map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("smartprep:groups:read", { detail: { groupId } }));
  }
}

/**
 * Ask for browser-notification permission once, the first time we have an authenticated user.
 * No-op if not supported, already decided, or already prompted in this browser.
 */
export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  try {
    if (window.localStorage.getItem(NOTIF_PROMPT_KEY) === "1") return;
    window.localStorage.setItem(NOTIF_PROMPT_KEY, "1");
  } catch {
    // ignore
  }
  try {
    await Notification.requestPermission();
  } catch {
    // ignore
  }
}

function isAppBackgrounded(): boolean {
  if (typeof document === "undefined") return false;
  // Hidden tab, minimized window, or unfocused window all count as "background".
  return document.visibilityState !== "visible" || !document.hasFocus();
}

function showGroupNotification(opts: { title: string; body: string; groupId: string }) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: `group-${opts.groupId}`, // collapse multiple messages from the same group
    });
    n.onclick = () => {
      window.focus();
      window.location.href = `/groups/${opts.groupId}`;
      n.close();
    };
  } catch (err) {
    console.error("[unread-groups] notification error", err);
  }
}

/**
 * Returns the total unread message count across all groups the current user belongs to.
 * Messages authored by the current user are not counted.
 *
 * Also fires a browser notification when a new message arrives in one of the user's
 * groups while the app is backgrounded (tab hidden or window unfocused).
 */
export function useUnreadGroups(): number {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }

    void ensureNotificationPermission();

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let groupIds: string[] = [];
    const groupNames = new Map<string, string>();
    const authorNames = new Map<string, string>();

    const recompute = async () => {
      if (groupIds.length === 0) {
        if (!cancelled) setUnread(0);
        return;
      }
      const lastRead = readLastRead();
      const results = await Promise.all(
        groupIds.map(async (gid) => {
          const since = lastRead[gid] || "1970-01-01T00:00:00Z";
          const { count } = await supabase
            .from("study_group_messages")
            .select("id", { count: "exact", head: true })
            .eq("group_id", gid)
            .neq("user_id", user.id)
            .gt("created_at", since);
          return count || 0;
        }),
      );
      if (cancelled) return;
      setUnread(results.reduce((a, b) => a + b, 0));
    };

    const init = async () => {
      const { data: memberships, error } = await supabase
        .from("study_group_members")
        .select("group_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      if (error) {
        console.error("[unread-groups] memberships error", error);
        return;
      }
      groupIds = (memberships || []).map((m) => m.group_id);
      await recompute();

      if (groupIds.length === 0) return;

      // Cache group names for notification titles.
      const { data: groups } = await supabase
        .from("study_groups")
        .select("id, name")
        .in("id", groupIds);
      (groups || []).forEach((g) => groupNames.set(g.id, g.name));

      channel = supabase
        .channel(`unread-groups-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "study_group_messages" },
          async (payload) => {
            const m = payload.new as {
              group_id: string;
              user_id: string;
              created_at: string;
              content: string;
            };
            if (!groupIds.includes(m.group_id)) return;
            if (m.user_id === user.id) return;

            const lastRead = readLastRead();
            const since = lastRead[m.group_id] || "1970-01-01T00:00:00Z";
            if (new Date(m.created_at) <= new Date(since)) return;

            setUnread((prev) => prev + 1);

            if (!isAppBackgrounded()) return;

            // Resolve author name (cached) for the notification body.
            let author = authorNames.get(m.user_id);
            if (!author) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("user_id", m.user_id)
                .maybeSingle();
              author = prof?.full_name || "Someone";
              authorNames.set(m.user_id, author);
            }
            const groupName = groupNames.get(m.group_id) || "Study group";
            showGroupNotification({
              title: `${author} in ${groupName}`,
              body: m.content.length > 140 ? m.content.slice(0, 137) + "…" : m.content,
              groupId: m.group_id,
            });
          },
        )
        .subscribe();
    };

    const onRead = () => {
      void recompute();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void recompute();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("smartprep:groups:read", onRead);
      window.addEventListener("storage", onStorage);
    }

    init();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("smartprep:groups:read", onRead);
        window.removeEventListener("storage", onStorage);
      }
    };
  }, [user?.id]);

  return unread;
}
