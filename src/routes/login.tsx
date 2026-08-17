import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { QuorentXIqWordmark } from "@/components/brand/QuorentXIqMark";
import { PRODUCT } from "@/lib/brand";
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
      { title: `Candidate login — ${PRODUCT.fullName}` },
      {
        name: "description",
        content: "Candidate sign-in for assigned QuorentX IQ assessments.",
      },
      { property: "og:title", content: `Candidate login — ${PRODUCT.fullName}` },
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
      <div className="relative hidden w-[42%] overflow-hidden bg-navy text-navy-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <QuorentXIqWordmark size="md" tone="light" showTagline />
        <div>
          <p className="text-sm text-navy-foreground/70">For candidates</p>
          <h1 className="mt-3 text-3xl font-medium leading-tight">
            Continue to your assigned assessments
          </h1>
          <p className="mt-3 max-w-sm text-sm text-navy-foreground/80">
            Use the email and password your recruiter shared. You’ll only see the tests assigned to
            you.
          </p>
        </div>
        <p className="text-xs text-navy-foreground/55">{PRODUCT.tagline}</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <QuorentXIqWordmark size="md" tone="dark" />
          </div>
          <Card className="shadow-panel">
            <CardHeader>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Enter the credentials you received from the hiring team.
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
                <Button
                  type="submit"
                  className="w-full bg-[var(--qx-teal)] text-white hover:bg-[var(--qx-teal)]/90"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Continue"}
                </Button>
              </form>
              <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
                <p>New accounts are created by your recruiter — registration is not available here.</p>
                <p>
                  Hiring with QuorentX?{" "}
                  <Link to="/" hash="contact" className="underline-offset-2 hover:underline">
                    Contact us
                  </Link>
                </p>
                <p>
                  <Link to="/" className="underline-offset-2 hover:underline">
                    Back to home
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
