import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitAttempt } from "@/lib/attempts.functions";
import { useCurrentUser } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/assessment/$assessmentId")({
  head: () => ({
    meta: [
      { title: "Take assessment — TalentGate" },
      { name: "description", content: "Answer your assigned assessment questions before the timer ends." },
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
  const [responses, setResponses] = useState<Record<string, { option?: number | undefined; text?: string | undefined }>>({});
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sitting", assessmentId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: assessment, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", assessmentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!assessment) throw new Error("Assessment not available");

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
    setResponses(seeded);
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadline = useMemo(() => {
    if (!data) return null;
    return new Date(data.attempt.started_at).getTime() + data.assessment.duration_minutes * 60_000;
  }, [data]);

  const remaining = deadline ? Math.max(0, deadline - now) : 0;
  const locked = data ? data.attempt.status !== "in_progress" : false;

  async function handleSubmit(auto = false) {
    if (!data || submitting) return;
    setSubmitting(true);
    try {
      const rows = data.questions.map((q) => ({
        attempt_id: data.attempt.id,
        question_id: q.id,
        selected_option: responses[q.id]?.option ?? null,
        response: (responses[q.id]?.text ?? "").slice(0, 20000),
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("answers")
          .upsert(rows, { onConflict: "attempt_id,question_id" });
        if (error) throw new Error(error.message);
      }
      await submit({ data: { attemptId: data.attempt.id } });
      await queryClient.invalidateQueries();
      toast.success(auto ? "Time is up — your answers were submitted" : "Assessment submitted");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (deadline && remaining === 0 && data && !locked && !submitting) {
      void handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, deadline, locked]);

  if (isLoading || !data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading assessment…</p>
      </AppShell>
    );
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.assessment.title}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{data.assessment.description}</p>
        </div>
        {!locked && (
          <Badge variant={remaining < 60_000 ? "destructive" : "secondary"} className="h-9 gap-2 px-4 text-sm">
            <Timer className="h-4 w-4" />
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Badge>
        )}
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
          {data.questions.map((q, index) => (
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
                <CardDescription className="capitalize">
                  {q.type === "mcq" ? "Multiple choice" : q.type === "coding" ? `Coding${q.language ? ` · ${q.language}` : ""}` : "Written answer"}
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
                      <div key={i} className="flex items-center gap-3 rounded-md border border-border p-3">
                        <RadioGroupItem value={i.toString()} id={`${q.id}-${i}`} />
                        <Label htmlFor={`${q.id}-${i}`} className="font-normal">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    rows={q.type === "coding" ? 12 : 6}
                    className={q.type === "coding" ? "font-mono text-sm" : ""}
                    placeholder={q.type === "coding" ? "// your solution" : "Type your answer"}
                    value={responses[q.id]?.text ?? ""}
                    maxLength={20000}
                    onChange={(e) =>
                      setResponses((r) => ({ ...r, [q.id]: { ...r[q.id], text: e.target.value } }))
                    }
                  />
                )}
              </CardContent>
            </Card>
          ))}

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
