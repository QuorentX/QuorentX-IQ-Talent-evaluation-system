import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  UserPlus,
  Mail,
  Copy,
  ClipboardCheck,
  BarChart3,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createStudentAccount,
  deleteStudentAccount,
  inviteCandidateToAssessment,
  resetStudentPassword,
  syncAssessmentAssignments,
} from "@/lib/admin.functions";
import { fetchCurrentUser, useCurrentUser } from "@/hooks/use-auth";
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
  beforeLoad: async () => {
    const user = await fetchCurrentUser();
    if (!user) throw redirect({ to: "/admin-login" });
    if (user.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Admin console — TalentGate" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Create MCQ assessments, invite candidates, and review results.",
      },
    ],
  }),
  component: AdminConsole,
});

type CredentialReveal = { email: string; password: string };

function AdminConsole() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const createStudent = useServerFn(createStudentAccount);
  const deleteStudent = useServerFn(deleteStudentAccount);
  const resetPassword = useServerFn(resetStudentPassword);
  const inviteToTest = useServerFn(inviteCandidateToAssessment);
  const syncAssignments = useServerFn(syncAssessmentAssignments);

  const isAdmin = user?.role === "admin";

  const { data } = useQuery({
    queryKey: ["admin-data"],
    enabled: isAdmin,
    queryFn: async () => {
      const [profiles, roles, assessments, assignments, attempts, questions] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("assessments").select("*").order("created_at", { ascending: false }),
        supabase.from("assignments").select("id, assessment_id, student_id, due_at"),
        supabase
          .from("attempts")
          .select("*, assessments(title)")
          .order("submitted_at", { ascending: false }),
        supabase.from("questions").select("assessment_id, type"),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        assessments: assessments.data ?? [],
        assignments: assignments.data ?? [],
        attempts: attempts.data ?? [],
        questions: questions.data ?? [],
      };
    },
  });

  const adminIds = new Set(
    (data?.roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
  );
  const students = (data?.profiles ?? []).filter((p) => !adminIds.has(p.id));
  const nameOf = (id: string) =>
    data?.profiles.find((p) => p.id === id)?.full_name ||
    data?.profiles.find((p) => p.id === id)?.email ||
    "Unknown";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-data"] });

  const [credentials, setCredentials] = useState<CredentialReveal | null>(null);

  const [studentForm, setStudentForm] = useState({ fullName: "", email: "" });
  const [studentOpen, setStudentOpen] = useState(false);
  const [studentBusy, setStudentBusy] = useState(false);

  const [testForm, setTestForm] = useState({
    title: "",
    description: "",
    instructions: "",
    duration: 60,
  });
  const [testOpen, setTestOpen] = useState(false);

  const [assignTestId, setAssignTestId] = useState<string | null>(null);
  const [assignSelection, setAssignSelection] = useState<string[]>([]);
  const [assignDueAt, setAssignDueAt] = useState("");

  const [inviteTestId, setInviteTestId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    dueAt: "",
    publish: true,
  });
  const [inviteBusy, setInviteBusy] = useState(false);

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

  const publishedCount = (data?.assessments ?? []).filter((t) => t.is_published).length;
  const gradedCount = (data?.attempts ?? []).filter((a) => a.status === "graded").length;
  const pendingReview = (data?.attempts ?? []).filter((a) => a.status === "submitted").length;

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setStudentBusy(true);
    try {
      const result = await createStudent({
        data: {
          fullName: studentForm.fullName.trim(),
          email: studentForm.email.trim(),
          sendEmail: true,
        },
      });
      setStudentForm({ fullName: "", email: "" });
      setStudentOpen(false);
      setCredentials({ email: result.email, password: result.password });
      if (result.emailStatus?.sent) {
        toast.success("Account created and invite email sent");
      } else if (result.emailStatus?.reason && result.emailStatus.reason !== "skipped") {
        toast.message(`Account created. Email not sent: ${result.emailStatus.reason}`);
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setStudentBusy(false);
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    const { data: created, error } = await supabase
      .from("assessments")
      .insert({
        title: testForm.title.trim(),
        description: testForm.description.trim(),
        instructions: testForm.instructions.trim(),
        duration_minutes: Number(testForm.duration) || 60,
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Test created — add MCQ questions next");
    setTestForm({ title: "", description: "", instructions: "", duration: 60 });
    setTestOpen(false);
    await refresh();
    if (created?.id) {
      window.location.href = `/admin/tests/${created.id}`;
    }
  }

  async function togglePublish(id: string, next: boolean) {
    const { error } = await supabase
      .from("assessments")
      .update({ is_published: next })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  async function saveAssignments() {
    if (!assignTestId) return;
    try {
      await syncAssignments({
        data: {
          assessmentId: assignTestId,
          studentIds: assignSelection,
          dueAt: assignDueAt || null,
          publish: true,
        },
      });
      toast.success("Assignments updated");
      setAssignTestId(null);
      setAssignDueAt("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save assignments");
    }
  }

  async function handleInviteToTest(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteTestId) return;
    setInviteBusy(true);
    try {
      const result = await inviteToTest({
        data: {
          assessmentId: inviteTestId,
          fullName: inviteForm.fullName.trim(),
          email: inviteForm.email.trim(),
          publish: inviteForm.publish,
          dueAt: inviteForm.dueAt || null,
          sendEmail: true,
        },
      });
      setInviteForm({ fullName: "", email: "", dueAt: "", publish: true });
      setInviteTestId(null);
      setCredentials({ email: result.email, password: result.password });
      if (result.emailStatus?.sent) {
        toast.success("Invite created and email sent");
      } else if (result.emailStatus?.reason && result.emailStatus.reason !== "skipped") {
        toast.message(`Invite created. Email not sent: ${result.emailStatus.reason}`);
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not invite candidate");
    } finally {
      setInviteBusy(false);
    }
  }

  const inviteTestTitle =
    data?.assessments.find((t) => t.id === inviteTestId)?.title ?? "this assessment";

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
          <p className="mt-1 text-muted-foreground">
            Create MCQ tests, add users with auto passwords, assign by date, and review scores.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardDescription>Candidates</CardDescription>
            <CardTitle className="text-2xl">{students.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardDescription>Tests published</CardDescription>
            <CardTitle className="text-2xl">
              {publishedCount}/{data?.assessments.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardDescription>Pending review</CardDescription>
            <CardTitle className="text-2xl">{pendingReview}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardDescription>Graded results</CardDescription>
            <CardTitle className="text-2xl">{gradedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="tests">
        <TabsList>
          <TabsTrigger value="tests">Assessments</TabsTrigger>
          <TabsTrigger value="students">Users</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Assessments</CardTitle>
                <CardDescription>
                  Create a test, add MCQs, invite users with auto-generated passwords and a due
                  date/time.
                </CardDescription>
              </div>
              <Dialog open={testOpen} onOpenChange={setTestOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1.5 h-4 w-4" /> New MCQ test
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New assessment</DialogTitle>
                    <DialogDescription>
                      You will add multiple-choice questions on the next screen.
                    </DialogDescription>
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
                      <Button type="submit">Create &amp; add questions</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.assessments.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">No assessments yet.</p>
              )}
              {data?.assessments.map((t) => {
                const assigned = (data.assignments ?? []).filter((a) => a.assessment_id === t.id);
                const qCount = (data.questions ?? []).filter(
                  (q) => q.assessment_id === t.id,
                ).length;
                const mcqCount = (data.questions ?? []).filter(
                  (q) => q.assessment_id === t.id && q.type === "mcq",
                ).length;
                return (
                  <div key={t.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.duration_minutes} min · {qCount} questions ({mcqCount} MCQ) ·{" "}
                          {assigned.length} assigned
                        </p>
                        {assigned.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {assigned
                              .map((a) => {
                                const due = a.due_at
                                  ? ` (due ${new Date(a.due_at).toLocaleString()})`
                                  : "";
                                return `${nameOf(a.student_id)}${due}`;
                              })
                              .slice(0, 3)
                              .join(" · ")}
                            {assigned.length > 3 ? ` +${assigned.length - 3} more` : ""}
                          </p>
                        )}
                      </div>
                      <Badge variant={t.is_published ? "default" : "outline"}>
                        {t.is_published ? "Published" : "Draft"}
                      </Badge>
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/admin/tests/$testId" params={{ testId: t.id }}>
                          Questions
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/tests/$testId/results" params={{ testId: t.id }}>
                          Results
                        </Link>
                      </Button>
                      <Button size="sm" onClick={() => setInviteTestId(t.id)}>
                        <Mail className="mr-1.5 h-4 w-4" /> Invite user
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssignTestId(t.id);
                          setAssignSelection(assigned.map((a) => a.student_id));
                          const firstDue = assigned.find((a) => a.due_at)?.due_at;
                          setAssignDueAt(
                            firstDue ? new Date(firstDue).toISOString().slice(0, 16) : "",
                          );
                        }}
                      >
                        Assign existing
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
                          const { error } = await supabase
                            .from("assessments")
                            .delete()
                            .eq("id", t.id);
                          if (error) {
                            toast.error(error.message);
                            return;
                          }
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
                <DialogTitle>Assign existing users</DialogTitle>
                <DialogDescription>
                  Select candidates and set a shared due date/time for this test.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="assign-due">Due date &amp; time</Label>
                <Input
                  id="assign-due"
                  type="datetime-local"
                  value={assignDueAt}
                  onChange={(e) => setAssignDueAt(e.target.value)}
                />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {students.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No users yet — use Invite user to create one with an auto password.
                  </p>
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
                <Button onClick={saveAssignments}>Save &amp; publish</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={!!inviteTestId}
            onOpenChange={(o) => {
              if (!o) {
                setInviteTestId(null);
                setInviteForm({ fullName: "", email: "", dueAt: "", publish: true });
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite candidate to {inviteTestTitle}</DialogTitle>
                <DialogDescription>
                  A temporary password is generated automatically. Share it with the candidate so
                  they can sign in and take this test — no registration needed.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteToTest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-name">Full name</Label>
                  <Input
                    id="inv-name"
                    required
                    maxLength={120}
                    value={inviteForm.fullName}
                    onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-email">Email</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    required
                    maxLength={255}
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-due">Due date &amp; time</Label>
                  <Input
                    id="inv-due"
                    type="datetime-local"
                    value={inviteForm.dueAt}
                    onChange={(e) => setInviteForm({ ...inviteForm, dueAt: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                  <Checkbox
                    checked={inviteForm.publish}
                    onCheckedChange={(checked) =>
                      setInviteForm({ ...inviteForm, publish: checked === true })
                    }
                  />
                  <span>Publish so they can take the test after login</span>
                </label>
                <DialogFooter>
                  <Button type="submit" disabled={inviteBusy}>
                    {inviteBusy ? "Creating…" : "Create user, assign & show password"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="students" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Platform users</CardTitle>
                <CardDescription>
                  Add a user by email — a password is generated automatically for you to share.
                </CardDescription>
              </div>
              <Dialog open={studentOpen} onOpenChange={setStudentOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-1.5 h-4 w-4" /> Add user
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add platform user</DialogTitle>
                    <DialogDescription>
                      No registration form for candidates. You will see the auto password once.
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
                        onChange={(e) =>
                          setStudentForm({ ...studentForm, fullName: e.target.value })
                        }
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
                    <DialogFooter>
                      <Button type="submit" disabled={studentBusy}>
                        {studentBusy ? "Creating…" : "Create & show password"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {students.length === 0 && (
                <p className="text-sm text-muted-foreground">No users yet.</p>
              )}
              {students.map((s) => {
                const theirTests = (data?.assignments ?? [])
                  .filter((a) => a.student_id === s.id)
                  .map((a) => {
                    const title = data?.assessments.find((t) => t.id === a.assessment_id)?.title;
                    const due = a.due_at ? ` · due ${new Date(a.due_at).toLocaleString()}` : "";
                    return title ? `${title}${due}` : null;
                  })
                  .filter(Boolean);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">{s.full_name || "Unnamed"}</p>
                      <p className="text-sm text-muted-foreground">{s.email}</p>
                      {theirTests.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Assigned: {theirTests.join("; ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Reset password"
                        onClick={async () => {
                          if (!confirm(`Reset password for ${s.email}?`)) return;
                          try {
                            const result = await resetPassword({
                              data: { userId: s.id, sendEmail: true },
                            });
                            setCredentials({ email: result.email, password: result.password });
                            if (result.emailStatus?.sent) {
                              toast.success("Password reset and emailed");
                            } else if (
                              result.emailStatus?.reason &&
                              result.emailStatus.reason !== "skipped"
                            ) {
                              toast.message(
                                `Password reset. Email not sent: ${result.emailStatus.reason}`,
                              );
                            } else {
                              toast.success("Password reset — copy credentials below");
                            }
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not reset");
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
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
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> Attempts &amp; scores
              </CardTitle>
              <CardDescription>
                MCQs are auto-scored on submit. Review any remaining answers and release results.
              </CardDescription>
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
                  <Badge variant={a.status === "graded" ? "default" : "secondary"}>
                    {a.status}
                  </Badge>
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
      </Tabs>

      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Candidate credentials
            </DialogTitle>
            <DialogDescription>
              Copy these once. Invite email is sent when RESEND_API_KEY is set; otherwise share the
              password manually. It is not stored in plain text after this dialog closes.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{credentials.email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(credentials.email);
                    toast.success("Email copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Temporary password</p>
                  <p className="font-mono font-semibold tracking-wide">{credentials.password}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(credentials.password);
                    toast.success("Password copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                className="w-full"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `Email: ${credentials.email}\nPassword: ${credentials.password}`,
                  );
                  toast.success("Credentials copied");
                }}
              >
                Copy both
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
