import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  effectiveTheme: 'light' | 'dark'; // 实际应用的主题
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme 必须在 ThemeProvider 中使用');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light'); // 默认主题改为浅色
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // 挂载时从 localStorage 加载主题
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  // 计算有效主题
  useEffect(() => {
    const calculateEffectiveTheme = (): 'light' | 'dark' => {
      if (theme === 'system') {
        // 检测系统主题偏好
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme as 'light' | 'dark';
    };

    const updateEffectiveTheme = () => {
      setEffectiveTheme(calculateEffectiveTheme());
    };

    updateEffectiveTheme();

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateEffectiveTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  useEffect(() => {
    // 将有效主题应用到文档
    // Apply effective theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);

    // 为 markdown 编辑器更新 data-color-mode
    // Update data-color-mode for markdown editor
    document.documentElement.setAttribute('data-color-mode', effectiveTheme);

    // 将主题保存到 localStorage
    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [effectiveTheme, theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};