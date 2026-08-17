import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const projectRef = process.env.SUPABASE_PROJECT_ID;
const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && (!projectRef || !password)) {
  console.error(
    "Missing DATABASE_URL or SUPABASE_DB_PASSWORD.\n" +
      "Add your database password to .env as SUPABASE_DB_PASSWORD=...\n" +
      "Find it in Supabase → Project Settings → Database.",
  );
  process.exit(1);
}

const connectionString =
  databaseUrl ||
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const sql = readFileSync(resolve(process.cwd(), "supabase/setup-all.sql"), "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Schema applied successfully (user_roles and related tables are ready).");
} catch (err) {
  console.error("Failed to apply schema:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
