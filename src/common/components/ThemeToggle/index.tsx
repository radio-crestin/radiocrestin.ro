import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import styles from "./styles.module.scss";

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeDropdown = () => {
    setIsClosing(true);
    setTimeout(() => {
      setDropdownOpen(false);
      setIsClosing(false);
    }, 150);
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    closeDropdown();
  };

  useEffect(() => {
    if (!dropdownOpen || isClosing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen, isClosing]);

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
      {(dropdownOpen || isClosing) && (
        <ul className={`${styles.dropdownMenu} ${isClosing ? styles.closing : ''}`}>
          <li onClick={() => handleThemeChange("system")}>
            <span>🖥️</span> {themeNames["system"]}
          </li>
          <li onClick={() => handleThemeChange("light")}>
            <span>☀️</span> {themeNames["light"]}
          </li>
          <li onClick={() => handleThemeChange("dark")}>
            <span>🌙</span> {themeNames["dark"]}
          </li>
        </ul>
      )}
    </div>
  );
};

export default ThemeToggle;
