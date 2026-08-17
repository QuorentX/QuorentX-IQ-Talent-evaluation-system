import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRIMARY_ADMIN_EMAIL } from "@/lib/admin-config";
import { PRODUCT } from "@/lib/brand";
import { ensurePrimaryAdmin, provisionAdminAccount } from "@/lib/admin.functions";
import { currentUserQueryKey, fetchCurrentUser } from "@/hooks/use-auth";
import { QuorentXIqWordmark } from "@/components/brand/QuorentXIqMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: `Admin login — ${PRODUCT.fullName}` },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Administrator password sign-in for QuorentX IQ." },
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
        <QuorentXIqWordmark size="md" tone="light" showTagline />
        <div>
          <p className="text-sm text-navy-foreground/70">For administrators</p>
          <h1 className="mt-3 text-3xl font-medium leading-tight">
            Manage assessments and candidates
          </h1>
          <p className="mt-3 max-w-sm text-sm text-navy-foreground/80">
            Create tests, invite people, track due dates, and review scores — after QuorentX enables
            your workspace.
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
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle>Admin sign-in</CardTitle>
              <CardDescription>
                Enter the password for your QuorentX IQ workspace. Need access? Contact us from the
                home page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
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
                <Button
                  type="submit"
                  className="w-full bg-[var(--qx-teal)] text-white hover:bg-[var(--qx-teal)]/90"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Continue"}
                </Button>
              </form>
              <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
                <p>
                  Here for an assessment?{" "}
                  <Link to="/login" className="underline-offset-2 hover:underline">
                    Candidate sign-in
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
