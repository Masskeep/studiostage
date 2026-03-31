import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Read preference from localStorage on first load
    return localStorage.getItem('ss_theme') === 'dark';
  });

  useEffect(() => {
    // Apply to <html> element so ALL CSS variables cascade everywhere
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('ss_theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('ss_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
