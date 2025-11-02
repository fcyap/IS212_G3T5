"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

const SettingsContext = createContext()

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light'
  taskView: 'detailed', // 'compact' | 'detailed' | 'grid'
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('user-settings')
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('user-settings', JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    }
  }, [settings, isLoaded])

  // Apply theme to document root
  useEffect(() => {
    if (isLoaded) {
      document.documentElement.setAttribute('data-theme', settings.theme)
      document.documentElement.classList.toggle('dark', settings.theme === 'dark')
      document.documentElement.classList.toggle('light', settings.theme === 'light')
    }
  }, [settings.theme, isLoaded])

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const updateTheme = (theme) => {
    updateSettings({ theme })
  }

  const updateTaskView = (taskView) => {
    updateSettings({ taskView })
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  const value = {
    settings,
    updateSettings,
    updateTheme,
    updateTaskView,
    resetSettings,
    isLoaded
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

// Export settings constants for use in components
export const THEMES = [
  { value: 'dark', label: 'Dark Mode' },
  { value: 'light', label: 'Light Mode' }
]

export const TASK_VIEWS = [
  { value: 'compact', label: 'Compact View', icon: '☰' },
  { value: 'detailed', label: 'Detailed View', icon: '📋' },
  { value: 'grid', label: 'Grid View', icon: '⊞' }
]