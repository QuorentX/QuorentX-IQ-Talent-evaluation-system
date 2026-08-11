import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createStudentAccount, deleteStudentAccount } from "@/lib/admin.functions";
import { useCurrentUser } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin console — TalentGate" },
      {
        name: "description",
        content: "Manage candidates, build assessments, review results and schedule interviews.",
      },
      { property: "og:title", content: "Admin console — TalentGate" },
      { property: "og:description", content: "Candidate, assessment, result and interview management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminConsole,
});

function AdminConsole() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const createStudent = useServerFn(createStudentAccount);
  const deleteStudent = useServerFn(deleteStudentAccount);

  const isAdmin = user?.role === "admin";

  const { data } = useQuery({
    queryKey: ["admin-data"],
    enabled: isAdmin,
    queryFn: async () => {
      const [profiles, roles, assessments, assignments, attempts, interviews] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("assessments").select("*").order("created_at", { ascending: false }),
        supabase.from("assignments").select("id, assessment_id, student_id, due_at"),
        supabase
          .from("attempts")
          .select("*, assessments(title)")
          .order("submitted_at", { ascending: false }),
        supabase.from("interviews").select("*").order("scheduled_at", { ascending: true }),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        assessments: assessments.data ?? [],
        assignments: assignments.data ?? [],
        attempts: attempts.data ?? [],
        interviews: interviews.data ?? [],
      };
    },
  });

  const adminIds = new Set((data?.roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
  const students = (data?.profiles ?? []).filter((p) => !adminIds.has(p.id));
  const nameOf = (id: string) =>
    data?.profiles.find((p) => p.id === id)?.full_name ||
    data?.profiles.find((p) => p.id === id)?.email ||
    "Unknown";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-data"] });

  // ----- student form state
  const [studentForm, setStudentForm] = useState({ fullName: "", email: "", password: "" });
  const [studentOpen, setStudentOpen] = useState(false);

  // ----- test form state
  const [testForm, setTestForm] = useState({
    title: "",
    description: "",
    instructions: "",
    duration: 60,
  });
  const [testOpen, setTestOpen] = useState(false);

  // ----- assignment state
  const [assignTestId, setAssignTestId] = useState<string | null>(null);
  const [assignSelection, setAssignSelection] = useState<string[]>([]);

  // ----- interview state
  const [interviewForm, setInterviewForm] = useState({
    studentId: "",
    title: "Technical interview",
    scheduledAt: "",
    mode: "video",
    location: "",
    notes: "",
  });
  const [interviewOpen, setInterviewOpen] = useState(false);

  if (userLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Administrators only</CardTitle>
            <CardDescription>Your account does not have access to this console.</CardDescription>
          </CardHeader>
        </Card>
      </AppShell>
    );
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createStudent({
        data: {
          fullName: studentForm.fullName.trim(),
          email: studentForm.email.trim(),
          password: studentForm.password,
        },
      });
      toast.success("Student account created");
      setStudentForm({ fullName: "", email: "", password: "" });
      setStudentOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("assessments").insert({
      title: testForm.title.trim(),
      description: testForm.description.trim(),
      instructions: testForm.instructions.trim(),
      duration_minutes: Number(testForm.duration) || 60,
      created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Assessment created");
    setTestForm({ title: "", description: "", instructions: "", duration: 60 });
    setTestOpen(false);
    await refresh();
  }

  async function togglePublish(id: string, next: boolean) {
    const { error } = await supabase.from("assessments").update({ is_published: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refresh();
  }

  async function saveAssignments() {
    if (!assignTestId) return;
    const existing = (data?.assignments ?? []).filter((a) => a.assessment_id === assignTestId);
    const toAdd = assignSelection.filter((id) => !existing.some((a) => a.student_id === id));
    const toRemove = existing.filter((a) => !assignSelection.includes(a.student_id));
    if (toAdd.length) {
      const { error } = await supabase
        .from("assignments")
        .insert(toAdd.map((student_id) => ({ assessment_id: assignTestId, student_id })));
      if (error) { toast.error(error.message); return; }
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from("assignments")
        .delete()
        .in("id", toRemove.map((a) => a.id));
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Assignments updated");
    setAssignTestId(null);
    await refresh();
  }

  async function handleCreateInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!interviewForm.studentId || !interviewForm.scheduledAt) {
      { toast.error("Pick a candidate and a date"); return; }
    }
    const { error } = await supabase.from("interviews").insert({
      student_id: interviewForm.studentId,
      title: interviewForm.title.trim() || "Interview",
      scheduled_at: new Date(interviewForm.scheduledAt).toISOString(),
      mode: interviewForm.mode,
      location: interviewForm.location.trim(),
      notes: interviewForm.notes.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Interview scheduled");
    setInterviewOpen(false);
    setInterviewForm({
      studentId: "",
      title: "Technical interview",
      scheduledAt: "",
      mode: "video",
      location: "",
      notes: "",
    });
    await refresh();
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-1 text-muted-foreground">
          Candidates, assessments, results and interview scheduling.
        </p>
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="tests">Assessments</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
        </TabsList>

        {/* STUDENTS */}
        <TabsContent value="students" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Candidates</CardTitle>
                <CardDescription>Invite-only accounts created by administrators.</CardDescription>
              </div>
              <Dialog open={studentOpen} onOpenChange={setStudentOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-1.5 h-4 w-4" /> Add student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a student account</DialogTitle>
                    <DialogDescription>
                      Share these credentials with the candidate.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateStudent} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="s-name">Full name</Label>
                      <Input
                        id="s-name"
                        required
                        maxLength={120}
                        value={studentForm.fullName}
                        onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s-email">Email</Label>
                      <Input
                        id="s-email"
                        type="email"
                        required
                        maxLength={255}
                        value={studentForm.email}
                        onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s-pass">Temporary password</Label>
                      <Input
                        id="s-pass"
                        required
                        minLength={8}
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create account</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {students.length === 0 && (
                <p className="text-sm text-muted-foreground">No candidates yet.</p>
              )}
              {students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div>
                    <p className="font-medium">{s.full_name || "Unnamed"}</p>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete ${s.email}? This removes all their data.`)) return;
                      try {
                        await deleteStudent({ data: { userId: s.id } });
                        toast.success("Account deleted");
                        await refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not delete");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TESTS */}
        <TabsContent value="tests" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Assessments</CardTitle>
                <CardDescription>Build papers, then assign and publish them.</CardDescription>
              </div>
              <Dialog open={testOpen} onOpenChange={setTestOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-4 w-4" /> New assessment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New assessment</DialogTitle>
                    <DialogDescription>You can add questions in the next step.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateTest} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="t-title">Title</Label>
                      <Input
                        id="t-title"
                        required
                        maxLength={160}
                        value={testForm.title}
                        onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-desc">Description</Label>
                      <Textarea
                        id="t-desc"
                        maxLength={600}
                        value={testForm.description}
                        onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-inst">Instructions</Label>
                      <Textarea
                        id="t-inst"
                        maxLength={2000}
                        value={testForm.instructions}
                        onChange={(e) => setTestForm({ ...testForm, instructions: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-dur">Duration (minutes)</Label>
                      <Input
                        id="t-dur"
                        type="number"
                        min={5}
                        max={480}
                        value={testForm.duration}
                        onChange={(e) =>
                          setTestForm({ ...testForm, duration: Number(e.target.value) })
                        }
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.assessments.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No assessments yet.</p>
              )}
              {data?.assessments.map((t) => {
                const assigned = (data.assignments ?? []).filter((a) => a.assessment_id === t.id);
                return (
                  <div key={t.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.duration_minutes} min · {assigned.length} assigned
                        </p>
                      </div>
                      <Badge variant={t.is_published ? "default" : "outline"}>
                        {t.is_published ? "Published" : "Draft"}
                      </Badge>
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/admin/tests/$testId" params={{ testId: t.id }}>
                          Questions
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssignTestId(t.id);
                          setAssignSelection(assigned.map((a) => a.student_id));
                        }}
                      >
                        Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => togglePublish(t.id, !t.is_published)}
                      >
                        {t.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Delete "${t.title}" and all its attempts?`)) return;
                          const { error } = await supabase.from("assessments").delete().eq("id", t.id);
                          if (error) { toast.error(error.message); return; }
                          await refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Dialog open={!!assignTestId} onOpenChange={(o) => !o && setAssignTestId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign candidates</DialogTitle>
                <DialogDescription>
                  Only assigned candidates can see and sit this assessment.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {students.length === 0 && (
                  <p className="text-sm text-muted-foreground">Add candidates first.</p>
                )}
                {students.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <Checkbox
                      checked={assignSelection.includes(s.id)}
                      onCheckedChange={(checked) =>
                        setAssignSelection((prev) =>
                          checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span>
                      {s.full_name || s.email}
                      <span className="ml-2 text-muted-foreground">{s.email}</span>
                    </span>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={saveAssignments}>Save assignments</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* RESULTS */}
        <TabsContent value="results" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="text-base">Attempts &amp; scores</CardTitle>
              <CardDescription>Review written and coding answers to release a score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.attempts.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No attempts yet.</p>
              )}
              {data?.attempts.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{nameOf(a.student_id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.assessments?.title ?? "Assessment"} ·{" "}
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "in progress"}
                    </p>
                  </div>
                  <Badge variant={a.status === "graded" ? "default" : "secondary"}>{a.status}</Badge>
                  <span className="text-sm font-semibold">
                    {a.total_score}/{a.max_score}
                  </span>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/admin/attempts/$attemptId" params={{ attemptId: a.id }}>
                      Review
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTERVIEWS */}
        <TabsContent value="interviews" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Interview schedule</CardTitle>
                <CardDescription>Slots appear instantly on the candidate dashboard.</CardDescription>
              </div>
              <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <CalendarPlus className="mr-1.5 h-4 w-4" /> Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule an interview</DialogTitle>
                    <DialogDescription>Pick a candidate, time and meeting details.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateInterview} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="i-student">Candidate</Label>
                      <select
                        id="i-student"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={interviewForm.studentId}
                        onChange={(e) =>
                          setInterviewForm({ ...interviewForm, studentId: e.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name || s.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="i-title">Title</Label>
                      <Input
                        id="i-title"
                        maxLength={120}
                        value={interviewForm.title}
                        onChange={(e) => setInterviewForm({ ...interviewForm, title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="i-when">Date &amp; time</Label>
                        <Input
                          id="i-when"
                          type="datetime-local"
                          value={interviewForm.scheduledAt}
                          onChange={(e) =>
                            setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="i-mode">Mode</Label>
                        <select
                          id="i-mode"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={interviewForm.mode}
                          onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                        >
                          <option value="video">Video</option>
                          <option value="phone">Phone</option>
                          <option value="onsite">On-site</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="i-loc">Meeting link or address</Label>
                      <Input
                        id="i-loc"
                        maxLength={400}
                        value={interviewForm.location}
                        onChange={(e) =>
                          setInterviewForm({ ...interviewForm, location: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="i-notes">Notes for the candidate</Label>
                      <Textarea
                        id="i-notes"
                        maxLength={1000}
                        value={interviewForm.notes}
                        onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Schedule</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.interviews.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No interviews scheduled.</p>
              )}
              {data?.interviews.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {nameOf(i.student_id)} · {i.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(i.scheduled_at).toLocaleString()} · {i.mode}
                      {i.location ? ` · ${i.location}` : ""}
                    </p>
                  </div>
                  <Badge variant={i.status === "cancelled" ? "destructive" : "secondary"}>
                    {i.status}
                  </Badge>
                  {i.status === "scheduled" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await supabase
                            .from("interviews")
                            .update({ status: "completed" })
                            .eq("id", i.id);
                          await refresh();
                        }}
                      >
                        Mark done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await supabase
                            .from("interviews")
                            .update({ status: "cancelled" })
                            .eq("id", i.id);
                          await refresh();
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
