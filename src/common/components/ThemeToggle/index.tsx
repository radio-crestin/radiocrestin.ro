import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import styles from "./styles.module.scss";

const ThemeToggle: React.FC = () => {
  const { setTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        className={styles.dropdownButton}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
      >
        {/* Both icons are server-rendered; CSS on html[data-theme] (stamped
            pre-paint by the BaseLayout inline script) shows the right one.
            A mounted-gate here pops the button in after hydration and
            shifts the whole nav (zero-CLS contract). */}
        <span className={styles.buttonContent}>
          <img
            src={"/icons/sun.svg"}
            alt={"sun"}
            height={20}
            width={20}
            draggable={false}
            className={styles.sunIcon}
          />
          <img
            src={"/icons/luna.svg"}
            alt={"moon"}
            height={20}
            width={20}
            draggable={false}
            className={styles.moonIcon}
          />
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
