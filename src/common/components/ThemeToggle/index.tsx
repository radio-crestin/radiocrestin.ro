import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";

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
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        className="p-2 cursor-pointer text-base rounded flex items-center transition-colors duration-200 bg-transparent border-0"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
      >
        <span className="flex items-center">
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
        <ul className="absolute top-[calc(100%+5px)] right-0 bg-background-card border border-border list-none m-0 p-1 min-w-[160px] z-[1000] rounded shadow-md">
          <li 
            onClick={() => handleThemeChange("system")}
            className="px-4 py-2 cursor-pointer flex items-center transition-colors duration-100 rounded-lg hover:bg-background-active text-foreground"
          >
            {themeNames["system"]}
          </li>
          <li 
            onClick={() => handleThemeChange("light")}
            className="px-4 py-2 cursor-pointer flex items-center transition-colors duration-100 rounded-lg hover:bg-background-active text-foreground"
          >
            {themeNames["light"]}
          </li>
          <li 
            onClick={() => handleThemeChange("dark")}
            className="px-4 py-2 cursor-pointer flex items-center transition-colors duration-100 rounded-lg hover:bg-background-active text-foreground"
          >
            {themeNames["dark"]}
          </li>
        </ul>
      )}
    </div>
  );
};

export default ThemeToggle;
