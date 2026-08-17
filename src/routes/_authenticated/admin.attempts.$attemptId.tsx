import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentUser } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/attempts/$attemptId")({
  beforeLoad: async () => {
    const user = await fetchCurrentUser();
    if (!user) throw redirect({ to: "/admin-login" });
    if (user.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Review attempt — TalentGate" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Score coding and written answers and release the candidate's result.",
      },
      { property: "og:title", content: "Review attempt — TalentGate" },
      { property: "og:description", content: "Grade a candidate's assessment submission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewAttempt,
});

function ReviewAttempt() {
  const { attemptId } = Route.useParams();
  const queryClient = useQueryClient();
  const [grades, setGrades] = useState<Record<string, { points: number; feedback: string }>>({});

  const { data } = useQuery({
    queryKey: ["attempt-review", attemptId],
    queryFn: async () => {
      const { data: attempt } = await supabase
        .from("attempts")
        .select("*, assessments(title)")
        .eq("id", attemptId)
        .maybeSingle();
      const { data: profile } = attempt
        ? await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", attempt.student_id)
            .maybeSingle()
        : { data: null };
      const { data: answers } = await supabase
        .from("answers")
        .select(
          "*, questions(prompt, type, points, position, question_keys(correct_option, model_answer))",
        )
        .eq("attempt_id", attemptId);
      const sorted = (answers ?? []).sort(
        (a, b) => (a.questions?.position ?? 0) - (b.questions?.position ?? 0),
      );
      return { attempt, profile, answers: sorted };
    },
  });

  useEffect(() => {
    if (!data) return;
    const seeded: Record<string, { points: number; feedback: string }> = {};
    for (const a of data.answers) {
      seeded[a.id] = { points: a.awarded_points ?? 0, feedback: a.feedback ?? "" };
    }
    setGrades(seeded);
  }, [data]);

  async function releaseGrade() {
    if (!data?.attempt) return;
    for (const answer of data.answers) {
      const g = grades[answer.id];
      if (!g) continue;
      const { error } = await supabase
        .from("answers")
        .update({ awarded_points: g.points, feedback: g.feedback })
        .eq("id", answer.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    const total = data.answers.reduce((sum, a) => sum + (grades[a.id]?.points ?? 0), 0);
    const { error } = await supabase
      .from("attempts")
      .update({ total_score: total, status: "graded" })
      .eq("id", data.attempt.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Result released to the candidate");
    await queryClient.invalidateQueries();
  }

  if (!data?.attempt) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading attempt…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to console
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.profile?.full_name || data.profile?.email || "Candidate"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {data.attempt.assessments?.title} ·{" "}
            {data.attempt.submitted_at
              ? new Date(data.attempt.submitted_at).toLocaleString()
              : "not submitted"}
          </p>
        </div>
        <Badge variant={data.attempt.status === "graded" ? "default" : "secondary"}>
          {data.attempt.status}
        </Badge>
      </div>

      <div className="mt-8 space-y-4">
        {data.answers.map((a, index) => {
          const q = a.questions;
          const key = q
            ? Array.isArray(q.question_keys)
              ? q.question_keys[0]
              : q.question_keys
            : null;
          return (
            <Card key={a.id} className="shadow-panel">
              <CardHeader>
                <CardTitle className="text-base">
                  {index + 1}. {q?.prompt}
                </CardTitle>
                <CardDescription className="capitalize">
                  {q?.type === "mcq" ? "Multiple choice (auto-graded)" : q?.type} · max {q?.points}{" "}
                  pts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  {q?.type === "mcq" ? (
                    <span>
                      Selected option{" "}
                      {a.selected_option === null || a.selected_option === undefined
                        ? "—"
                        : String.fromCharCode(65 + a.selected_option)}
                      {key?.correct_option !== null && key?.correct_option !== undefined
                        ? ` · correct ${String.fromCharCode(65 + key.correct_option)}`
                        : ""}
                    </span>
                  ) : (
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {a.response || "(no answer)"}
                    </pre>
                  )}
                </div>
                {key?.model_answer && q?.type !== "mcq" && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Model answer: </span>
                    {key.model_answer}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor={`p-${a.id}`}>Points</Label>
                    <Input
                      id={`p-${a.id}`}
                      type="number"
                      min={0}
                      max={q?.points ?? 100}
                      value={grades[a.id]?.points ?? 0}
                      onChange={(e) =>
                        setGrades((g) => ({
                          ...g,
                          [a.id]: {
                            points: Number(e.target.value),
                            feedback: g[a.id]?.feedback ?? "",
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`f-${a.id}`}>Reviewer feedback</Label>
                    <Textarea
                      id={`f-${a.id}`}
                      rows={2}
                      maxLength={2000}
                      value={grades[a.id]?.feedback ?? ""}
                      onChange={(e) =>
                        setGrades((g) => ({
                          ...g,
                          [a.id]: { points: g[a.id]?.points ?? 0, feedback: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {data.answers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This candidate has not answered anything yet.
          </p>
        )}

        <div className="flex items-center justify-end gap-4">
          <span className="text-sm text-muted-foreground">
            Total {Object.values(grades).reduce((s, g) => s + (g.points || 0), 0)} /{" "}
            {data.attempt.max_score}
          </span>
          <Button onClick={releaseGrade}>Release result</Button>
        </div>
      </div>
    </AppShell>
  );
}
