import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'fintrex-theme';
  private platformId = inject(PLATFORM_ID);
  
  // Current theme state using Angular Signals
  theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    // Automatically apply theme changes to document element
    effect(() => {
      const currentTheme = this.theme();
      if (isPlatformBrowser(this.platformId)) {
        this.applyTheme(currentTheme);
        localStorage.setItem(this.THEME_KEY, currentTheme);
      }
    });
  }

  /**
   * Toggles between light and dark themes
   */
  toggleTheme(): void {
    this.theme.update(t => t === 'light' ? 'dark' : 'light');
  }

  /**
   * Sets a specific theme
   */
  setTheme(newTheme: Theme): void {
    this.theme.set(newTheme);
  }

  /**
   * Returns the initial theme based on localStorage or system preference
   */
  private getInitialTheme(): Theme {
    if (!isPlatformBrowser(this.platformId)) return 'light';

    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    // Check system preference if no saved preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Applies the theme to the document root
   */
  private applyTheme(theme: Theme): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Also update meta theme-color for mobile browsers if needed
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
    }
  }
}
