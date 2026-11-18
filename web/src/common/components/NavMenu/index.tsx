import { useEffect, useRef, useState } from "react";

import styles from "./styles.module.scss";
import { useTheme } from "@/hooks/useTheme";

const Icon = ({ size, children }: { size: number; children: React.ReactNode }) => (
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
    {children}
  </svg>
);

const MailIcon = ({ size = 16 }: { size?: number }) => (
  <Icon size={size}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icon>
);

const MonitorIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </Icon>
);

const SunIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </Icon>
);

const MoonIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Icon>
);

const THEME_OPTIONS = [
  { value: "system", label: "Temă sistem", Icon: MonitorIcon },
  { value: "light", label: "Temă deschisă", Icon: SunIcon },
  { value: "dark", label: "Temă închisă", Icon: MoonIcon },
];

const CLOSE_ANIMATION_MS = 140;

// Closes on a click outside `rootRef` or on Escape, while `active`.
function useDismiss(rootRef: React.RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);
}

// Round button showing the current theme; opens a small popover with the
// three theme icons.
const ThemeSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const { theme, setTheme } = useTheme();

  const close = () => {
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_ANIMATION_MS);
  };

  const isOpen = open && !closing;
  const toggle = () => (isOpen ? close() : !open && setOpen(true));

  useDismiss(rootRef, isOpen, close);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const CurrentIcon = (THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[0]).Icon;

  return (
    <div className={styles.theme_root} ref={rootRef}>
      <button
        className={`${styles.round_button} ${isOpen ? styles.round_button_open : ""}`}
        onClick={toggle}
        aria-label="Alege tema"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Alege tema"
      >
        <CurrentIcon size={16} />
      </button>
      {open && (
        <div
          className={`${styles.popover} ${closing ? styles.popover_closing : ""}`}
          role="group"
          aria-label="Alege tema"
        >
          {THEME_OPTIONS.map(({ value, label, Icon: OptionIcon }) => (
            <button
              key={value}
              className={`${styles.theme_option} ${theme === value ? styles.theme_option_active : ""}`}
              onClick={() => {
                setTheme(value);
                close();
              }}
              aria-label={label}
              aria-pressed={theme === value}
              title={label}
            >
              <OptionIcon size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Header actions shared by every page: a Contact icon button and the theme switcher.
const NavMenu = ({ contactActive = false }: { contactActive?: boolean }) => (
  <div className={styles.actions}>
    <a
      href="/contact/"
      className={`${styles.round_button} ${contactActive ? styles.round_button_current : ""}`}
      aria-current={contactActive ? "page" : undefined}
      aria-label="Contact"
      title="Contact"
    >
      <MailIcon />
    </a>
    <ThemeSwitcher />
  </div>
);

export default NavMenu;
