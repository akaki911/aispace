
import { useState, useEffect } from 'react';

export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    
    if (isDarkMode) {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#0f172a';
      localStorage.setItem('darkMode', 'true');
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      localStorage.setItem('darkMode', 'false');
    }
    
    // Force a repaint for better visual transition
    root.style.transition = 'background-color 0.3s ease';
  }, [isDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set preference
      const hasManualPreference = localStorage.getItem('darkMode') !== null;
      if (!hasManualPreference) {
        setIsDarkMode(e.matches);
      }
    };

    // Check if addEventListener is supported (modern browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => !prev);
  };

  const setLightMode = () => {
    setIsDarkMode(false);
  };

  const setDarkModeState = () => {
    setIsDarkMode(true);
  };

  return {
    isDarkMode,
    toggleDarkMode,
    setLightMode,
    setDarkMode: setDarkModeState
  };
};
