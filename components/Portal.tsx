"use client";

import { createPortal } from "react-dom";

/**
 * Renders a full-screen sheet at the end of <body>, so an animated (transformed) parent can't trap
 * `position: fixed` inside itself. Only render it once open (in the browser).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
