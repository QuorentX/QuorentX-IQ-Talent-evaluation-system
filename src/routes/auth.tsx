import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminExists, createFirstAdmin } from "@/lib/admin.functions";
import { currentUserQueryKey } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TalentGate Assessment Portal" },
      {
        name: "description",
        content: "Sign in to TalentGate to take your assessment or manage candidates as an administrator.",
      },
      { property: "og:title", content: "Sign in — TalentGate Assessment Portal" },
      {
        property: "og:description",
        content: "Secure, invite-only sign in for candidates and hiring administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(adminExists);
  const bootstrap = useServerFn(createFirstAdmin);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: adminState } = useQuery({
    queryKey: ["admin-exists"],
    queryFn: () => checkAdmin(),
  });
  const setupMode = adminState?.exists === false;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (setupMode) {
        await bootstrap({ data: { email: email.trim(), password, fullName: fullName.trim() } });
        toast.success("Administrator account created");
        await queryClient.invalidateQueries({ queryKey: ["admin-exists"] });
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-gradient px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2 text-navy-foreground/90 font-semibold"
        >
          <GraduationCap className="h-5 w-5" /> TalentGate
        </Link>
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>{setupMode ? "Create the first administrator" : "Sign in"}</CardTitle>
            <CardDescription>
              {setupMode
                ? "No administrator exists yet. Set up the owner account for this portal."
                : "Candidates and administrators sign in with the credentials issued to them."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {setupMode && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    maxLength={120}
                    required
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  maxLength={255}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : setupMode ? "Create administrator" : "Sign in"}
              </Button>
              {!setupMode && (
                <p className="text-center text-xs text-muted-foreground">
                  Accounts are created by an administrator. Contact your recruiter if you cannot
                  sign in.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
