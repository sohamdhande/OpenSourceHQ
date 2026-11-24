"use client";
import { formatDate } from "@/lib/date";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface GitHubAccountInfo {
  id: string;
  providerUserId: string;
  username: string;
  profileUrl: string;
  avatarUrl: string | null;
  verifiedEmail: string | null;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "REVOKED" | "EXPIRED" | "ERROR";
  lastVerifiedAt: string | null;
  connectedAt: string;
}

export default function StudentProfileSettingsPage({ params }: { params: { orgSlug: string } }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [hasPassword, setHasPassword] = useState(false);
  const [githubAccount, setGitHubAccount] = useState<GitHubAccountInfo | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Notification Preferences
  const [emailOnTaskAssignment, setEmailOnTaskAssignment] = useState(true);
  const [emailOnReportReview, setEmailOnReportReview] = useState(true);
  const [emailOnFeedback, setEmailOnFeedback] = useState(true);
  const [emailOnAnnouncement, setEmailOnAnnouncement] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    // Load user profile, password presence, and GitHub account
    fetch("/api/settings/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setName(data.user.name || "");
          setEmail(data.user.email || "");
          setTimezone(data.user.timezone || "UTC");
          setHasPassword(Boolean(data.user.hasPassword));
          setGitHubAccount(data.user.githubAccount || null);
        }
      })
      .catch((err) => console.error("Error loading profile:", err));

    fetch("/api/settings/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (data.preferences) {
          setEmailOnTaskAssignment(data.preferences.emailOnTaskAssignment ?? true);
          setEmailOnReportReview(data.preferences.emailOnReportReview ?? true);
          setEmailOnFeedback(data.preferences.emailOnFeedback ?? true);
          setEmailOnAnnouncement(data.preferences.emailOnAnnouncement ?? true);
          setInAppNotifications(data.preferences.inAppNotifications ?? true);
        }
      });
  }, []);

  const handleDisconnectGitHub = async () => {
    if (!hasPassword) {
      setMessage({
        text: "You must set a password below before disconnecting your GitHub account to prevent account lockout.",
        type: "error",
      });
      setShowDisconnectConfirm(false);
      return;
    }

    setDisconnecting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/github/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to disconnect GitHub account");
      setMessage({ text: "GitHub account disconnected successfully.", type: "success" });
      setShowDisconnectConfirm(false);
      // Reload profile
      const profRes = await fetch("/api/settings/profile");
      const profData = await profRes.json();
      if (profData.user) {
        setGitHubAccount(profData.user.githubAccount || null);
      }
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Error disconnecting", type: "error" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update profile");
      setMessage({ text: "Profile details updated successfully!", type: "success" });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Error", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: "New passwords do not match", type: "error" });
      return;
    }
    setSavingPassword(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Password update failed");
      setMessage({ text: "Password changed successfully!", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Error", type: "error" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUpdateNotificationPref = async (key: string, val: boolean) => {
    setSavingPrefs(true);
    const updated = {
      emailOnTaskAssignment,
      emailOnReportReview,
      emailOnFeedback,
      emailOnAnnouncement,
      inAppNotifications,
      [key]: val,
    };

    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        if (key === "emailOnTaskAssignment") setEmailOnTaskAssignment(val);
        if (key === "emailOnReportReview") setEmailOnReportReview(val);
        if (key === "emailOnFeedback") setEmailOnFeedback(val);
        if (key === "emailOnAnnouncement") setEmailOnAnnouncement(val);
        if (key === "inAppNotifications") setInAppNotifications(val);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Account & Security Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your personal identity, timezone, notifications, and security credentials.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-xs font-medium border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile Details Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profile Details</CardTitle>
          <CardDescription className="text-xs">
            Update your display name and preferred timezone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <Input
              label="Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Email Address"
              value={email}
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Timezone</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (Eastern Time)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Madrid">Europe/Madrid (CET)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" loading={savingProfile}>
                Save Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* GitHub Account & Developer Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-foreground" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path>
                </svg>
                GitHub Developer Identity
              </CardTitle>
              <CardDescription className="text-xs">
                Link your GitHub account to enable automatic PR tracking, commit verification, and one-click GitHub sign in.
              </CardDescription>
            </div>
            {githubAccount && (
              <Badge
                variant={githubAccount.connectionStatus === "CONNECTED" ? "secondary" : "destructive"}
                className={`text-[10px] ${
                  githubAccount.connectionStatus === "CONNECTED"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : ""
                }`}
              >
                {githubAccount.connectionStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubAccount && githubAccount.connectionStatus === "CONNECTED" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  {githubAccount.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={githubAccount.avatarUrl}
                      alt={githubAccount.username}
                      className="w-10 h-10 rounded-full border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs">
                      {githubAccount.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {githubAccount.username}
                      </span>
                      <a
                        href={githubAccount.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span>ID: <code className="font-mono text-[10px]">{githubAccount.providerUserId}</code></span>
                      {githubAccount.verifiedEmail && (
                        <span>Verified: {githubAccount.verifiedEmail}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">
                    Last Verified
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {githubAccount.lastVerifiedAt
                      ? formatDate(githubAccount.lastVerifiedAt)
                      : "Recently"}
                  </div>
                </div>
              </div>

              {showDisconnectConfirm ? (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Disconnect GitHub Account?</p>
                      <p className="text-[11px] text-destructive/80 mt-0.5">
                        {hasPassword
                          ? "You will still be able to sign in using your account password. Pull request sync will be paused until you reconnect."
                          : "Warning: You must have an account password set to avoid losing access to your account."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => setShowDisconnectConfirm(false)}
                      disabled={disconnecting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-7"
                      onClick={handleDisconnectGitHub}
                      loading={disconnecting}
                    >
                      Confirm Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <a href="/api/auth/github">
                    <Button size="sm" variant="outline" className="text-xs">
                      Reconnect GitHub
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={() => setShowDisconnectConfirm(true)}
                  >
                    Disconnect GitHub
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No GitHub account is currently connected to this profile. Connect your GitHub identity to enable verified activity sync and one-click authentication.
              </p>
              <a href="/api/auth/github">
                <Button size="sm" className="gap-2 text-xs">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path>
                  </svg>
                  Connect GitHub Account
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences (Persisted in DB) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notification Preferences</CardTitle>
          <CardDescription className="text-xs">
            Select the triggers for in-app and delivery alerts (persisted directly to database).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOnReportReview}
              onChange={(e) => handleUpdateNotificationPref("emailOnReportReview", e.target.checked)}
              className="rounded"
            />
            <span>Notify me when a mentor reviews my daily progress report</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOnTaskAssignment}
              onChange={(e) => handleUpdateNotificationPref("emailOnTaskAssignment", e.target.checked)}
              className="rounded"
            />
            <span>Notify me when a new task is assigned</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOnFeedback}
              onChange={(e) => handleUpdateNotificationPref("emailOnFeedback", e.target.checked)}
              className="rounded"
            />
            <span>Notify me when new mentor feedback is published</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOnAnnouncement}
              onChange={(e) => handleUpdateNotificationPref("emailOnAnnouncement", e.target.checked)}
              className="rounded"
            />
            <span>Notify me on new cohort announcements</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={inAppNotifications}
              onChange={(e) => handleUpdateNotificationPref("inAppNotifications", e.target.checked)}
              className="rounded"
            />
            <span>Enable in-app notification center bell alerts</span>
          </label>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" loading={savingPassword}>
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
