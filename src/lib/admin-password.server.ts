/** Server-only admin password resolution. Do not import from client routes. */
export function resolveAdminPassword(): string {
  const fromEnv = (process.env["ADMIN_PASSWORD"] ?? "").trim();
  if (fromEnv.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD is not set (min 8 characters). Add it to the server .env and restart.",
    );
  }
  return fromEnv;
}
