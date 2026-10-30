import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CurrentUser = { id: string; email: string | null; name: string; avatarUrl: string | null } | null;

export const PROFILE_UPDATED = "clab:profile-updated";

/** Signed-in user with a display name and photo: uploaded photo → Google photo → none (initials). */
export function useCurrentUser(): { user: CurrentUser; ready: boolean } {
  const [user, setUser] = useState<CurrentUser>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user;
      if (!u) { if (alive) { setUser(null); setReady(true); } return; }
      const { data: p } = await supabase.from("profiles")
        .select("display_name, first_name, last_name, avatar_url").eq("id", u.id).maybeSingle();
      const meta = u.user_metadata ?? {};
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.display_name
        || meta.full_name || meta.name || (u.email ?? "").split("@")[0];
      if (alive) {
        setUser({ id: u.id, email: u.email ?? null, name, avatarUrl: p?.avatar_url || meta.avatar_url || meta.picture || null });
        setReady(true);
      }
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") load();
    });
    window.addEventListener(PROFILE_UPDATED, load);
    return () => { alive = false; subscription.unsubscribe(); window.removeEventListener(PROFILE_UPDATED, load); };
  }, []);

  return { user, ready };
}
