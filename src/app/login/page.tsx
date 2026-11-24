"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp, ShieldCheck, ArrowRight, Loader2, Terminal, Sparkles } from "lucide-react";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || "w-4 h-4"}
      width="18"
      height="18"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Demo credentials are only prefilled in local development.
  const isDevelopment = process.env.NODE_ENV !== "production";
  const [githubLoading, setGithubLoading] = useState(false);
  const [email, setEmail] = useState(isDevelopment ? "devon.mentee@nstsdc.org" : "");
  const [password, setPassword] = useState(isDevelopment ? "password123" : "");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const descParam = searchParams.get("error_description");

    if (errorParam) {
      if (errorParam === "oauth_unconfigured") {
        setError(
          descParam ||
            "GitHub OAuth credentials are not configured on this server. Populate GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env."
        );
      } else if (errorParam === "access_denied") {
        setError("GitHub authorization request was declined by user.");
      } else if (errorParam === "account_suspended") {
        setError("Your OpenSourceHQ account is suspended. Please contact your organization administrator.");
      } else if (errorParam === "invalid_state") {
        setError("OAuth state validation failed or session expired. Please attempt sign-in again.");
      } else {
        setError(descParam || `Authentication error: ${errorParam}`);
      }
    }
  }, [searchParams]);

  const handleContinueWithGitHub = () => {
    setGithubLoading(true);
    setError(null);
    window.location.href = "/api/auth/github";
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Sign in failed");
      }

      const role = data.user.activeOrgRole;
      const slug = data.user.activeOrgSlug || "nstsdc";

      if (role === "ORG_ADMIN") {
        router.push(`/org/${slug}/admin`);
      } else if (role === "MENTOR") {
        router.push(`/org/${slug}/mentor`);
      } else if (role === "OBSERVER") {
        router.push(`/org/${slug}/observer`);
      } else {
        router.push(`/org/${slug}/student`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const selectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background bg-grid-mesh flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="relative inline-flex w-10 h-10 rounded-md bg-secondary border border-border text-foreground items-center justify-center font-bold text-lg shadow-xs">
            <Terminal className="w-5 h-5 text-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-background" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Sign In to OpenSourceHQ
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            The next-generation open-source mentorship & telemetry platform.
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2.5 text-xs text-destructive animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Authentication Notice</span>
              <p className="leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <Card className="shadow-xl border-border/80">
          <CardHeader className="pb-3 text-center border-b border-border/40">
            <CardTitle className="text-base font-bold">Developer Identity</CardTitle>
            <CardDescription className="text-xs mt-1">
              Authenticate via GitHub to access your assigned cohorts, daily logs, and verified repositories.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Primary Action: Continue with GitHub */}
            <Button
              type="button"
              size="lg"
              onClick={handleContinueWithGitHub}
              disabled={githubLoading}
              className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium flex items-center justify-center gap-2.5 border border-border h-9 rounded-md shadow-xs"
            >
              {githubLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to GitHub...</span>
                </>
              ) : (
                <>
                  <GitHubIcon className="w-4 h-4" />
                  <span>Continue with GitHub</span>
                </>
              )}
            </Button>

            {/* Why GitHub Info */}
            <div className="p-3 bg-muted/50 rounded-md border border-border text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span>
                GitHub authorization allows OpenSourceHQ to automatically track your pull requests, verify commit milestones, and map your contributions to mentorship goals.
              </span>
            </div>

            {isDevelopment && (
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center justify-between py-1 text-xs text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Local demo accounts</span>
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/80">Development only</span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className={`p-2 rounded-lg border text-center transition-all ${
                      email === "devon.mentee@nstsdc.org"
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => selectDemo("devon.mentee@nstsdc.org")}
                  >
                    <span className="text-xs block font-bold">Mentee</span>
                    <span className="text-[9px] font-mono opacity-70">Devon</span>
                  </button>
                  <button
                    type="button"
                    className={`p-2 rounded-lg border text-center transition-all ${
                      email === "alex.mentor@nstsdc.org"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs"
                        : "border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => selectDemo("alex.mentor@nstsdc.org")}
                  >
                    <span className="text-xs block font-bold">Mentor</span>
                    <span className="text-[9px] font-mono opacity-70">Alex</span>
                  </button>
                  <button
                    type="button"
                    className={`p-2 rounded-lg border text-center transition-all ${
                      email === "sarah.admin@nstsdc.org"
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-xs"
                        : "border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => selectDemo("sarah.admin@nstsdc.org")}
                  >
                    <span className="text-xs block font-bold">Org Admin</span>
                    <span className="text-[9px] font-mono opacity-70">Sarah</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordLogin} className="space-y-3 text-xs pt-3">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.org"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                size="md"
                variant="glow"
                className="w-full text-xs font-bold"
                loading={passwordLoading}
              >
                Sign In with Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
