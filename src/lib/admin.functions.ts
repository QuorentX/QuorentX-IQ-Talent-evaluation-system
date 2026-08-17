import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRIMARY_ADMIN_EMAIL, isPrimaryAdminEmail } from "@/lib/admin-config";
import { resolveAdminPassword } from "@/lib/admin-password.server";
import { generateTemporaryPassword } from "@/lib/password";
import { assertRateLimit } from "@/lib/rate-limit.server";
import { sendInviteEmail } from "@/lib/email.server";

export { PRIMARY_ADMIN_EMAIL } from "@/lib/admin-config";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .refine((v) => !isPrimaryAdminEmail(v), {
    message: "That email is reserved for the administrator",
  });

const createStudentSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(120),
  sendEmail: z.boolean().optional(),
});

const inviteToTestSchema = createStudentSchema.extend({
  assessmentId: z.string().uuid(),
  publish: z.boolean().optional(),
  dueAt: z.string().min(1).nullable().optional(),
});

const assignExistingSchema = z.object({
  assessmentId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).max(200),
  dueAt: z.string().min(1).nullable().optional(),
  publish: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  sendEmail: z.boolean().optional(),
});

const provisionSchema = z.object({
  password: z.string().min(8).max(72),
});

function toDueAtIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid due date");
  return d.toISOString();
}

async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!isPrimaryAdminEmail(profile?.email as string | null | undefined)) {
    throw new Error("Forbidden: admin access is limited to the primary administrator");
  }
}

/** After password login: grant admin role only to the primary administrator email. */
export const ensurePrimaryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claimsEmail =
      typeof context.claims?.email === "string" ? context.claims.email.toLowerCase() : "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userError || !authUser.user) throw new Error("Not authenticated");

    const email = (authUser.user.email || claimsEmail || "").toLowerCase();
    if (!isPrimaryAdminEmail(email)) {
      throw new Error("Unauthorized administrator");
    }

    await supabaseAdmin.from("profiles").upsert({
      id: context.userId,
      email: PRIMARY_ADMIN_EMAIL,
      full_name:
        (typeof authUser.user.user_metadata?.["full_name"] === "string" &&
          authUser.user.user_metadata["full_name"]) ||
        "Quorent Analytics",
    });

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", context.userId)
        .eq("role", "student");
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
        user_id: context.userId,
        role: "admin",
      });
      if (roleError) throw new Error(roleError.message);
    }

    return { ok: true as const };
  });

/**
 * Creates the primary admin auth account only when missing.
 * Requires the correct ADMIN_PASSWORD as a challenge + rate limiting.
 */
export const provisionAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => provisionSchema.parse(input))
  .handler(async ({ data }) => {
    assertRateLimit("provision-admin", 8, 15 * 60_000);

    const expected = resolveAdminPassword();
    if (data.password !== expected) {
      throw new Error("Invalid administrator password");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) throw new Error(listError.message);

    const existing = listed.users.find(
      (u) => (u.email ?? "").toLowerCase() === PRIMARY_ADMIN_EMAIL,
    );

    let userId = existing?.id;
    if (!existing) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: PRIMARY_ADMIN_EMAIL,
        password: expected,
        email_confirm: true,
        user_metadata: { full_name: "Quorent Analytics", role: "admin" },
      });
      if (error) throw new Error(error.message);
      userId = created.user?.id;
    }

    if (!userId) throw new Error("Could not provision administrator");

    try {
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        email: PRIMARY_ADMIN_EMAIL,
        full_name: "Quorent Analytics",
      });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "student");
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role: "admin",
        });
      }
    } catch {
      // Schema may not be applied yet.
    }

    return { ok: true as const };
  });

/** Admin-only: create a student with an auto-generated password (shown once). */
export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createStudentSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const password = generateTemporaryPassword();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: "student" },
    });
    if (error) throw new Error(error.message);

    let emailStatus: { sent: boolean; reason?: string } = { sent: false, reason: "skipped" };
    if (data.sendEmail !== false) {
      emailStatus = await sendInviteEmail({
        to: data.email,
        fullName: data.fullName,
        password,
      });
    }

    return { id: created.user?.id ?? "", email: data.email, password, emailStatus };
  });

/**
 * Admin-only: create candidate with auto password, assign to a test with optional due date,
 * and optionally publish so they can sit immediately.
 */
export const inviteCandidateToAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteToTestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const password = generateTemporaryPassword();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: "student" },
    });
    if (error) throw new Error(error.message);

    const studentId = created.user?.id;
    if (!studentId) throw new Error("User was created without an id");

    const { error: assignError } = await supabaseAdmin.from("assignments").insert({
      assessment_id: data.assessmentId,
      student_id: studentId,
      due_at: toDueAtIso(data.dueAt),
    });
    if (assignError) throw new Error(assignError.message);

    if (data.publish !== false) {
      const { error: publishError } = await supabaseAdmin
        .from("assessments")
        .update({ is_published: true })
        .eq("id", data.assessmentId);
      if (publishError) throw new Error(publishError.message);
    }

    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("title")
      .eq("id", data.assessmentId)
      .maybeSingle();

    let emailStatus: { sent: boolean; reason?: string } = { sent: false, reason: "skipped" };
    if (data.sendEmail !== false) {
      emailStatus = await sendInviteEmail({
        to: data.email,
        fullName: data.fullName,
        password,
        ...(assessment?.title ? { assessmentTitle: assessment.title } : {}),
      });
    }

    return { id: studentId, email: data.email, password, emailStatus };
  });

/** Admin-only: sync assignment list for a test (with optional shared due date). */
export const syncAssessmentAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assignExistingSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: listError } = await supabaseAdmin
      .from("assignments")
      .select("id, student_id")
      .eq("assessment_id", data.assessmentId);
    if (listError) throw new Error(listError.message);

    const current = existing ?? [];
    const selected = new Set(data.studentIds);
    const toAdd = data.studentIds.filter((id) => !current.some((a) => a.student_id === id));
    const toRemove = current.filter((a) => !selected.has(a.student_id));

    if (toAdd.length) {
      const due = toDueAtIso(data.dueAt);
      const { error } = await supabaseAdmin.from("assignments").insert(
        toAdd.map((student_id) => ({
          assessment_id: data.assessmentId,
          student_id,
          due_at: due,
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (toRemove.length) {
      const { error } = await supabaseAdmin
        .from("assignments")
        .delete()
        .in(
          "id",
          toRemove.map((a) => a.id),
        );
      if (error) throw new Error(error.message);
    }

    if (data.dueAt !== undefined) {
      const due = toDueAtIso(data.dueAt);
      const keepIds = current.filter((a) => selected.has(a.student_id)).map((a) => a.id);
      if (keepIds.length) {
        const { error } = await supabaseAdmin
          .from("assignments")
          .update({ due_at: due })
          .in("id", keepIds);
        if (error) throw new Error(error.message);
      }
    }

    if (data.publish) {
      const { error } = await supabaseAdmin
        .from("assessments")
        .update({ is_published: true })
        .eq("id", data.assessmentId);
      if (error) throw new Error(error.message);
    }

    return { ok: true as const };
  });

/** Public: whether any admin role exists (does not reveal admin email). */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

/** Admin-only: reset a candidate password and optionally email it. */
export const resetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot reset your own password here");

    const password = generateTemporaryPassword();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    const email = userData.user?.email ?? "";
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.userId)
      .maybeSingle();

    let emailStatus: { sent: boolean; reason?: string } = { sent: false, reason: "skipped" };
    if (data.sendEmail !== false && email) {
      emailStatus = await sendInviteEmail({
        to: email,
        fullName: profile?.full_name || "candidate",
        password,
      });
    }

    return {
      email: profile?.email || email,
      password,
      emailStatus,
    };
  });

/** Admin-only: permanently remove a student account. */
export const deleteStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
