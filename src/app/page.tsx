import Link from "next/link";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, GitPullRequest, Layers, Users, Award, Terminal, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const session = await getSession();

  if (session && session.activeOrgSlug) {
    if (session.activeOrgRole === "ORG_ADMIN" || session.isPlatformSuperAdmin) {
      redirect(`/org/${session.activeOrgSlug}/admin`);
    } else if (session.activeOrgRole === "MENTOR") {
      redirect(`/org/${session.activeOrgSlug}/mentor`);
    } else if (session.activeOrgRole === "OBSERVER") {
      redirect(`/org/${session.activeOrgSlug}/observer`);
    } else {
      redirect(`/org/${session.activeOrgSlug}/student`);
    }
  }

  return (
    <div className="min-h-screen bg-background bg-grid-mesh flex flex-col selection:bg-primary/20">
      {/* Top Header */}
      <header className="h-14 border-b border-border px-6 sm:px-8 flex items-center justify-between bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-foreground font-bold text-xs shadow-xs">
            <Terminal className="w-4 h-4 text-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 ring-2 ring-background" />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-foreground">
            OpenSourceHQ
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
            FELLOWSHIP
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button size="sm" variant="primary" className="text-xs">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 sm:py-28 max-w-5xl mx-auto relative">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs font-mono mb-6">
          <Terminal className="w-3.5 h-3.5" />
          Next-Generation Open Source Mentorship Platform
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl leading-[1.1]">
          Streamline cohorts, daily engineering logs, and verified GitHub velocity.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          OpenSourceHQ unites organization admins, mentors, and student fellows into one high-energy command center with automated streak tracking, blocker triage, and HMAC-verified telemetry.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" variant="glow" className="gap-2 font-bold shadow-glow text-sm">
              Launch Developer Console <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left w-full">
          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-card hover:border-primary/40 transition-all">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Cohorts & Mentors</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Multi-cohort organization hierarchies with mentor assignments, mentee enrollments, and tenant isolation.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-card hover:border-amber-500/40 transition-all">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Engineering Logs & Streaks</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Structured daily log submissions with automated streak tracking, blocker triage, and PR artifact verification.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-card hover:border-cyan-500/40 transition-all">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 mb-4">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Verified GitHub App Ingestion</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              HMAC-verified webhooks, normalized activity telemetry, pull request metrics, and labeled developer fixtures.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/80 py-6 text-center text-xs text-muted-foreground bg-card/40">
        OpenSourceHQ &copy; 2026. Enterprise-Grade Open-Source Fellowship Platform.
      </footer>
    </div>
  );
}
