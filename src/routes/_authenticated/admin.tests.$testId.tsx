import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/tests/$testId")({
  head: () => ({
    meta: [
      { title: "Question builder — TalentGate" },
      { name: "description", content: "Add multiple-choice, coding and written questions to an assessment." },
      { property: "og:title", content: "Question builder — TalentGate" },
      { property: "og:description", content: "Build the question paper for a company assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuestionBuilder,
});

type QType = "mcq" | "coding" | "written";

const emptyForm = {
  type: "mcq" as QType,
  prompt: "",
  points: 1,
  language: "",
  options: ["", "", "", ""],
  correctOption: 0,
  modelAnswer: "",
};

function QuestionBuilder() {
  const { testId } = Route.useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data } = useQuery({
    queryKey: ["test-builder", testId],
    queryFn: async () => {
      const [assessment, questions] = await Promise.all([
        supabase.from("assessments").select("*").eq("id", testId).maybeSingle(),
        supabase
          .from("questions")
          .select("*, question_keys(correct_option, model_answer)")
          .eq("assessment_id", testId)
          .order("position", { ascending: true }),
      ]);
      return { assessment: assessment.data, questions: questions.data ?? [] };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["test-builder", testId] });

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!form.prompt.trim()) { toast.error("Add a question prompt"); return; }
    const options = form.type === "mcq" ? form.options.map((o) => o.trim()).filter(Boolean) : [];
    if (form.type === "mcq" && options.length < 2) { toast.error("Add at least two options"); return; }

    const { data: inserted, error } = await supabase
      .from("questions")
      .insert({
        assessment_id: testId,
        type: form.type,
        prompt: form.prompt.trim(),
        options,
        language: form.language.trim(),
        points: Number(form.points) || 1,
        position: (data?.questions.length ?? 0) + 1,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }

    const { error: keyError } = await supabase.from("question_keys").insert({
      question_id: inserted.id,
      correct_option: form.type === "mcq" ? form.correctOption : null,
      model_answer: form.type === "mcq" ? "" : form.modelAnswer.trim(),
    });
    if (keyError) { toast.error(keyError.message); return; }

    toast.success("Question added");
    setForm(emptyForm);
    await refresh();
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to console
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight">
        {data?.assessment?.title ?? "Assessment"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {data?.questions.length ?? 0} question{(data?.questions.length ?? 0) === 1 ? "" : "s"} ·{" "}
        {(data?.questions ?? []).reduce((sum, q) => sum + q.points, 0)} total points
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {(data?.questions.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          )}
          {data?.questions.map((q, index) => {
            const key = Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys;
            return (
              <Card key={q.id} className="shadow-panel">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3 text-base">
                    <span>
                      {index + 1}. {q.prompt}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{q.points} pt</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await supabase.from("questions").delete().eq("id", q.id);
                          await refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </CardTitle>
                  <CardDescription className="capitalize">
                    {q.type === "mcq" ? "Multiple choice" : q.type}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  {q.type === "mcq" ? (
                    <ul className="space-y-1">
                      {((q.options as string[]) ?? []).map((o, i) => (
                        <li
                          key={i}
                          className={
                            key?.correct_option === i ? "font-medium text-primary" : "text-muted-foreground"
                          }
                        >
                          {String.fromCharCode(65 + i)}. {o}
                          {key?.correct_option === i ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {key?.model_answer ? `Model answer: ${key.model_answer}` : "Manually reviewed."}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit shadow-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Add a question</CardTitle>
            <CardDescription>Multiple choice is graded automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addQuestion} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="q-type">Type</Label>
                <select
                  id="q-type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as QType })}
                >
                  <option value="mcq">Multiple choice</option>
                  <option value="coding">Coding</option>
                  <option value="written">Written answer</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-prompt">Prompt</Label>
                <Textarea
                  id="q-prompt"
                  rows={3}
                  maxLength={4000}
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                />
              </div>

              {form.type === "mcq" ? (
                <div className="space-y-2">
                  <Label>Options (select the correct one)</Label>
                  {form.options.map((option, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
                        checked={form.correctOption === i}
                        onChange={() => setForm({ ...form, correctOption: i })}
                        className="accent-[var(--primary)]"
                      />
                      <Input
                        maxLength={300}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={option}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[i] = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {form.type === "coding" && (
                    <div className="space-y-2">
                      <Label htmlFor="q-lang">Language</Label>
                      <Input
                        id="q-lang"
                        maxLength={40}
                        placeholder="e.g. Python"
                        value={form.language}
                        onChange={(e) => setForm({ ...form, language: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="q-model">Model answer (reviewers only)</Label>
                    <Textarea
                      id="q-model"
                      rows={4}
                      maxLength={4000}
                      value={form.modelAnswer}
                      onChange={(e) => setForm({ ...form, modelAnswer: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="q-points">Points</Label>
                <Input
                  id="q-points"
                  type="number"
                  min={1}
                  max={100}
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                />
              </div>
              <Button type="submit" className="w-full">
                <Plus className="mr-1.5 h-4 w-4" /> Add question
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
