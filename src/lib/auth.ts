import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { supabaseServer } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/services/users";
import type { Actor, Role } from "@/lib/services/common";

export interface SessionUser extends Actor {
  id: string;
  role: Role;
  fullName: string;
  mustChangePassword: boolean;
}

/** Current signed-in, active app user, or null. Cached per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const u = await getAppUser(db(), user.id);
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, role: u.role, fullName: u.full_name, mustChangePassword: u.must_change_password };
});

/** For pages: redirect to login when not signed in; enforce password change. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login?e=noaccess");
  if (u.mustChangePassword && !opts.allowPasswordChange) redirect("/account?must=1");
  return u;
}

const RANK: Record<Role, number> = { viewer: 1, treasurer: 2, admin: 3 };
export function can(u: SessionUser, min: Role) {
  return RANK[u.role] >= RANK[min];
}
