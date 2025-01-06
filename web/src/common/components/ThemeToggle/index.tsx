import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import styles from "./styles.module.scss";

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    setDropdownOpen(false);
  };

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const themeNames: { [key: string]: string } = {
    system: "Sistem",
    light: "Luminos",
    dark: "Întunecat",
  };

  if (!mounted) {
    return null;
  }

  const currentTheme = theme || "system";

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        className={styles.dropdownButton}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
      >
        <span className={styles.buttonContent}>
          {currentTheme === "system" && (
            <img
              src={
                resolvedTheme === "light" ? "/icons/sun.svg" : "/icons/luna.svg"
              }
              alt={resolvedTheme === "light" ? "sun" : "moon"}
              height={20}
              width={20}
            />
          )}
          {currentTheme === "light" && (
            <img
              src={"/icons/sun.svg"}
              alt={"sun"}
              height={20}
              width={20}
              draggable={false}
            />
          )}
          {currentTheme === "dark" && (
            <img
              src={"/icons/luna.svg"}
              alt={"moon"}
              height={20}
              width={20}
              draggable={false}
            />
          )}
        </span>
      </button>
      {dropdownOpen && (
        <ul className={styles.dropdownMenu}>
          <li onClick={() => handleThemeChange("system")}>
            {themeNames["system"]}
          </li>
          <li onClick={() => handleThemeChange("light")}>
            {themeNames["light"]}
          </li>
          <li onClick={() => handleThemeChange("dark")}>
            {themeNames["dark"]}
          </li>
        </ul>
      )}
    </div>
  );
};

export default ThemeToggle;
