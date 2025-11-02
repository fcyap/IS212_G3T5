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
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors hover:text-white ${
        isCollapsed ? 'justify-center' : ''
      }`}
      style={{ 
        color: 'rgb(var(--muted-foreground))',
        backgroundColor: 'transparent'
      }}
      onMouseEnter={(e) => (e.target.style.backgroundColor = 'rgb(var(--muted))')}
      onMouseLeave={(e) => (e.target.style.backgroundColor = 'transparent')}
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