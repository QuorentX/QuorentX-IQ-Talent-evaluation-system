import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Timer, Code2, CalendarClock, UserRound, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalentGate — Interview & Assessment Portal" },
      {
        name: "description",
        content:
          "Separate portals for candidates and administrators. Take assigned tests or manage assessments.",
      },
      { property: "og:title", content: "TalentGate — Interview & Assessment Portal" },
      {
        property: "og:description",
        content: "Candidate and administrator sign-in for assessments and hiring operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Timer,
    title: "Timed assessments",
    body: "Candidates sit multiple-choice papers with a live countdown and auto-submit.",
  },
  {
    icon: Code2,
    title: "MCQ & mixed papers",
    body: "Auto-graded MCQs plus optional coding and written answers for reviewers.",
  },
  {
    icon: CalendarClock,
    title: "Due dates",
    body: "Admins assign tests with date and time windows for each candidate.",
  },
  {
    icon: ShieldCheck,
    title: "Invite-only access",
    body: "No public registration. Credentials are issued by the hiring team.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <section className="bg-hero-gradient text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-70">
            Talent evaluation system
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Choose your portal
          </h1>
          <p className="mt-5 max-w-2xl text-lg opacity-80">
            Candidates and administrators use separate sign-in flows. Pick the portal that matches
            your role.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link
              to="/login"
              className="group rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur transition hover:bg-white/15"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <UserRound className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">Candidate login</h2>
              <p className="mt-2 text-sm opacity-80">
                Sign in with the email and password issued to you. View and take only the tests
                assigned to your account.
              </p>
              <span className="mt-5 inline-flex text-sm font-medium underline-offset-4 group-hover:underline">
                Continue as candidate →
              </span>
            </Link>

            <Link
              to="/admin-login"
              className="group rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur transition hover:bg-white/15"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Shield className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">Admin login</h2>
              <p className="mt-2 text-sm opacity-80">
                Create tests, add users with auto passwords, assign due dates, and review results.
              </p>
              <span className="mt-5 inline-flex text-sm font-medium underline-offset-4 group-hover:underline">
                Continue as administrator →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-panel">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-4 font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 px-4">
          <span>TalentGate assessment portal</span>
          <span className="opacity-40">·</span>
          <Button asChild variant="link" className="h-auto p-0 text-sm text-muted-foreground">
            <Link to="/login">Candidate</Link>
          </Button>
          <Button asChild variant="link" className="h-auto p-0 text-sm text-muted-foreground">
            <Link to="/admin-login">Admin</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
