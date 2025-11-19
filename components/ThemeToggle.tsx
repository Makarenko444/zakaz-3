"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Предотвращаем гидратацию mismatch
  if (!mounted) {
    return (
      <button className="theme-toggle" aria-label="Переключить тему">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3.5C6.41 3.5 3.5 6.41 3.5 10C3.5 13.59 6.41 16.5 10 16.5C13.59 16.5 16.5 13.59 16.5 10C16.5 6.41 13.59 3.5 10 3.5ZM10 15.5C6.96 15.5 4.5 13.04 4.5 10C4.5 6.96 6.96 4.5 10 4.5C13.04 4.5 15.5 6.96 15.5 10C15.5 13.04 13.04 15.5 10 15.5Z" fill="currentColor" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={theme === "light" ? "Переключить на темную тему" : "Переключить на светлую тему"}
      title={theme === "light" ? "Темная тема" : "Светлая тема"}
    >
      {theme === "light" ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 3.5C6.41 3.5 3.5 6.41 3.5 10C3.5 13.59 6.41 16.5 10 16.5C13.59 16.5 16.5 13.59 16.5 10C16.5 6.41 13.59 3.5 10 3.5ZM10 15.5C6.96 15.5 4.5 13.04 4.5 10C4.5 6.96 6.96 4.5 10 4.5C13.04 4.5 15.5 6.96 15.5 10C15.5 13.04 13.04 15.5 10 15.5Z"
            fill="currentColor"
          />
          <path
            d="M10 0.5C9.72 0.5 9.5 0.72 9.5 1V2C9.5 2.28 9.72 2.5 10 2.5C10.28 2.5 10.5 2.28 10.5 2V1C10.5 0.72 10.28 0.5 10 0.5Z"
            fill="currentColor"
          />
          <path
            d="M10 17.5C9.72 17.5 9.5 17.72 9.5 18V19C9.5 19.28 9.72 19.5 10 19.5C10.28 19.5 10.5 19.28 10.5 19V18C10.5 17.72 10.28 17.5 10 17.5Z"
            fill="currentColor"
          />
          <path
            d="M19 9.5H18C17.72 9.5 17.5 9.72 17.5 10C17.5 10.28 17.72 10.5 18 10.5H19C19.28 10.5 19.5 10.28 19.5 10C19.5 9.72 19.28 9.5 19 9.5Z"
            fill="currentColor"
          />
          <path
            d="M2 9.5H1C0.72 9.5 0.5 9.72 0.5 10C0.5 10.28 0.72 10.5 1 10.5H2C2.28 10.5 2.5 10.28 2.5 10C2.5 9.72 2.28 9.5 2 9.5Z"
            fill="currentColor"
          />
          <path
            d="M16.01 3.28C15.81 3.08 15.49 3.08 15.29 3.28L14.59 3.98C14.39 4.18 14.39 4.5 14.59 4.7C14.79 4.9 15.11 4.9 15.31 4.7L16.01 4C16.21 3.8 16.21 3.48 16.01 3.28Z"
            fill="currentColor"
          />
          <path
            d="M5.41 15.3C5.21 15.1 4.89 15.1 4.69 15.3L3.99 16C3.79 16.2 3.79 16.52 3.99 16.72C4.19 16.92 4.51 16.92 4.71 16.72L5.41 16.02C5.61 15.82 5.61 15.5 5.41 15.3Z"
            fill="currentColor"
          />
          <path
            d="M16.01 16C15.81 15.8 15.49 15.8 15.29 16L14.59 16.7C14.39 16.9 14.39 17.22 14.59 17.42C14.79 17.62 15.11 17.62 15.31 17.42L16.01 16.72C16.21 16.52 16.21 16.2 16.01 16Z"
            fill="currentColor"
          />
          <path
            d="M5.41 4.7C5.61 4.9 5.93 4.9 6.13 4.7C6.33 4.5 6.33 4.18 6.13 3.98L5.43 3.28C5.23 3.08 4.91 3.08 4.71 3.28C4.51 3.48 4.51 3.8 4.71 4L5.41 4.7Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 3.5C6.41 3.5 3.5 6.41 3.5 10C3.5 13.59 6.41 16.5 10 16.5C10.69 16.5 11.36 16.39 12 16.18C10.85 15.47 10 14.2 10 12.75C10 10.68 11.68 9 13.75 9C15.2 9 16.47 9.85 17.18 11C17.39 10.36 17.5 9.69 17.5 9C17.5 5.41 14.59 2.5 11 2.5C10.67 2.5 10.33 2.52 10 2.56V3.5Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
