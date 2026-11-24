"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  targetUrl?: string | null;
  createdAt: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.status === 401) {
        // Not authenticated or session expired - do not spam
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000); // 45s poll
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      try {
        await fetch(`/api/notifications/${notif.id}/read`, { method: "POST" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
    setIsOpen(false);
    if (notif.targetUrl) {
      router.push(notif.targetUrl);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 p-0 relative text-muted-foreground hover:text-foreground"
        aria-label="Open notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-border bg-popover shadow-xl z-50 text-popover-foreground animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40 text-xs">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications to display.
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notif)}
                  className={`w-full p-3.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 cursor-pointer transition-colors relative flex gap-3 ${
                    !notif.read ? "bg-accent/15" : ""
                  }`}
                >
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDate(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                      {notif.body}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

