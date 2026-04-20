import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "smartprep:groups:lastRead";

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
 * Returns the total unread message count across all groups the current user belongs to.
 * Messages authored by the current user are not counted.
 */
export function useUnreadGroups(): number {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let groupIds: string[] = [];

    const recompute = async () => {
      if (groupIds.length === 0) {
        if (!cancelled) setUnread(0);
        return;
      }
      const lastRead = readLastRead();
      let total = 0;
      // Run per-group counts in parallel.
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
      total = results.reduce((a, b) => a + b, 0);
      setUnread(total);
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

      // Subscribe to new messages in any of the user's groups.
      channel = supabase
        .channel(`unread-groups-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "study_group_messages" },
          (payload) => {
            const m = payload.new as { group_id: string; user_id: string; created_at: string };
            if (!groupIds.includes(m.group_id)) return;
            if (m.user_id === user.id) return;
            const lastRead = readLastRead();
            const since = lastRead[m.group_id] || "1970-01-01T00:00:00Z";
            if (new Date(m.created_at) > new Date(since)) {
              setUnread((prev) => prev + 1);
            }
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
