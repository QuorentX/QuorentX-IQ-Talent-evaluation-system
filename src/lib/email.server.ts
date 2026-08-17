/** Optional transactional email via Resend. No-ops clearly when unset. */
export async function sendInviteEmail(opts: {
  to: string;
  fullName: string;
  password: string;
  assessmentTitle?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = (process.env["RESEND_API_KEY"] ?? "").trim();
  const from = (process.env["INVITE_FROM_EMAIL"] ?? "").trim() || "onboarding@resend.dev";
  const appUrl = (
    process.env["APP_URL"] ??
    process.env["VITE_APP_URL"] ??
    "http://localhost:8080"
  ).replace(/\/$/, "");

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const subject = opts.assessmentTitle
    ? `Your TalentGate assessment: ${opts.assessmentTitle}`
    : "Your TalentGate login credentials";

  const bodyText = [
    `Hi ${opts.fullName || "candidate"},`,
    "",
    "An account has been created for you on TalentGate.",
    opts.assessmentTitle ? `Assessment: ${opts.assessmentTitle}` : null,
    "",
    `Sign in: ${appUrl}/login`,
    `Email: ${opts.to}`,
    `Temporary password: ${opts.password}`,
    "",
    "Please sign in and change nothing — use these credentials as issued by your recruiter.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject,
      text: bodyText,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { sent: false, reason: detail.slice(0, 300) };
  }
  return { sent: true };
}
