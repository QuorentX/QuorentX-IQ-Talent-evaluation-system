import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Timer, Code2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalentGate — Interview & Assessment Portal" },
      {
        name: "description",
        content:
          "Company hiring portal for timed coding, written and multiple-choice assessments, candidate results and interview scheduling.",
      },
      { property: "og:title", content: "TalentGate — Interview & Assessment Portal" },
      {
        property: "og:description",
        content:
          "Run timed technical assessments, review candidate answers and schedule interviews in one secure portal.",
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
    body: "Candidates sit multiple-choice, coding and written papers with a live countdown and auto-submit.",
  },
  {
    icon: Code2,
    title: "Mixed question types",
    body: "Auto-graded MCQs plus code and long-form answers routed to your reviewers.",
  },
  {
    icon: CalendarClock,
    title: "Interview scheduling",
    body: "Shortlist candidates and publish interview slots straight to their dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Invite-only access",
    body: "No public sign-up. Admins issue credentials and control every assessment.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <section className="bg-hero-gradient text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-70">
            Recruitment operations
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            One portal for company assessments and interviews
          </h1>
          <p className="mt-5 max-w-2xl text-lg opacity-80">
            Administrators build question papers, assign them to candidates and grade the results.
            Students sign in to take their assessments and see their interview schedule.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Sign in to the portal</Link>
            </Button>
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
        TalentGate assessment portal
      </footer>
    </div>
  );
}
