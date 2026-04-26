export const HOME_TAB_RESELECT_EVENT = "simple-social:home-tab-reselect";
export const HOME_INITIAL_FEED_READY_EVENT = "simple-social:home-initial-feed-ready";

/** Returns the .app-scroll-area element that owns the main scroll, or falls back to documentElement. */
export function getScrollContainer(): HTMLElement {
  return (document.querySelector(".app-scroll-area") as HTMLElement | null) ?? document.documentElement;
}
