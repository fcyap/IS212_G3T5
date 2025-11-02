"use client"

import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useSettings } from '@/contexts/settings-context'

export function ThemeToggle({ isCollapsed = false }) {
  const { settings, updateTheme } = useSettings()

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark'
    updateTheme(newTheme)
  }

  return (
    <button
      onClick={toggleTheme}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
        isCollapsed ? 'justify-center' : ''
      }`}
      style={{
        color: 'rgb(var(--muted-foreground))',
        backgroundColor: 'transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
        e.currentTarget.style.color = 'rgb(var(--foreground))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
      }}
      title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {settings.theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      {!isCollapsed && (
        <span className="flex-1 text-left">
          {settings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  )
}