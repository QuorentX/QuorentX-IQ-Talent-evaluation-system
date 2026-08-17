import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const email = "quorentanalytics@gmail.com";
const password = env.ADMIN_PASSWORD || "Quorentx@2026";

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: tableError } = await admin.from("user_roles").select("id").limit(1);
console.log("tables:", tableError ? `MISSING (${tableError.message})` : "ready");

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listError) {
  console.error("listUsers failed:", listError.message);
  process.exit(1);
}

const existing = listed.users.find((u) => (u.email || "").toLowerCase() === email);
let userId = existing?.id;

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: "Quorent Analytics", role: "admin" },
  });
  if (error) {
    console.error("updateUser failed:", error.message);
    process.exit(1);
  }
  console.log("admin password reset OK");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Quorent Analytics", role: "admin" },
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  userId = data.user?.id;
  console.log("admin user created OK");
}

if (userId && !tableError) {
  await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: "Quorent Analytics",
  });
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "student");
  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) {
    const { error } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
    if (error) console.warn("role insert:", error.message);
    else console.log("admin role OK");
  } else {
    console.log("admin role already set");
  }
}

const anon = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
const { error: signError } = await anon.auth.signInWithPassword({ email, password });
console.log("signIn test:", signError ? signError.message : "OK");
if (signError) process.exit(1);
