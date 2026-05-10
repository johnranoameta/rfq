"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleHelp, Eye, EyeOff, Key, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyHardcodedLogin, completeSignIn } from "@/components/auth/rfqAuth";
import { SettingsMenu } from "@/components/settings/SettingsMenu";

export default function LoginPage() {
  const [username, setUsername] = useState("RFQ1");
  const [password, setPassword] = useState("Manu1a!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const disabled = useMemo(() => submitting, [submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ok = verifyHardcodedLogin(username.trim(), password);
      if (!ok) {
        setError("Invalid username or password.");
        return;
      }

      const saved = completeSignIn(rememberDevice);
      if (!saved) {
        setError(
          "Could not save your session (browser storage blocked or unavailable). Allow site storage / cookies for this site, or try another browser.",
        );
        return;
      }

      /** Full reload so `/` always reads storage; client-only auth + `router.replace` can appear to do nothing in some setups. */
      window.location.assign("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-[52px] w-full border-b border-border bg-secondary/25 backdrop-blur bg-gradient-to-r from-secondary/30 via-secondary/20 to-transparent">
        <div className="h-full flex items-center gap-4 px-5">
          <div className="font-semibold tracking-wider text-xs text-accent dark:text-accent/90 uppercase">
            RFQ<span className="text-muted-foreground font-normal">·</span>Agent
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex-1 min-w-0" />
          <Link
            href="/help"
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="User guide — how to use the app (opens in new tab)"
            aria-label="Open user guide in a new tab"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CircleHelp className="size-5 shrink-0" />
            <span className="text-xs font-medium">Guide</span>
          </Link>
          <div className="hidden sm:flex">
            <SettingsMenu />
          </div>
          <div className="sm:hidden">
            <SettingsMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-[420px] rounded-2xl border-border/90 bg-card/90 shadow-lg shadow-primary/5 dark:shadow-black/30 ring-1 ring-border/60">
          <CardHeader className="space-y-1 p-6 pb-2">
            <CardTitle className="text-xl font-semibold tracking-tight text-card-foreground">
              Login
            </CardTitle>
            <p className="text-[13px] text-muted-foreground leading-snug">
              Sign in with your RFQ Agent credentials.
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="login-username"
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground font-mono"
                >
                  Username
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    id="login-username"
                    className="h-11 w-full rounded-xl border border-input bg-background/40 pl-11 pr-3.5 text-[14px] font-mono text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="login-password"
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground font-mono"
                >
                  Password
                </label>
                <div className="relative">
                  <Key
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    id="login-password"
                    className="h-11 w-full rounded-xl border border-input bg-background/40 py-2 pl-11 pr-11 text-[14px] font-mono text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/40"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={disabled}
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={0}
                    disabled={disabled}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-background/20 px-3.5 py-3 transition hover:bg-background/35">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  disabled={disabled}
                />
                <span className="text-[13px] leading-snug text-foreground">
                  <span className="font-medium">Remember this device</span>
                  <span className="block text-[12px] text-muted-foreground mt-0.5">
                    Stay signed in after you close the browser. Uncheck on shared computers.
                  </span>
                </span>
              </label>

              {error ? (
                <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-[13px] text-destructive dark:text-red-200">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-xl h-11 text-[14px] font-semibold shadow-sm"
                disabled={disabled}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
                Demo login:{" "}
                <span className="font-mono text-foreground/90">RFQ1</span>
                {" · "}
                <span className="font-mono text-foreground/90">Manu1a!</span>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
