import { useEffect, useRef, useState } from "react";

import styles from "./styles.module.scss";
import { useTheme } from "@/hooks/useTheme";

const GearIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={21}
    height={21}
    aria-hidden="true"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const MonitorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={15}
    height={15}
    aria-hidden="true"
  >
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </svg>
);

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={15}
    height={15}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = ({ size = 15 }: { size?: number }) => (
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
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const THEME_OPTIONS = [
  { value: "system", label: "Temă sistem", icon: <MonitorIcon /> },
  { value: "light", label: "Temă luminoasă", icon: <SunIcon /> },
  { value: "dark", label: "Temă întunecată", icon: <MoonIcon /> },
];

// Single nav actions menu shared by every header: on desktop the trigger is
// a settings gear, on mobile the hamburger — both open the same glass
// dropdown (theme picker, app download, contact).
const NavMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const { theme, setTheme } = useTheme();

  const closeMenu = () => {
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      setIsClosing(false);
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

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const isOpen = menuOpen && !isClosing;

  return (
    <div className={styles.menu_root} ref={rootRef}>
      <button
        className={`${styles.settings_button} ${isOpen ? styles.settings_open : ""}`}
        onClick={toggleMenu}
        aria-label="Setări"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Setări"
      >
        <GearIcon />
      </button>
      <button
        className={styles.hamburger}
        onClick={toggleMenu}
        aria-label="Meniu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={`${styles.hamburger_line} ${isOpen ? styles.open : ""}`}></span>
        <span className={`${styles.hamburger_line} ${isOpen ? styles.open : ""}`}></span>
        <span className={`${styles.hamburger_line} ${isOpen ? styles.open : ""}`}></span>
      </button>
      {menuOpen && (
        <div className={`${styles.dropdown} ${isClosing ? styles.dropdown_closing : ""}`}>
          <div className={`${styles.menu_item} ${styles.menu_item_theme}`}>
            <span className={styles.menu_icon} aria-hidden="true">
              <MoonIcon size={17} />
            </span>
            <span className={styles.menu_label}>Temă</span>
            <div className={styles.theme_segment} role="group" aria-label="Alege tema">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={theme === option.value ? styles.segment_active : ""}
                  onClick={() => setTheme(option.value)}
                  aria-label={option.label}
                  aria-pressed={theme === option.value}
                  title={option.label}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.menu_divider} aria-hidden="true" />
          <a
            href="/descarca-aplicatia-radio-crestin/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.menu_item} ${styles.menu_item_mobile_only}`}
            onClick={closeMenu}
          >
            <span className={`${styles.menu_icon} ${styles.menu_icon_accent}`} aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width={17}
                height={17}
              >
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <span className={styles.menu_label}>Descarcă aplicația</span>
          </a>
          <a
            href="https://wa.me/40766338046?text=Buna%20ziua%20[radiocrestin.ro]%0A"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.menu_item}
            onClick={closeMenu}
          >
            <span className={`${styles.menu_icon} ${styles.menu_icon_whatsapp}`} aria-hidden="true">
              <img src="/icons/whatsapp.svg" alt="" width={19} height={19} />
            </span>
            <span className={styles.menu_label}>Contact Radio Creștin</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default NavMenu;
