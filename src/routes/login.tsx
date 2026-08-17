import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isPrimaryAdminEmail } from "@/lib/admin-config";
import { currentUserQueryKey, fetchCurrentUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Candidate login — TalentGate" },
      {
        name: "description",
        content: "Candidate sign-in for assigned assessments. No registration required.",
      },
      { property: "og:title", content: "Candidate login — TalentGate" },
      { property: "og:description", content: "Sign in with credentials issued by your recruiter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CandidateLoginPage,
});

function CandidateLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const current = await fetchCurrentUser();
      if (current?.role === "admin") {
        navigate({ to: "/admin", replace: true });
        return;
      }
      if (current) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (isPrimaryAdminEmail(trimmed)) {
      toast.error("Administrators must use the Admin login portal");
      navigate({ to: "/admin-login" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) throw new Error(error.message);

      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      const current = await fetchCurrentUser();

      if (current?.role === "admin") {
        await supabase.auth.signOut();
        queryClient.clear();
        toast.error("Use the Admin login portal");
        navigate({ to: "/admin-login", replace: true });
        return;
      }

      toast.success("Welcome");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-[42%] overflow-hidden bg-hero-gradient text-navy-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-5 w-5" /> TalentGate
        </Link>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] opacity-70">Candidate portal</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            Take the tests assigned to you
          </h1>
          <p className="mt-3 max-w-sm text-sm opacity-80">
            Sign in with the email and temporary password from your recruiter. No registration
            needed.
          </p>
        </div>
        <p className="text-xs opacity-60">Invite-only · Assigned assessments only</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-6 flex items-center gap-2 font-semibold text-foreground lg:hidden"
          >
            <GraduationCap className="h-5 w-5" /> TalentGate
          </Link>
          <Card className="shadow-panel">
            <CardHeader>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <CardTitle>Candidate login</CardTitle>
              <CardDescription>
                Use the credentials shared with you to open your dashboard and start assigned tests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="candidate-email">Email</Label>
                  <Input
                    id="candidate-email"
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidate-password">Password</Label>
                  <Input
                    id="candidate-password"
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in to my tests"}
                </Button>
              </form>
              <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
                <p>Accounts are created by the hiring team — there is no self-registration.</p>
                <p>
                  <Link to="/" className="underline-offset-2 hover:underline">
                    Back to portal choice
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
