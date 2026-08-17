import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type GradeResult = {
  ok: true;
  autoScore: number;
  maxScore: number;
  needsReview: boolean;
  alreadySubmitted?: boolean;
  finalizedExpired?: boolean;
};

async function gradeAndCloseAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  attemptId: string,
  assessmentId: string,
): Promise<GradeResult> {
  const { data: questions } = await supabaseAdmin
    .from("questions")
    .select("id, type, points, question_keys(correct_option)")
    .eq("assessment_id", assessmentId);

  const { data: answers } = await supabaseAdmin
    .from("answers")
    .select("id, question_id, selected_option")
    .eq("attempt_id", attemptId);

  let autoScore = 0;
  let maxScore = 0;
  for (const q of questions ?? []) {
    maxScore += q.points;
    if (q.type !== "mcq") continue;
    const key = Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys;
    const answer = (answers ?? []).find((a: { question_id: string }) => a.question_id === q.id);
    const correct =
      key?.correct_option !== null &&
      key?.correct_option !== undefined &&
      answer?.selected_option === key.correct_option;
    const awarded = correct ? q.points : 0;
    autoScore += awarded;
    if (answer) {
      await supabaseAdmin.from("answers").update({ awarded_points: awarded }).eq("id", answer.id);
    }
  }

  const needsReview = (questions ?? []).some((q: { type: string }) => q.type !== "mcq");

  const { error: updateError } = await supabaseAdmin
    .from("attempts")
    .update({
      status: needsReview ? "submitted" : "graded",
      submitted_at: new Date().toISOString(),
      auto_score: autoScore,
      total_score: autoScore,
      max_score: maxScore,
    })
    .eq("id", attemptId);
  if (updateError) throw new Error(updateError.message);

  return { ok: true, autoScore, maxScore, needsReview };
}

/**
 * Submits an attempt and auto-grades every multiple-choice question.
 * Hard-rejects when the duration or due date has passed (5s clock skew only).
 */
export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, assessment_id, student_id, status, started_at")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (attemptError) throw new Error(attemptError.message);
    if (!attempt || attempt.student_id !== userId) throw new Error("Attempt not found");
    if (attempt.status !== "in_progress") return { ok: true, alreadySubmitted: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("duration_minutes")
      .eq("id", attempt.assessment_id)
      .maybeSingle();

    if (assessment) {
      const deadline =
        new Date(attempt.started_at).getTime() + assessment.duration_minutes * 60_000 + 5_000;
      if (Date.now() > deadline) {
        throw new Error("TIME_EXPIRED: The time limit for this assessment has ended.");
      }
    }

    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("due_at")
      .eq("assessment_id", attempt.assessment_id)
      .eq("student_id", userId)
      .maybeSingle();
    if (assignment?.due_at && new Date(assignment.due_at).getTime() < Date.now() - 5_000) {
      throw new Error("DUE_PASSED: This assessment is past its due date.");
    }

    return gradeAndCloseAttempt(supabaseAdmin, attempt.id, attempt.assessment_id);
  });

/**
 * Closes an in-progress attempt after time/due expiry using already-saved answers.
 * Used when the client timer ends or a late submit is rejected.
 */
export const finalizeExpiredAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, assessment_id, student_id, status, started_at")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (attemptError) throw new Error(attemptError.message);
    if (!attempt || attempt.student_id !== userId) throw new Error("Attempt not found");
    if (attempt.status !== "in_progress") {
      return { ok: true as const, alreadySubmitted: true, finalizedExpired: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assessment } = await supabaseAdmin
      .from("assessments")
      .select("duration_minutes")
      .eq("id", attempt.assessment_id)
      .maybeSingle();

    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("due_at")
      .eq("assessment_id", attempt.assessment_id)
      .eq("student_id", userId)
      .maybeSingle();

    const timeExpired = assessment
      ? Date.now() >
        new Date(attempt.started_at).getTime() + assessment.duration_minutes * 60_000 - 1_000
      : false;
    const duePassed = assignment?.due_at
      ? new Date(assignment.due_at).getTime() < Date.now() + 1_000
      : false;

    if (!timeExpired && !duePassed) {
      throw new Error("Assessment time has not expired yet. Use normal submit.");
    }

    const result = await gradeAndCloseAttempt(supabaseAdmin, attempt.id, attempt.assessment_id);
    return { ...result, finalizedExpired: true };
  });
