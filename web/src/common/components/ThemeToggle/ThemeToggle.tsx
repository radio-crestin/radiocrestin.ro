"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import styles from "./styles.module.scss";

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    // Always use resolvedTheme to get the actual displayed theme
    const currentTheme = resolvedTheme || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const themeNames: { [key: string]: string } = {
    light: "Luminos",
    dark: "Întunecat",
  };

  if (!mounted) {
    return null;
  }

  // Use resolvedTheme to get the actual theme (whether from system or explicitly set)
  const currentTheme = resolvedTheme || "light";

  return (
    <button
      className={styles.themeButton}
      onClick={cycleTheme}
      aria-label={`Switch theme (current: ${themeNames[currentTheme] || "Luminos"})`}
      title={themeNames[currentTheme] || "Luminos"}
    >
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
    </button>
  );
};

export default ThemeToggle;
