import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GraduationCap, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/admin-config";
import { ensurePrimaryAdmin, provisionAdminAccount } from "@/lib/admin.functions";
import { currentUserQueryKey, fetchCurrentUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin login — TalentGate" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Administrator password sign-in for TalentGate." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const provision = useServerFn(provisionAdminAccount);
  const ensureAdmin = useServerFn(ensurePrimaryAdmin);

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
    setLoading(true);
    try {
      await provision({ data: { password } });

      const { error } = await supabase.auth.signInWithPassword({
        email: PRIMARY_ADMIN_EMAIL,
        password,
      });
      if (error) {
        throw new Error(
          error.message === "Invalid login credentials"
            ? "Invalid password. Check ADMIN_PASSWORD in server .env."
            : error.message,
        );
      }

      await ensureAdmin();
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      const current = await fetchCurrentUser();
      if (current?.role !== "admin") {
        await supabase.auth.signOut();
        queryClient.clear();
        throw new Error(
          "Signed in, but admin role is missing. Re-run supabase/setup-all.sql, then try again.",
        );
      }
      toast.success("Welcome to the admin console");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      if (message.includes("user_roles") || message.includes("schema cache")) {
        toast.error(
          "Database tables are missing. Run supabase/setup-all.sql in the Supabase SQL Editor, then try again.",
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-[42%] overflow-hidden bg-navy text-navy-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-5 w-5" /> TalentGate
        </Link>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] opacity-70">Administrator portal</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            Manage tests, users and results
          </h1>
          <p className="mt-3 max-w-sm text-sm opacity-80">
            Create MCQ assessments, invite candidates with auto-generated passwords, set due dates,
            and review scores.
          </p>
        </div>
        <p className="text-xs opacity-60">Restricted access · Password protected</p>
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
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle>Admin login</CardTitle>
              <CardDescription>
                Enter the administrator password. Candidate logins use a separate portal and never
                see this access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Administrator password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in to admin console"}
                </Button>
              </form>
              <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
                <p>
                  Taking a test?{" "}
                  <Link to="/login" className="underline-offset-2 hover:underline">
                    Go to candidate login
                  </Link>
                </p>
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
