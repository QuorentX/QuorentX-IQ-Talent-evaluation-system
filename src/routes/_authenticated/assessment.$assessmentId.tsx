import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitAttempt, finalizeExpiredAttempt } from "@/lib/attempts.functions";
import { codingLanguageById, isCodingLanguageId, starterTemplate } from "@/lib/coding-languages";
import { useCurrentUser } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { CodeConsole } from "@/components/CodeConsole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/assessment/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Take assessment — TalentGate" },
      {
        name: "description",
        content: "Answer your assigned assessment questions before the timer ends.",
      },
      { property: "og:title", content: "Take assessment — TalentGate" },
      { property: "og:description", content: "Timed assessment sitting for assigned candidates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TakeAssessment,
});

function TakeAssessment() {
  const { assessmentId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submit = useServerFn(submitAttempt);
  const finalizeExpired = useServerFn(finalizeExpiredAttempt);
  const [responses, setResponses] = useState<
    Record<string, { option?: number | undefined; text?: string | undefined }>
  >({});
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [timeLocked, setTimeLocked] = useState(false);
  const warned5 = useRef(false);
  const warned1 = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sitting", assessmentId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assessment, error: aErr } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", assessmentId)
        .maybeSingle();
      if (aErr) throw new Error(aErr.message);
      if (!assessment) throw new Error("Assessment not available");

      const { data: assignment } = await supabase
        .from("assignments")
        .select("due_at")
        .eq("assessment_id", assessmentId)
        .eq("student_id", user!.id)
        .maybeSingle();
      if (!assignment) throw new Error("This assessment is not assigned to you");
      if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) {
        const { data: existingAttempt } = await supabase
          .from("attempts")
          .select("id, status")
          .eq("assessment_id", assessmentId)
          .eq("student_id", user!.id)
          .maybeSingle();
        if (!existingAttempt || existingAttempt.status === "in_progress") {
          throw new Error("This assessment is past its due date");
        }
      }

      const { data: questions } = await supabase
        .from("questions")
        .select("id, type, prompt, options, language, points, position")
        .eq("assessment_id", assessmentId)
        .order("position", { ascending: true });

      let { data: attempt } = await supabase
        .from("attempts")
        .select("*")
        .eq("assessment_id", assessmentId)
        .eq("student_id", user!.id)
        .maybeSingle();

      if (!attempt) {
        const inserted = await supabase
          .from("attempts")
          .insert({ assessment_id: assessmentId, student_id: user!.id })
          .select("*")
          .single();
        if (inserted.error) throw new Error(inserted.error.message);
        attempt = inserted.data;
      }

      const { data: answers } = await supabase
        .from("answers")
        .select("*")
        .eq("attempt_id", attempt.id);

      return { assessment, questions: questions ?? [], attempt, answers: answers ?? [] };
    },
  });

  useEffect(() => {
    if (!data) return;
    const seeded: Record<string, { option?: number | undefined; text?: string | undefined }> = {};
    for (const a of data.answers) {
      seeded[a.question_id] = {
        option: a.selected_option ?? undefined,
        text: a.response ?? "",
      };
    }
    for (const q of data.questions) {
      if (q.type === "coding" && !seeded[q.id]?.text) {
        const lang = isCodingLanguageId(q.language) ? q.language : "python";
        seeded[q.id] = { ...seeded[q.id], text: starterTemplate(lang) };
      }
    }
    setResponses(seeded);
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalMs = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, data.assessment.duration_minutes * 60_000);
  }, [data]);

  const deadline = useMemo(() => {
    if (!data) return null;
    return new Date(data.attempt.started_at).getTime() + totalMs;
  }, [data, totalMs]);

  const remaining = deadline ? Math.max(0, deadline - now) : 0;
  const elapsedPct = deadline ? Math.min(100, ((totalMs - remaining) / totalMs) * 100) : 0;
  const locked = data ? data.attempt.status !== "in_progress" || timeLocked : false;

  useEffect(() => {
    if (locked || !deadline) return;
    if (!warned5.current && remaining <= 5 * 60_000 && remaining > 60_000) {
      warned5.current = true;
      toast.warning("5 minutes remaining");
    }
    if (!warned1.current && remaining <= 60_000 && remaining > 0) {
      warned1.current = true;
      toast.error("1 minute remaining — submit soon");
    }
  }, [remaining, deadline, locked]);

  async function persistAnswers() {
    if (!data) return;
    const rows = data.questions.map((q) => ({
      attempt_id: data.attempt.id,
      question_id: q.id,
      selected_option: responses[q.id]?.option ?? null,
      response: (responses[q.id]?.text ?? "").slice(0, 20000),
      updated_at: new Date().toISOString(),
    }));
    if (!rows.length) return;
    const { error: upsertError } = await supabase
      .from("answers")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (upsertError) throw new Error(upsertError.message);
  }

  async function handleSubmit(auto = false) {
    if (!data || submitting) return;
    setSubmitting(true);
    try {
      await persistAnswers();
      try {
        await submit({ data: { attemptId: data.attempt.id } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.includes("TIME_EXPIRED") || message.includes("DUE_PASSED") || auto) {
          setTimeLocked(true);
          await finalizeExpired({ data: { attemptId: data.attempt.id } });
          toast.message("Time ended — your saved answers were submitted");
          await queryClient.invalidateQueries();
          navigate({ to: "/dashboard" });
          return;
        }
        throw err;
      }
      await queryClient.invalidateQueries();
      toast.success(auto ? "Time is up — your answers were submitted" : "Assessment submitted");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not submit";
      if (message.includes("TIME_EXPIRED")) {
        setTimeLocked(true);
        toast.error("Time limit ended. Your attempt can no longer accept new answers.");
      } else if (message.includes("DUE_PASSED")) {
        setTimeLocked(true);
        toast.error("This assessment is past its due date.");
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (deadline && remaining === 0 && data && !locked && !submitting) {
      setTimeLocked(true);
      toast.error("Time expired — submitting now");
      void handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, deadline, locked]);

  // Autosave answers every 30s (skipped once time-locked)
  useEffect(() => {
    if (!data || locked) return;
    const id = setInterval(() => {
      void (async () => {
        const rows = data.questions.map((q) => ({
          attempt_id: data.attempt.id,
          question_id: q.id,
          selected_option: responses[q.id]?.option ?? null,
          response: (responses[q.id]?.text ?? "").slice(0, 20000),
          updated_at: new Date().toISOString(),
        }));
        if (!rows.length) return;
        await supabase.from("answers").upsert(rows, { onConflict: "attempt_id,question_id" });
      })();
    }, 30_000);
    return () => clearInterval(id);
  }, [data, locked, responses]);

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading assessment…</p>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Unable to start</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "Assessment not available"}
            </CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  return (
    <AppShell>
      {!locked && (
        <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{data.assessment.title}</p>
              <Progress value={elapsedPct} className="mt-2 h-2" />
            </div>
            <Badge
              variant={
                remaining < 60_000
                  ? "destructive"
                  : remaining < 5 * 60_000
                    ? "secondary"
                    : "outline"
              }
              className="h-9 gap-2 px-4 text-sm tabular-nums"
            >
              <Timer className="h-4 w-4" />
              {timeLocked || remaining === 0
                ? "Time expired"
                : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
            </Badge>
            <Button size="sm" disabled={submitting} onClick={() => handleSubmit(false)}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{data.assessment.title}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{data.assessment.description}</p>
      </div>

      {data.assessment.instructions && (
        <Card className="mb-6 shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {data.assessment.instructions}
          </CardContent>
        </Card>
      )}

      {locked ? (
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">Already submitted</CardTitle>
            <CardDescription>Your answers are with the review team.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-5">
          {data.questions.map((q, index) => {
            const lang = codingLanguageById(q.language);
            return (
              <Card key={q.id} className="shadow-panel">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-4 text-base">
                    <span>
                      {index + 1}. {q.prompt}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {q.points} pt{q.points === 1 ? "" : "s"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {q.type === "mcq"
                      ? "Multiple choice"
                      : q.type === "coding"
                        ? `Coding · ${lang.label}`
                        : "Written answer"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {q.type === "mcq" ? (
                    <RadioGroup
                      value={responses[q.id]?.option?.toString() ?? ""}
                      onValueChange={(v) =>
                        setResponses((r) => ({ ...r, [q.id]: { ...r[q.id], option: Number(v) } }))
                      }
                      className="space-y-2"
                    >
                      {((q.options as string[]) ?? []).map((option, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-md border border-border p-3"
                        >
                          <RadioGroupItem value={i.toString()} id={`${q.id}-${i}`} />
                          <Label htmlFor={`${q.id}-${i}`} className="font-normal">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : q.type === "coding" ? (
                    <CodeConsole
                      language={lang.id}
                      value={responses[q.id]?.text ?? ""}
                      onChange={(text) =>
                        setResponses((r) => ({ ...r, [q.id]: { ...r[q.id], text } }))
                      }
                    />
                  ) : (
                    <Textarea
                      rows={6}
                      placeholder="Type your answer"
                      value={responses[q.id]?.text ?? ""}
                      maxLength={20000}
                      onChange={(e) =>
                        setResponses((r) => ({
                          ...r,
                          [q.id]: { ...r[q.id], text: e.target.value },
                        }))
                      }
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-end">
            <Button size="lg" disabled={submitting} onClick={() => handleSubmit(false)}>
              {submitting ? "Submitting…" : "Submit assessment"}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
