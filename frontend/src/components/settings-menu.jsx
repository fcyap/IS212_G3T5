"use client"

import React, { useState } from 'react'
import { Settings, Moon, Sun, Eye, Grid3X3, List, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useSettings, THEMES, TASK_VIEWS } from '@/contexts/settings-context'
import { Badge } from '@/components/ui/badge'

export function SettingsMenu() {
  const { settings, updateTheme, updateTaskView, resetSettings } = useSettings()
  const [isOpen, setIsOpen] = useState(false)

  const handleThemeChange = (theme) => {
    updateTheme(theme)
  }

  const handleTaskViewChange = (taskView) => {
    updateTaskView(taskView)
  }

  const getThemeIcon = (theme) => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getTaskViewIcon = (view) => {
    switch (view) {
      case 'compact':
        return <List className="h-4 w-4" />
      case 'detailed':
        return <MoreHorizontal className="h-4 w-4" />
      case 'grid':
        return <Grid3X3 className="h-4 w-4" />
      default:
        return <Eye className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Open settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Personalization</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Theme Selection */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {getThemeIcon(settings.theme)}
              <span>Theme</span>
              <Badge variant="secondary" className="ml-auto">
                {THEMES.find(t => t.value === settings.theme)?.label}
              </Badge>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {THEMES.map((theme) => (
                <DropdownMenuItem 
                  key={theme.value}
                  onClick={() => handleThemeChange(theme.value)}
                  className={settings.theme === theme.value ? "bg-accent" : ""}
                >
                  {getThemeIcon(theme.value)}
                  <span>{theme.label}</span>
                  {settings.theme === theme.value && (
                    <Badge variant="default" className="ml-auto">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Task View Selection */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {getTaskViewIcon(settings.taskView)}
              <span>Task View</span>
              <Badge variant="secondary" className="ml-auto">
                {TASK_VIEWS.find(v => v.value === settings.taskView)?.label}
              </Badge>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {TASK_VIEWS.map((view) => (
                <DropdownMenuItem 
                  key={view.value}
                  onClick={() => handleTaskViewChange(view.value)}
                  className={settings.taskView === view.value ? "bg-accent" : ""}
                >
                  {getTaskViewIcon(view.value)}
                  <span>{view.label}</span>
                  {settings.taskView === view.value && (
                    <Badge variant="default" className="ml-auto">Active</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          
          {/* Detailed Settings */}
          <DialogTrigger asChild>
            <DropdownMenuItem>
              <Settings className="h-4 w-4" />
              <span>All Settings</span>
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Detailed Settings Dialog */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Personalization Settings</DialogTitle>
          <DialogDescription>
            Customize your task management interface to match your working style.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Theme Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Theme Preference</h3>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((theme) => (
                <Button
                  key={theme.value}
                  variant={settings.theme === theme.value ? "default" : "outline"}
                  onClick={() => handleThemeChange(theme.value)}
                  className="h-12 flex-col gap-1"
                >
                  {getThemeIcon(theme.value)}
                  <span className="text-xs">{theme.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Task View Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Task List View</h3>
            <div className="grid grid-cols-3 gap-2">
              {TASK_VIEWS.map((view) => (
                <Button
                  key={view.value}
                  variant={settings.taskView === view.value ? "default" : "outline"}
                  onClick={() => handleTaskViewChange(view.value)}
                  className="h-16 flex-col gap-2"
                >
                  {getTaskViewIcon(view.value)}
                  <span className="text-xs text-center">{view.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Choose how you want to display tasks in your kanban board.
            </p>
          </div>

          {/* Current Settings Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Current Settings</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Theme:</span>
                <Badge variant="secondary">
                  {THEMES.find(t => t.value === settings.theme)?.label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Task View:</span>
                <Badge variant="secondary">
                  {TASK_VIEWS.find(v => v.value === settings.taskView)?.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Reset Settings */}
          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={resetSettings}
              className="w-full"
            >
              Reset to Default Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}