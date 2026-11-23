import React, { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/constants/constants";

// Cloudflare Turnstile, rendered only when PUBLIC_TURNSTILE_SITE_KEY is set at build time.

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileProps {
  onToken: (token: string) => void;
  /** Changing it asks for a fresh token (a token can be used once). */
  resetKey: number;
}

export default function Turnstile({ onToken, resetKey }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ api: TurnstileApi; id: string } | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        const id = api.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: "ro",
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
        widgetRef.current = { api, id };
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widgetRef.current) widgetRef.current.api.remove(widgetRef.current.id);
      widgetRef.current = null;
    };
    // Rendered once; onToken is a state setter.
  }, []);

  useEffect(() => {
    if (resetKey && widgetRef.current) {
      widgetRef.current.api.reset(widgetRef.current.id);
      onToken("");
    }
  }, [resetKey, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} style={{ minHeight: 65 }} />;
}
