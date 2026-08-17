import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardList, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard — TalentGate" },
      {
        name: "description",
        content: "Your assigned assessments, results and interview schedule.",
      },
      { property: "og:title", content: "My dashboard — TalentGate" },
      { property: "og:description", content: "Assigned assessments, results and interviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [assignments, attempts, interviews] = await Promise.all([
        supabase
          .from("assignments")
          .select("id, due_at, assessments(id, title, description, duration_minutes, is_published)")
          .eq("student_id", user!.id),
        supabase.from("attempts").select("*").eq("student_id", user!.id),
        supabase
          .from("interviews")
          .select("*")
          .eq("student_id", user!.id)
          .order("scheduled_at", { ascending: true }),
      ]);
      return {
        assignments: assignments.data ?? [],
        attempts: attempts.data ?? [],
        interviews: interviews.data ?? [],
      };
    },
  });

  const attemptFor = (assessmentId: string) =>
    data?.attempts.find((a) => a.assessment_id === assessmentId);

  const graded = (data?.attempts ?? []).filter((a) => a.status === "graded");

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Your assessments, results and upcoming interviews.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-primary" /> Assigned assessments
              </CardTitle>
              <CardDescription>Published papers assigned to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && (data?.assignments.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No assessments assigned yet.</p>
              )}
              {data?.assignments.map((assignment) => {
                const test = assignment.assessments;
                if (!test || !test.is_published) return null;
                const attempt = attemptFor(test.id);
                const overdue =
                  !!assignment.due_at &&
                  new Date(assignment.due_at).getTime() < Date.now() &&
                  (!attempt || attempt.status === "in_progress");
                const canStart = !overdue && (!attempt || attempt.status === "in_progress");
                return (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{test.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {test.duration_minutes} minutes
                        {assignment.due_at
                          ? ` · due ${new Date(assignment.due_at).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    {attempt && attempt.status !== "in_progress" ? (
                      <Badge variant="secondary">
                        {attempt.status === "graded"
                          ? `Scored ${attempt.total_score}/${attempt.max_score}`
                          : "Submitted"}
                      </Badge>
                    ) : overdue ? (
                      <Badge variant="destructive">Past due</Badge>
                    ) : canStart ? (
                      <Button asChild size="sm">
                        <Link to="/assessment/$assessmentId" params={{ assessmentId: test.id }}>
                          {attempt ? "Resume" : "Start"}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-primary" /> Results
              </CardTitle>
              <CardDescription>Scores released after review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {graded.length === 0 && (
                <p className="text-sm text-muted-foreground">No graded results yet.</p>
              )}
              {graded.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <span className="text-sm">
                    Submitted{" "}
                    {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "—"}
                  </span>
                  <span className="font-semibold">
                    {attempt.total_score}/{attempt.max_score}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit shadow-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" /> Interviews
            </CardTitle>
            <CardDescription>Slots scheduled by the hiring team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.interviews.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            )}
            {data?.interviews.map((interview) => (
              <div key={interview.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{interview.title}</p>
                  <Badge variant={interview.status === "cancelled" ? "destructive" : "secondary"}>
                    {interview.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(interview.scheduled_at).toLocaleString()} · {interview.mode}
                </p>
                {interview.location && (
                  <p className="mt-1 break-all text-sm text-primary">{interview.location}</p>
                )}
                {interview.notes && (
                  <p className="mt-2 text-sm text-muted-foreground">{interview.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
