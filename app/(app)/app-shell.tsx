"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AVATAR_UPDATED_EVENT, buildAvatarSrc, readAvatarVersion } from "@/lib/avatar";
import { HOME_INITIAL_FEED_READY_EVENT, HOME_TAB_RESELECT_EVENT } from "@/lib/events";
import { listNotifications, markNotificationAsRead } from "@/lib/notifications";
import { isMissingTableError } from "@/lib/supabase-errors";
import { supabase } from "@/lib/supabase";
import type { NotificationItem } from "@/lib/types";

const PWA_ICON_URL =
  "https://res.cloudinary.com/duy32f0q4/image/upload/v1772878441/simpleSocial_Logo_s9xbr8.png";
const WORDMARK_URL =
  "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339914/ss_wordmark_htwmgq.svg";

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
  },
];

function isModifiedEvent(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isTextInputElement(element: Element | null) {
  if (!element || !(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    const blockedTypes = new Set(["button", "checkbox", "file", "hidden", "image", "radio", "range", "reset", "submit"]);
    return !blockedTypes.has(element.type);
  }
  return false;
}

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
    case "follow_request":
      return `${actor} requested to follow you`;
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

type AppShellProps = Readonly<{
  children: React.ReactNode;
  viewer: {
    id: string;
    metadata: Record<string, unknown>;
  };
}>;

export default function AppShell({ children, viewer }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isHomeFeed = pathname === "/";
  const isProfilePage = pathname === "/profile";
  const useHomeBrandTreatment = pathname === "/" || pathname === "/search" || pathname === "/upload";
  const homeInitialFeedReadyOnWindow =
    typeof window !== "undefined" &&
    (window as Window & { __ssHomeInitialFeedReady?: boolean }).__ssHomeInitialFeedReady === true;

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsDebugMessage, setNotificationsDebugMessage] = useState<string | null>(null);
  const [pendingFollowRequestActorIds, setPendingFollowRequestActorIds] = useState<Set<string>>(new Set());

  const [isTopBarHidden, setIsTopBarHidden] = useState(false);
  const [viewerTabAvatarUrl, setViewerTabAvatarUrl] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [hasHomeInitialFeedLoaded, setHasHomeInitialFeedLoaded] = useState(homeInitialFeedReadyOnWindow);

  const notificationsPanelRef = useRef<HTMLElement | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const tabBarRef = useRef<HTMLElement | null>(null);

  const lastScrollYRef = useRef(0);
  const navMountLoggedRef = useRef(false);
  const firstPaintLoggedRef = useRef(false);

  const unreadNotificationsCount = notifications.filter((notification) => !notification.read_at).length;
  const showHomeStartupSplash = isHomeFeed && !hasHomeInitialFeedLoaded;

  const dismissSoftKeyboard = useCallback(() => {
    const activeElement = document.activeElement;
    if (!isTextInputElement(activeElement)) return;
    (activeElement as HTMLElement).blur();
  }, []);

  const loadPendingFollowRequests = useCallback(
    async (items: NotificationItem[]) => {
      const actorIds = Array.from(
        new Set(
          items
            .filter((notification) => notification.type === "follow_request")
            .map((notification) => notification.actor_profile_id)
            .filter(Boolean),
        ),
      ) as string[];

      if (actorIds.length === 0) {
        setPendingFollowRequestActorIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from("follow_requests")
        .select("requester_id")
        .eq("target_id", viewer.id)
        .eq("status", "pending")
        .in("requester_id", actorIds);

      if (error) {
        if (!isMissingTableError(error, "follow_requests")) {
          setNotificationsDebugMessage((current) =>
            current ? `${current} | Follow request lookup failed: ${error.message}` : `Follow request lookup failed: ${error.message}`,
          );
        }
        setPendingFollowRequestActorIds(new Set());
        return;
      }

      const pendingIds = new Set<string>(((data ?? []) as Array<{ requester_id: string | null }>).map((row) => row.requester_id).filter(Boolean) as string[]);
      setPendingFollowRequestActorIds(pendingIds);
    },
    [viewer.id],
  );

  const loadNotifications = useCallback(
    async (showLoading = true) => {
      if (showLoading) setNotificationsLoading(true);
      const result = await listNotifications(viewer.id);
      setNotifications(result.items);
      setNotificationsDebugMessage(result.errorMessage);
      await loadPendingFollowRequests(result.items);
      if (showLoading) setNotificationsLoading(false);
    },
    [loadPendingFollowRequests, viewer.id],
  );

  const openNotifications = async () => {
    if (!notificationsOpen) {
      await loadNotifications();
    }
    setNotificationsOpen((current) => !current);
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
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
      if (!notification.id.startsWith("follow_request:")) {
        await markNotificationAsRead(notification.id, viewer.id);
      }
    }

    if (notification.type === "follow" || notification.type === "follow_request") {
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

  const handleAcceptFollowRequest = async (notification: NotificationItem) => {
    const requesterId = notification.actor_profile_id;
    if (!requesterId) {
      return;
    }

    const { error: followError } = await supabase.from("follows").upsert(
      {
        follower_id: requesterId,
        following_id: viewer.id,
      },
      { onConflict: "follower_id,following_id" },
    );

    if (followError) {
      setNotificationsDebugMessage(`Could not accept follow request: ${followError.message}`);
      return;
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("follow_requests")
      .update({
        status: "accepted",
        responded_at: nowIso,
        updated_at: nowIso,
      })
      .eq("requester_id", requesterId)
      .eq("target_id", viewer.id)
      .eq("status", "pending");

    if (updateError && !isMissingTableError(updateError, "follow_requests")) {
      setNotificationsDebugMessage(`Follow request accepted, but cleanup failed: ${updateError.message}`);
    }

    if (!notification.id.startsWith("follow_request:")) {
      await markNotificationAsRead(notification.id, viewer.id);
    }
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
    setPendingFollowRequestActorIds((current) => {
      const next = new Set(current);
      next.delete(requesterId);
      return next;
    });
  };

  const handleTabClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
      if (isModifiedEvent(event) || event.button !== 0) return;
      if (href !== "/" || pathname !== "/") return;
      if (window.scrollY <= 0) return;

      event.preventDefault();
      setIsTopBarHidden(false);
      window.dispatchEvent(new Event(HOME_TAB_RESELECT_EVENT));
    },
    [pathname],
  );

  const handleTabPointerDown = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>, href: string) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isModifiedEvent(event)) return;
      if (href === pathname) return;

      event.preventDefault();
      dismissSoftKeyboard();
      router.push(href);
    },
    [dismissSoftKeyboard, pathname, router],
  );

  const handleTabTouchStart = useCallback(
    (event: React.TouchEvent<HTMLAnchorElement>, href: string) => {
      if (isModifiedEvent(event)) return;
      if (href === pathname) return;

      event.preventDefault();
      dismissSoftKeyboard();
      router.push(href);
    },
    [dismissSoftKeyboard, pathname, router],
  );

  useEffect(() => {
    for (const tab of tabs) {
      router.prefetch(tab.href);
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    const loadNotificationBadge = async () => {
      const result = await listNotifications(viewer.id);
      if (!active) return;
      setNotifications(result.items);
      setNotificationsDebugMessage(result.errorMessage);
      await loadPendingFollowRequests(result.items);
    };

    void loadNotificationBadge();

    return () => {
      active = false;
    };
  }, [loadPendingFollowRequests, viewer.id]);

  useEffect(() => {
    let active = true;

    const loadViewerAvatar = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", viewer.id)
        .maybeSingle();

      if (!active) return;

      const metadata = viewer.metadata ?? {};
      const metadataAvatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
      setViewerTabAvatarUrl((profileData?.avatar_url as string | null) ?? metadataAvatarUrl);
    };

    const syncAvatarVersion = () => {
      setAvatarVersion(readAvatarVersion());
      void loadViewerAvatar();
    };

    syncAvatarVersion();
    window.addEventListener(AVATAR_UPDATED_EVENT, syncAvatarVersion);

    return () => {
      active = false;
      window.removeEventListener(AVATAR_UPDATED_EVENT, syncAvatarVersion);
    };
  }, [viewer.id, viewer.metadata]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationsPanelRef.current) return;
      if (notificationsPanelRef.current.contains(event.target as Node)) return;
      if (notificationsButtonRef.current?.contains(event.target as Node)) return;
      setNotificationsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    dismissSoftKeyboard();
  }, [dismissSoftKeyboard, pathname]);

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
    const onInitialFeedReady = () => {
      setHasHomeInitialFeedLoaded(true);
    };

    window.addEventListener(HOME_INITIAL_FEED_READY_EVENT, onInitialFeedReady);

    return () => {
      window.removeEventListener(HOME_INITIAL_FEED_READY_EVENT, onInitialFeedReady);
    };
  }, []);

  useEffect(() => {
    if (!isHomeFeed) return;

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      const delta = nextScrollY - lastScrollYRef.current;
      if (delta > 0 && nextScrollY > 0) setIsTopBarHidden(true);
      else if (delta < 0) setIsTopBarHidden(false);
      lastScrollYRef.current = nextScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHomeFeed]);

  useEffect(() => {
    const hasPaintSupport = typeof PerformanceObserver !== "undefined";
    const existingFirstPaint = performance.getEntriesByName("first-paint")[0];

    if (existingFirstPaint && !firstPaintLoggedRef.current) {
      firstPaintLoggedRef.current = true;
      console.log("[perf] first paint @", existingFirstPaint.startTime.toFixed(2) + "ms");
      return;
    }

    if (!hasPaintSupport) return;

    const observer = new PerformanceObserver((entryList) => {
      if (firstPaintLoggedRef.current) return;
      for (const entry of entryList.getEntries()) {
        if (entry.name === "first-paint") {
          firstPaintLoggedRef.current = true;
          console.log("[perf] first paint @", entry.startTime.toFixed(2) + "ms");
          observer.disconnect();
          break;
        }
      }
    });

    observer.observe({ type: "paint", buffered: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tabBarRef.current || navMountLoggedRef.current) return;

    navMountLoggedRef.current = true;
    const navTs = performance.now();
    const themeTs = (window as Window & { __ssThemeSetTs?: number }).__ssThemeSetTs;

    console.log("[perf] nav first render @", navTs.toFixed(2) + "ms");
    if (typeof themeTs === "number") {
      console.log("[perf] nav rendered after theme by", (navTs - themeTs).toFixed(2) + "ms");
    }
  }, []);

  return (
    <div className="app-shell">
      {!isProfilePage && !showHomeStartupSplash ? (
        <header className={`top-bar ${isHomeFeed && isTopBarHidden ? "is-hidden-on-scroll" : ""}`}>
          <Image
            alt="Simple Social"
            className={useHomeBrandTreatment ? "brand-logo brand-logo-home" : "brand-logo"}
            height={64}
            priority
            src={WORDMARK_URL}
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
            {unreadNotificationsCount > 0 ? (
              <span className="notification-badge">{unreadNotificationsCount}</span>
            ) : null}
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
                  <div className={`notification-item ${!notification.read_at ? "is-unread" : ""}`} key={notification.id}>
                    <button
                      className="notification-main-button"
                      onClick={() => {
                        void handleNotificationClick(notification);
                      }}
                      type="button"
                    >
                      {notification.type === "follow" || notification.type === "follow_request" ? (
                        <img
                          alt={`${notification.actor_username ?? "User"} avatar`}
                          className="notification-avatar-thumb"
                          src={notification.actor_avatar_url ?? PWA_ICON_URL}
                        />
                      ) : (
                        <img
                          alt="Related post thumbnail"
                          className="notification-post-thumb"
                          src={notification.post_image_url ?? PWA_ICON_URL}
                        />
                      )}

                      <span className="notification-copy">
                        <span>{getNotificationMessage(notification)}</span>
                        <time dateTime={notification.created_at}>{formatNotificationDate(notification.created_at)}</time>
                      </span>
                    </button>
                    {notification.type === "follow_request" && notification.actor_profile_id ? (
                      <button
                        className="secondary-button notification-accept-button"
                        disabled={!pendingFollowRequestActorIds.has(notification.actor_profile_id)}
                        onClick={() => {
                          void handleAcceptFollowRequest(notification);
                        }}
                        type="button"
                      >
                        {pendingFollowRequestActorIds.has(notification.actor_profile_id) ? "Accept" : "Accepted"}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </header>
      ) : null}

      <main
        aria-hidden={showHomeStartupSplash}
        className={`${isProfilePage ? "page-wrap page-wrap-no-top-bar" : "page-wrap"} ${showHomeStartupSplash ? "is-hidden-for-startup-splash" : ""}`}
      >
        {children}
      </main>

      {showHomeStartupSplash ? (
        <div aria-live="polite" className="app-startup-splash" role="status">
          <Image
            alt="Simple Social"
            className="app-startup-wordmark"
            height={180}
            priority
            src={WORDMARK_URL}
            width={720}
          />
          <span className="visually-hidden">Loading home feed...</span>
        </div>
      ) : null}

      {!showHomeStartupSplash ? (
        <nav aria-label="Primary" className="tab-bar" ref={tabBarRef}>
          <div className="tab-bar-inner">
            {tabs.map((tab) => (
              <Link
                className={pathname === tab.href || pathname.startsWith(`${tab.href}/`) ? "tab-link active" : "tab-link"}
                href={tab.href}
                key={tab.href}
                onPointerDown={(event) => {
                  handleTabPointerDown(event, tab.href);
                }}
                onClick={(event) => {
                  handleTabClick(event, tab.href);
                }}
                onTouchStart={(event) => {
                  handleTabTouchStart(event, tab.href);
                }}
                prefetch
              >
                <span className="tab-icon">
                  {tab.href === "/profile" ? (
                    <img
                      alt="Your profile"
                      className="tab-profile-avatar"
                      src={buildAvatarSrc(viewerTabAvatarUrl, avatarVersion)}
                    />
                  ) : (
                    tab.icon
                  )}
                </span>
                <span className="tab-label">{tab.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
