import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Users, Trophy, Clock3, BarChart3, Download, Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentUser } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/tests/$testId/results")({
  beforeLoad: async () => {
    const user = await fetchCurrentUser();
    if (!user) throw redirect({ to: "/admin-login" });
    if (user.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Assessment results — TalentGate" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Per-assessment results dashboard for administrators." },
    ],
  }),
  component: AssessmentResultsDashboard,
});

function AssessmentResultsDashboard() {
  const { testId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["assessment-results", testId],
    queryFn: async () => {
      const [assessment, assignments, attempts, profiles] = await Promise.all([
        supabase.from("assessments").select("*").eq("id", testId).maybeSingle(),
        supabase.from("assignments").select("id, student_id, due_at").eq("assessment_id", testId),
        supabase
          .from("attempts")
          .select("*")
          .eq("assessment_id", testId)
          .order("submitted_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      return {
        assessment: assessment.data,
        assignments: assignments.data ?? [],
        attempts: attempts.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  const nameOf = (id: string) => {
    const p = data?.profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const attempts = data?.attempts ?? [];
  const assigned = data?.assignments.length ?? 0;
  const submitted = attempts.filter((a) => a.status !== "in_progress");
  const graded = attempts.filter((a) => a.status === "graded");
  const inProgress = attempts.filter((a) => a.status === "in_progress");
  const avgScore =
    graded.length > 0
      ? graded.reduce((s, a) => s + (a.max_score ? a.total_score / a.max_score : 0), 0) /
        graded.length
      : 0;

  const distribution = [
    { band: "0–20%", count: 0 },
    { band: "21–40%", count: 0 },
    { band: "41–60%", count: 0 },
    { band: "61–80%", count: 0 },
    { band: "81–100%", count: 0 },
  ];
  for (const a of graded) {
    const pct = a.max_score ? (a.total_score / a.max_score) * 100 : 0;
    if (pct <= 20) distribution[0]!.count += 1;
    else if (pct <= 40) distribution[1]!.count += 1;
    else if (pct <= 60) distribution[2]!.count += 1;
    else if (pct <= 80) distribution[3]!.count += 1;
    else distribution[4]!.count += 1;
  }

  const notStarted = (data?.assignments ?? []).filter(
    (asg) => !attempts.some((a) => a.student_id === asg.student_id),
  );

  function exportCsv() {
    const title = data?.assessment?.title ?? "assessment";
    const rows = [
      ["Candidate", "Email", "Status", "Score", "Max", "Percent", "Started", "Submitted"],
      ...attempts.map((a) => {
        const p = data?.profiles.find((x) => x.id === a.student_id);
        const pct = a.max_score ? Math.round((a.total_score / a.max_score) * 100) : "";
        return [
          p?.full_name || "",
          p?.email || "",
          a.status,
          String(a.total_score ?? ""),
          String(a.max_score ?? ""),
          pct === "" ? "" : `${pct}%`,
          a.started_at ? new Date(a.started_at).toISOString() : "",
          a.submitted_at ? new Date(a.submitted_at).toISOString() : "",
        ];
      }),
      ...notStarted.map((asg) => {
        const p = data?.profiles.find((x) => x.id === asg.student_id);
        return [p?.full_name || "", p?.email || "", "not_started", "", "", "", "", ""];
      }),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, "_").slice(0, 60)}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  function exportPdf() {
    const title = data?.assessment?.title ?? "Assessment";
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) {
      toast.error("Allow pop-ups to export PDF");
      return;
    }
    const bodyRows = [
      ...attempts.map((a) => {
        const p = data?.profiles.find((x) => x.id === a.student_id);
        return `<tr><td>${p?.full_name || ""}</td><td>${p?.email || ""}</td><td>${a.status}</td><td>${a.total_score}/${a.max_score}</td></tr>`;
      }),
      ...notStarted.map((asg) => {
        const p = data?.profiles.find((x) => x.id === asg.student_id);
        return `<tr><td>${p?.full_name || ""}</td><td>${p?.email || ""}</td><td>not started</td><td>—</td></tr>`;
      }),
    ].join("");
    win.document.write(`<!doctype html><html><head><title>${title} results</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head>
      <body><h1>${title} — results</h1>
      <p>Assigned ${assigned} · Submitted ${submitted.length} · Avg ${graded.length ? Math.round(avgScore * 100) + "%" : "—"}</p>
      <table><thead><tr><th>Candidate</th><th>Email</th><th>Status</th><th>Score</th></tr></thead>
      <tbody>${bodyRows}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/tests/$testId" params={{ testId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to questions
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data?.assessment?.title ?? "Assessment"} — results
          </h1>
          <p className="mt-1 text-muted-foreground">
            Live dashboard of assignments, attempts and scores for this assessment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={exportCsv}
            disabled={isLoading}
          >
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={exportPdf}
            disabled={isLoading}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-panel">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Assigned
                </CardDescription>
                <CardTitle className="text-2xl">{assigned}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-panel">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" /> Submitted
                </CardDescription>
                <CardTitle className="text-2xl">{submitted.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-panel">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" /> Avg score
                </CardDescription>
                <CardTitle className="text-2xl">
                  {graded.length ? `${Math.round(avgScore * 100)}%` : "—"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-panel">
              <CardHeader className="pb-2">
                <CardDescription>In progress / not started</CardDescription>
                <CardTitle className="text-2xl">
                  {inProgress.length} / {notStarted.length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card className="shadow-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" /> Score distribution
                </CardTitle>
                <CardDescription>Graded attempts only</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {graded.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No graded attempts yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="band" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-panel">
              <CardHeader>
                <CardTitle className="text-base">Completion</CardTitle>
                <CardDescription>
                  {assigned
                    ? `${Math.round((submitted.length / assigned) * 100)}% of assigned candidates submitted`
                    : "No candidates assigned"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between rounded-md border border-border p-3">
                  <span>Not started</span>
                  <span className="font-medium">{notStarted.length}</span>
                </div>
                <div className="flex justify-between rounded-md border border-border p-3">
                  <span>In progress</span>
                  <span className="font-medium">{inProgress.length}</span>
                </div>
                <div className="flex justify-between rounded-md border border-border p-3">
                  <span>Awaiting review</span>
                  <span className="font-medium">
                    {attempts.filter((a) => a.status === "submitted").length}
                  </span>
                </div>
                <div className="flex justify-between rounded-md border border-border p-3">
                  <span>Graded</span>
                  <span className="font-medium">{graded.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-base">Candidate attempts</CardTitle>
              <CardDescription>Open any row to review coding and written answers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {attempts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No attempts yet for this assessment.
                </p>
              )}
              {attempts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{nameOf(a.student_id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.submitted_at
                        ? `Submitted ${new Date(a.submitted_at).toLocaleString()}`
                        : `Started ${new Date(a.started_at).toLocaleString()}`}
                    </p>
                  </div>
                  <Badge variant={a.status === "graded" ? "default" : "secondary"}>
                    {a.status}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums">
                    {a.total_score}/{a.max_score}
                  </span>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/admin/attempts/$attemptId" params={{ attemptId: a.id }}>
                      Review
                    </Link>
                  </Button>
                </div>
              ))}

              {notStarted.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Not started</p>
                  {notStarted.map((asg) => (
                    <div
                      key={asg.id}
                      className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 text-sm"
                    >
                      <span>{nameOf(asg.student_id)}</span>
                      <span className="text-muted-foreground">
                        {asg.due_at
                          ? `Due ${new Date(asg.due_at).toLocaleString()}`
                          : "No due date"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
