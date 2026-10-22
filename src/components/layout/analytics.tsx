"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsEnabled, loadAnalytics, trackPageView } from "@/lib/analytics";

// Carrega a medição (se houver IDs) e registra a visualização de cada página uma única vez.
export function Analytics() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsEnabled || last.current === pathname) return;
    last.current = pathname;
    loadAnalytics();
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
