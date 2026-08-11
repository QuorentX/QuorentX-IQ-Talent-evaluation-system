import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Submits an attempt and auto-grades every multiple-choice question.
 * Coding and written answers are left for admin review.
 */
export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, assessment_id, student_id, status")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (attemptError) throw new Error(attemptError.message);
    if (!attempt || attempt.student_id !== userId) throw new Error("Attempt not found");
    if (attempt.status !== "in_progress") return { ok: true, alreadySubmitted: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, type, points, question_keys(correct_option)")
      .eq("assessment_id", attempt.assessment_id);

    const { data: answers } = await supabaseAdmin
      .from("answers")
      .select("id, question_id, selected_option")
      .eq("attempt_id", attempt.id);

    let autoScore = 0;
    let maxScore = 0;
    for (const q of questions ?? []) {
      maxScore += q.points;
      if (q.type !== "mcq") continue;
      const key = Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys;
      const answer = (answers ?? []).find((a) => a.question_id === q.id);
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

    const needsReview = (questions ?? []).some((q) => q.type !== "mcq");

    const { error: updateError } = await supabaseAdmin
      .from("attempts")
      .update({
        status: needsReview ? "submitted" : "graded",
        submitted_at: new Date().toISOString(),
        auto_score: autoScore,
        total_score: autoScore,
        max_score: maxScore,
      })
      .eq("id", attempt.id);
    if (updateError) throw new Error(updateError.message);

    return { ok: true, autoScore, maxScore, needsReview };
  });
