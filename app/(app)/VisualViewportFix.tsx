"use client";

import { useEffect } from "react";

export default function VisualViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;

    const updateViewportVars = () => {
      if (!vv) {
        document.documentElement.style.setProperty("--vv-bottom", "0px");
        return;
      }

      const bottomOffset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      document.documentElement.style.setProperty("--vv-bottom", `${bottomOffset}px`);
      document.documentElement.style.setProperty("--vv-height", `${vv.height}px`);
    };

    updateViewportVars();

    vv?.addEventListener("resize", updateViewportVars);
    vv?.addEventListener("scroll", updateViewportVars);
    window.addEventListener("orientationchange", updateViewportVars);

    return () => {
      vv?.removeEventListener("resize", updateViewportVars);
      vv?.removeEventListener("scroll", updateViewportVars);
      window.removeEventListener("orientationchange", updateViewportVars);
    };
  }, []);

  return null;
}
