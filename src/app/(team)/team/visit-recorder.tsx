"use client";

import { useEffect } from "react";
import { recordVisitAction } from "./visit-actions";

/**
 * Records the dashboard visit once the dashboard is really shown (ST-050, ADR 0011): a client effect runs neither on a
 * prefetch nor on the re-render after a Server Action, so neither moves the Last visit. A reload, a second tab or
 * browser back run it again – the recording keeps one visit for an hour, so that changes nothing. Renders nothing.
 */
export function VisitRecorder() {
  useEffect(() => {
    // A failed recording keeps the previous Last visit – the marks stay a round longer, the safe side. The server
    // reports its own errors (ADR 0008); the page has nothing to tell the team member.
    recordVisitAction().catch(() => undefined);
  }, []);
  return null;
}
