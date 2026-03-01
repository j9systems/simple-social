"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { listNotifications, markNotificationAsRead } from "@/lib/notifications";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import type { NotificationItem } from "@/lib/types";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5v-9Z" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M11 4a7 7 0 1 0 4.4 12.5l4 4 1.4-1.4-4-4A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "Upload",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.4 0 8 2 8 4.5V21H4v-2.5C4 16 7.6 14 12 14Z" />
      </svg>
    ),
  },
];

function formatNotificationDate(isoDate: string) {
  return new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getNotificationMessage(notification: NotificationItem) {
  const actor = notification.actor_username ? `@${notification.actor_username}` : "Someone";

  switch (notification.type) {
    case "follow":
      return `${actor} followed you`;
    case "post_like":
      return `${actor} liked your post`;
    case "comment":
      return `${actor} commented on your post`;
    case "comment_like":
      return `${actor} liked your comment`;
    default:
      return `${actor} interacted with your content`;
  }
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const isHomeFeed = pathname === "/";
  const [checkingAuth, setCheckingAuth] = useState(hasSupabaseEnv);
  const [session, setSession] = useState<Session | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsDebugMessage, setNotificationsDebugMessage] = useState<string | null>(null);
  const [isTopBarHidden, setIsTopBarHidden] = useState(false);
  const notificationsPanelRef = useRef<HTMLElement | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastScrollYRef = useRef(0);

  const unreadNotificationsCount = notifications.filter((notification) => !notification.read_at).length;

  const loadNotifications = useCallback(async (showLoading = true) => {
    const viewerId = session?.user?.id;
    if (!viewerId) {
      return;
    }

    if (showLoading) {
      setNotificationsLoading(true);
    }
    const result = await listNotifications(viewerId);
    setNotifications(result.items);
    setNotificationsDebugMessage(result.errorMessage);
    if (showLoading) {
      setNotificationsLoading(false);
    }
  }, [session?.user?.id]);

  const openNotifications = async () => {
    if (!notificationsOpen) {
      await loadNotifications();
    }
    setNotificationsOpen((current) => !current);
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    const viewerId = session?.user?.id;
    if (!viewerId) {
      return;
    }

    if (!notification.read_at) {
      setNotifications((current) =>
        current.map((entry) =>
          entry.id === notification.id
            ? {
                ...entry,
                read_at: new Date().toISOString(),
              }
            : entry,
        ),
      );
      await markNotificationAsRead(notification.id, viewerId);
    }

    if (notification.type === "follow") {
      let targetUsername = notification.actor_username;

      if (!targetUsername && notification.actor_profile_id) {
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", notification.actor_profile_id)
          .maybeSingle();
        targetUsername = (actorProfile?.username as string | null) ?? null;
      }

      if (targetUsername) {
        router.push(`/u/${targetUsername}`);
        setNotificationsOpen(false);
        return;
      }
    }

    if (notification.post_id) {
      router.push(`/p/${notification.post_id}`);
      setNotificationsOpen(false);
    }
  };

  useEffect(() => {
    if (!hasSupabaseEnv) {
      return;
    }

    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) {
        router.replace("/login");
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    let active = true;

    const loadNotificationBadge = async () => {
      const result = await listNotifications(session.user.id);
      if (!active) {
        return;
      }
      setNotifications(result.items);
      setNotificationsDebugMessage(result.errorMessage);
    };

    void loadNotificationBadge();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationsPanelRef.current) {
        return;
      }

      if (notificationsPanelRef.current.contains(event.target as Node)) {
        return;
      }
      if (notificationsButtonRef.current?.contains(event.target as Node)) {
        return;
      }

      setNotificationsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsTopBarHidden(false);
      lastScrollYRef.current = window.scrollY;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isHomeFeed) {
      return;
    }

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      const delta = nextScrollY - lastScrollYRef.current;
      if (delta > 0 && nextScrollY > 0) {
        setIsTopBarHidden(true);
      } else if (delta < 0) {
        setIsTopBarHidden(false);
      }
      lastScrollYRef.current = nextScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [isHomeFeed]);

  if (checkingAuth) {
    return (
      <main className="page-wrap">
        <p>Checking session...</p>
      </main>
    );
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="page-wrap auth-page">
        <section className="card">
          <h1>Supabase not configured</h1>
          <p>
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            in <code>.env.local</code>.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="app-shell">
      <header className={`top-bar ${isHomeFeed && isTopBarHidden ? "is-hidden-on-scroll" : ""}`}>
        <Image
          alt="Simple Social"
          className={pathname === "/" ? "brand-logo brand-logo-home" : "brand-logo"}
          height={64}
          priority
          src="https://res.cloudinary.com/duy32f0q4/image/upload/v1772339914/ss_wordmark_htwmgq.svg"
          width={320}
        />
        <button
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          aria-label="Open notifications"
          className="icon-button notifications-button"
          onClick={() => {
            void openNotifications();
          }}
          ref={notificationsButtonRef}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v2.6c0 .7-.2 1.4-.7 2l-1.5 2.2a1 1 0 0 0 .8 1.5h13.8a1 1 0 0 0 .8-1.5l-1.5-2.2c-.5-.6-.7-1.3-.7-2V9A5.5 5.5 0 0 0 12 3.5Zm0 17.2a2.6 2.6 0 0 0 2.5-2h-5a2.6 2.6 0 0 0 2.5 2Z" />
          </svg>
          {unreadNotificationsCount > 0 ? <span className="notification-badge">{unreadNotificationsCount}</span> : null}
        </button>
        <section
          aria-hidden={!notificationsOpen}
          aria-label="Notifications"
          className={`notifications-panel ${notificationsOpen ? "is-open" : ""}`}
          ref={notificationsPanelRef}
          role="dialog"
        >
          <header className="notifications-panel-header">
            <h2>Notifications</h2>
          </header>
          {notificationsDebugMessage ? <p className="notifications-error">{notificationsDebugMessage}</p> : null}
          {notificationsLoading ? <p className="notifications-empty">Loading notifications...</p> : null}
          {!notificationsLoading && notifications.length === 0 ? (
            <p className="notifications-empty">No notifications yet.</p>
          ) : null}
          {!notificationsLoading && notifications.length > 0 ? (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <button
                  className={`notification-item ${!notification.read_at ? "is-unread" : ""}`}
                  key={notification.id}
                  onClick={() => {
                    void handleNotificationClick(notification);
                  }}
                  type="button"
                >
                  {notification.type === "follow" ? (
                    <img
                      alt={`${notification.actor_username ?? "User"} avatar`}
                      className="notification-avatar-thumb"
                      src={notification.actor_avatar_url ?? "/pwa-icon.svg"}
                    />
                  ) : (
                    <img
                      alt="Related post thumbnail"
                      className="notification-post-thumb"
                      src={notification.post_image_url ?? "/pwa-icon.svg"}
                    />
                  )}
                  <span className="notification-copy">
                    <span>{getNotificationMessage(notification)}</span>
                    <time dateTime={notification.created_at}>{formatNotificationDate(notification.created_at)}</time>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </header>

      <main className="page-wrap">{children}</main>

      <nav aria-label="Primary" className="tab-bar">
        {tabs.map((tab) => (
          <Link
            className={
              pathname === tab.href || pathname.startsWith(`${tab.href}/`)
                ? "tab-link active"
                : "tab-link"
            }
            href={tab.href}
            key={tab.href}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
