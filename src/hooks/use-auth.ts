import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "student";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
}

export const currentUserQueryKey = ["current-user"] as const;

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const isAdmin = (roles ?? []).some((r) => r.role === "admin");

  return {
    id: user.id,
    email: profile?.email || user.email || "",
    fullName: profile?.full_name || "",
    role: isAdmin ? "admin" : "student",
  };
}

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserQueryKey, queryFn: fetchCurrentUser });
}
