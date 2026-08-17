/** Only this email may access the admin console. Safe for client bundles. */
export const PRIMARY_ADMIN_EMAIL = "quorentanalytics@gmail.com";

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
