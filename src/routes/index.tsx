import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ClipboardCheck,
  LineChart,
  Mail,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { PRODUCT, PARENT } from "@/lib/brand";
import { fetchParentBrandInfo } from "@/lib/brand.functions";
import { QuorentXIqWordmark } from "@/components/brand/QuorentXIqMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${PRODUCT.fullName} — ${PRODUCT.tagline}` },
      { name: "description", content: PRODUCT.shortDescription },
      { property: "og:title", content: `${PRODUCT.fullName} — ${PRODUCT.tagline}` },
      { property: "og:description", content: PRODUCT.shortDescription },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/logo-iq.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/logo-iq.png" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const getParent = useServerFn(fetchParentBrandInfo);
  const { data: parent } = useQuery({
    queryKey: ["parent-brand"],
    queryFn: () => getParent(),
    staleTime: 60 * 60_000,
  });

  const parentInfo = parent ?? {
    title: PARENT.title,
    description: PARENT.description,
    ogDescription: PARENT.ogDescription,
    url: PARENT.url,
  };

  const [contact, setContact] = useState({
    company: "",
    name: "",
    email: "",
    message: "",
  });
  const [sending, setSending] = useState(false);

  function handleContact(e: FormEvent) {
    e.preventDefault();
    if (!contact.company.trim() || !contact.email.trim()) {
      toast.error("Please enter your company name and work email");
      return;
    }
    setSending(true);
    const subject = encodeURIComponent(`QuorentX IQ access — ${contact.company.trim()}`);
    const body = encodeURIComponent(
      [
        `Company: ${contact.company.trim()}`,
        `Name: ${contact.name.trim() || "—"}`,
        `Email: ${contact.email.trim()}`,
        "",
        contact.message.trim() || "We would like to discuss QuorentX IQ for our hiring team.",
        "",
        "— Via QuorentX IQ website",
      ].join("\n"),
    );
    window.location.href = `mailto:${PARENT.contactEmail}?subject=${subject}&body=${body}`;
    toast.success("Opening your email app…");
    setSending(false);
  }

  return (
    <div className="min-h-screen bg-[var(--qx-warm)] text-[var(--qx-ink)]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <QuorentXIqWordmark size="md" tone="light" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="#features"
              className="hidden text-sm text-white/80 transition hover:text-white sm:inline"
            >
              Features
            </a>
            <a
              href="#contact"
              className="hidden text-sm text-white/80 transition hover:text-white sm:inline"
            >
              Contact
            </a>
            <a
              href={parentInfo.url}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 text-sm text-white/80 transition hover:text-white sm:inline-flex"
            >
              QuorentX.com
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <Button
              asChild
              size="sm"
              className="bg-[var(--qx-teal)] text-white hover:bg-[var(--qx-teal)]/90"
            >
              <Link to="/login">Candidate sign-in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[var(--qx-navy)] text-white">
        <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
          <div className="animate-qx-rise max-w-3xl">
            <p className="mb-6 text-sm text-white/65">A QuorentX product</p>
            <QuorentXIqWordmark
              size="xl"
              tone="light"
              showTagline
              to={false}
              className="mb-2"
            />
            <h1 className="sr-only">{PRODUCT.fullName}</h1>
            <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
              Give every candidate a fair, timed assessment — and give your hiring team clear scores
              they can act on with confidence.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-[var(--qx-teal)] px-6 text-white hover:bg-[var(--qx-teal)]/90"
              >
                <a href="#contact">Talk to us about access</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/login">Candidate sign-in</Link>
              </Button>
            </div>
            <p className="mt-6 max-w-lg text-sm text-white/55">
              Built for {PRODUCT.buyers}. New company accounts are set up by QuorentX — there is no
              public registration for organizations.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="animate-qx-fade max-w-2xl">
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Hiring tools that stay clear and fair
          </h2>
          <p className="mt-3 text-[var(--qx-ink)]/70">{PRODUCT.positioning}</p>
        </div>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Timer,
              title: "Timed assessments",
              body: "Candidates work under the same clock, with autosave and a firm time limit on every sitting.",
            },
            {
              icon: ClipboardCheck,
              title: "Structured scoring",
              body: "Multiple-choice is graded automatically. Coding and written answers stay ready for review.",
            },
            {
              icon: ShieldCheck,
              title: "Invite-only access",
              body: "You control who gets in. Credentials are issued by your team — not opened to the public.",
            },
            {
              icon: LineChart,
              title: "Results you can share",
              body: "See completion and scores by assessment, then export when leadership asks for numbers.",
            },
          ].map((item) => (
            <div key={item.title} className="border-t border-[var(--qx-ink)]/15 pt-6">
              <item.icon className="h-5 w-5 text-[var(--qx-primary)]" strokeWidth={1.75} />
              <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--qx-ink)]/65">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--qx-ink)]/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Where we’re headed</h2>
          <p className="mt-3 max-w-2xl text-[var(--qx-ink)]/70">
            Assessments are available today. We’re expanding into a complete interview workspace —
            from scheduling to richer insights — in measured steps.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                phase: "Now",
                title: "Assessments",
                body: "Create tests, invite candidates, set due dates, and review results.",
              },
              {
                phase: "Next",
                title: "Interview kits",
                body: "Shared question banks, panel scorecards, and hiring dashboards.",
              },
              {
                phase: "Soon",
                title: "Smarter review",
                body: "Suggested summaries and scores tied to your criteria — always editable by people.",
              },
              {
                phase: "Later",
                title: "Candidate experience",
                body: "Branded portals, practice sessions, and smoother day-of coordination.",
              },
            ].map((p) => (
              <li key={p.phase} className="relative">
                <p className="text-sm font-medium text-[var(--qx-teal)]">{p.phase}</p>
                <h3 className="mt-2 text-lg font-medium">{p.title}</h3>
                <p className="mt-2 text-sm text-[var(--qx-ink)]/65">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium text-[var(--qx-primary)]">About QuorentX</p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">
              {parentInfo.title.replace(/\s*\|\s*/, " · ")}
            </h2>
            <p className="mt-4 text-[var(--qx-ink)]/70">{parentInfo.description}</p>
            <a
              href={parentInfo.url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--qx-primary)] hover:underline"
            >
              Learn more at {new URL(parentInfo.url).hostname}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <div className="rounded-2xl bg-[var(--qx-navy)] p-8 text-white sm:p-10">
            <Users className="h-5 w-5 text-[var(--qx-teal)]" strokeWidth={1.75} />
            <p className="mt-4 text-xl font-medium leading-snug">
              Ready to bring IQ to your hiring process?
            </p>
            <p className="mt-4 text-sm text-white/70">
              Share a little about your roles and volume. We’ll set up your workspace, walk your team
              through onboarding, and help you invite the first candidates.
            </p>
            <Button
              asChild
              className="mt-8 bg-[var(--qx-teal)] text-white hover:bg-[var(--qx-teal)]/90"
            >
              <a href="#contact">Get in touch</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-[var(--qx-ink)]/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Contact us</h2>
            <p className="mt-3 text-[var(--qx-ink)]/70">
              Email{" "}
              <a
                className="font-medium text-[var(--qx-primary)] hover:underline"
                href={`mailto:${PARENT.contactEmail}`}
              >
                {PARENT.contactEmail}
              </a>{" "}
              or send a short note below. We’ll reply with next steps for your team.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-[var(--qx-ink)]/65">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-[var(--qx-teal)]" />
                Submitting the form opens a draft in your email app.
              </li>
              <li className="flex items-start gap-2">
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-[var(--qx-teal)]" />
                Prefer the main site? Visit{" "}
                <a
                  href={parentInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--qx-primary)] hover:underline"
                >
                  www.quorentx.com
                </a>
                .
              </li>
            </ul>
          </div>

          <form
            onSubmit={handleContact}
            className="space-y-4 rounded-2xl border border-[var(--qx-ink)]/10 bg-[var(--qx-warm)] p-6 lg:col-span-3 sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  required
                  maxLength={120}
                  value={contact.company}
                  onChange={(e) => setContact({ ...contact, company: e.target.value })}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  maxLength={120}
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                rows={4}
                maxLength={2000}
                value={contact.message}
                onChange={(e) => setContact({ ...contact, message: e.target.value })}
                placeholder="Tell us about your hiring needs…"
              />
            </div>
            <Button
              type="submit"
              disabled={sending}
              className="w-full bg-[var(--qx-teal)] text-white hover:bg-[var(--qx-teal)]/90 sm:w-auto"
            >
              {sending ? "Opening email…" : "Send message"}
            </Button>
          </form>
        </div>
      </section>

      <footer className="border-t border-[var(--qx-ink)]/10 bg-[var(--qx-navy)] text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <QuorentXIqWordmark size="sm" tone="light" showTagline />
            <p className="mt-3 max-w-md text-xs text-white/50">{PRODUCT.iqMeaning}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-white/70">
            <a href={parentInfo.url} target="_blank" rel="noreferrer" className="hover:text-white">
              {new URL(parentInfo.url).hostname}
            </a>
            <a href={`mailto:${PARENT.contactEmail}`} className="hover:text-white">
              Contact
            </a>
            <Link to="/login" className="hover:text-white">
              Candidates
            </Link>
            <Link to="/admin-login" className="hover:text-white">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
