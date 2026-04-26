export const HOME_TAB_RESELECT_EVENT = "simple-social:home-tab-reselect";
export const HOME_INITIAL_FEED_READY_EVENT = "simple-social:home-initial-feed-ready";

/** Returns the scroll container (the document element, since body scrolls natively). */
export function getScrollContainer(): HTMLElement {
  return document.documentElement;
}
