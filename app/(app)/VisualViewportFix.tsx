"use client";

import { useEffect } from "react";

const KEYBOARD_INSET_THRESHOLD = 120;

function isEditableElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

export default function VisualViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;

    const updateViewportVars = () => {
      if (!vv) {
        document.documentElement.style.setProperty("--vv-bottom", "0px");
        return;
      }

      const bottomOffset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      const keyboardInset = Math.max(0, window.innerHeight - vv.height);
      const hasEditableFocus = isEditableElement(document.activeElement);
      const shouldLiftTabBar = keyboardInset > KEYBOARD_INSET_THRESHOLD && hasEditableFocus;

      document.documentElement.style.setProperty("--vv-bottom", shouldLiftTabBar ? `${bottomOffset}px` : "0px");
      document.documentElement.style.setProperty("--vv-height", `${vv.height}px`);
    };

    updateViewportVars();

    vv?.addEventListener("resize", updateViewportVars);
    vv?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("orientationchange", updateViewportVars);
    window.addEventListener("focusin", updateViewportVars);
    window.addEventListener("focusout", updateViewportVars);

    return () => {
      vv?.removeEventListener("resize", updateViewportVars);
      vv?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("orientationchange", updateViewportVars);
      window.removeEventListener("focusin", updateViewportVars);
      window.removeEventListener("focusout", updateViewportVars);
    };
  }, []);

  return null;
}
