import React, { useContext, useEffect, useRef, useState } from "react";

import styles from "./styles.module.scss";
import type { IStation } from "@/models/Station";
import { Context } from "@/context/ContextProvider";
import { SHARE_URL } from "@/constants/constants";

// Android/Material "share nodes" — the glyph this (mostly Android) audience
// knows as share; the tray arrow below stays on the native-sheet row only
const ShareNodesIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    aria-hidden="true"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="8.59" y1="10.49" x2="15.42" y2="6.51" />
  </svg>
);

const ShareArrowIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    aria-hidden="true"
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="m16 6-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" fill="#fff" width={17} height={17} aria-hidden="true">
    <path d="M21.6 3.1c.3-1.1-.8-2-1.9-1.6L2.2 8.4c-1.2.5-1.1 2.2.1 2.6l4.4 1.4 1.7 5.5c.3 1 1.6 1.3 2.4.6l2.5-2.3 4.3 3.2c.9.7 2.2.2 2.4-.9L21.6 3.1zM8.9 12.9l8.5-5.4c.2-.1.4.1.2.3l-6.9 6.5c-.3.3-.5.7-.6 1.1l-.3 1.9c0 .3-.4.3-.5 0l-1-3.3c-.1-.4.1-.9.6-1.1z" />
  </svg>
);

const LinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={16}
    height={16}
    aria-hidden="true"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={16}
    height={16}
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// "Distribuie" pill in the hero's bottom-right corner opening an upward glass
// menu — same open/close choreography and card recipe as the nav settings
// menu, so the two header dropdowns read as one family.
export default function ShareOnSocial() {
  const { ctx } = useContext(Context);
  const station = ctx?.selectedStation as IStation;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // navigator doesn't exist during SSR — the "Mai multe opțiuni…" row can
    // only appear post-hydration, and only where the share sheet exists
    if (typeof navigator !== "undefined" && !!navigator.share) {
      setCanNativeShare(true);
    }
  }, []);

  const closeMenu = () => {
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      setIsClosing(false);
      setCopied(false);
    }, 140);
  };

  const toggleMenu = () => {
    if (menuOpen && !isClosing) {
      closeMenu();
    } else if (!menuOpen) {
      setMenuOpen(true);
    }
  };

  useEffect(() => {
    if (!menuOpen || isClosing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, isClosing]);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(copyTimer.current);
    },
    [],
  );

  if (!station) return null;

  const url = `${SHARE_URL}/${station.slug}`;
  const message = `Ascultă și tu ${station.title}: \n${url}`;
  const facebookShareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`;
  const whatsappShareLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  const telegramShareLink = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Ascultă și tu ${station.title}`)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied — leave the row untouched rather than lie "copiat"
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: station.title,
        text: `Ascultă și tu ${station.title}`,
        url,
      });
      // Share completed — the task is done, tidy the menu away
      closeMenu();
    } catch {
      // Sheet dismissed — keep the menu open so another channel is one tap away
    }
  };

  const isOpen = menuOpen && !isClosing;

  return (
    <div className={styles.share_root} ref={rootRef}>
      <button
        className={`${styles.trigger} ${isOpen ? styles.trigger_open : ""}`}
        onClick={toggleMenu}
        aria-label={`Share ${station.title}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Share ${station.title}`}
      >
        <ShareNodesIcon />
        Share
      </button>
      {menuOpen && (
        <div className={`${styles.dropdown} ${isClosing ? styles.dropdown_closing : ""}`}>
          <a
            href={whatsappShareLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.menu_item}
            onClick={closeMenu}
          >
            <span className={`${styles.menu_icon} ${styles.icon_whatsapp}`} aria-hidden="true">
              <img src="/icons/whatsapp.svg" alt="" width={17} height={17} />
            </span>
            <span className={styles.menu_label}>WhatsApp</span>
          </a>
          <a
            href={facebookShareLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.menu_item}
            onClick={closeMenu}
          >
            <span className={`${styles.menu_icon} ${styles.icon_facebook}`} aria-hidden="true">
              <img src="/icons/facebook.svg" alt="" width={16} height={16} />
            </span>
            <span className={styles.menu_label}>Facebook</span>
          </a>
          <a
            href={telegramShareLink}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.menu_item}
            onClick={closeMenu}
          >
            <span className={`${styles.menu_icon} ${styles.icon_telegram}`} aria-hidden="true">
              <TelegramIcon />
            </span>
            <span className={styles.menu_label}>Telegram</span>
          </a>
          <button type="button" className={styles.menu_item} onClick={copyLink}>
            <span
              className={`${styles.menu_icon} ${copied ? styles.icon_copied : ""}`}
              aria-hidden="true"
            >
              {copied ? <CheckIcon /> : <LinkIcon />}
            </span>
            <span
              className={`${styles.menu_label} ${copied ? styles.label_copied : ""}`}
              aria-live="polite"
            >
              {copied ? "Link copiat ✓" : "Copiază linkul"}
            </span>
          </button>
          {canNativeShare && (
            <>
              <div className={styles.menu_divider} aria-hidden="true" />
              <button type="button" className={styles.menu_item} onClick={nativeShare}>
                <span className={styles.menu_icon} aria-hidden="true">
                  <ShareArrowIcon size={16} />
                </span>
                <span className={styles.menu_label}>Mai multe opțiuni…</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
