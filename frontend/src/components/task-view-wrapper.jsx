"use client"

import React from 'react'
import { useSettings } from '@/contexts/settings-context'
import { TaskCard } from './task-card'
import { cn } from '@/lib/utils'

export function TaskCardWrapper({ task, onClick, onUnarchive, className, ...props }) {
  const { settings } = useSettings()

  const getViewClassName = () => {
    switch (settings.taskView) {
      case 'compact':
        return 'task-compact'
      case 'detailed':
        return 'task-detailed'
      case 'grid':
        return 'task-detailed' // Grid uses detailed content but different layout
      default:
        return 'task-detailed'
    }
  }

  return (
    <div className={cn('view-transition', getViewClassName(), className)}>
      <TaskCard
        title={task.title}
        priority={task.priority}
        status={task.workflow}
        assignees={task.assignees}
        dateRange={task.dateRange}
        description={task.description}
        deadline={task.deadline}
        onClick={onClick}
        tags={task.tags}
        onUnarchive={onUnarchive}
        taskId={task.id}
        viewMode={settings.taskView}
        {...props}
      />
    </div>
  )
}

export function TaskColumn({ title, tasks, onTaskClick, onUnarchive, className, children, ...props }) {
  const { settings } = useSettings()

  const getColumnLayout = () => {
    if (settings.taskView === 'grid') {
      return 'task-grid'
    }
    return 'space-y-3'
  }

  return (
    <div className={cn('kanban-column', className)} {...props}>
      {children}
      <div className={cn('mt-4', getColumnLayout())}>
        {tasks.map((task) => (
          <TaskCardWrapper
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onUnarchive={onUnarchive}
          />
        ))}
      </div>
    </div>
  )
}

export function TaskBoardLayout({ children, className, ...props }) {
  const { settings } = useSettings()

  const getBoardLayout = () => {
    if (settings.taskView === 'grid') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'
    }
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'
  }

  return (
    <div 
      className={cn('kanban-board min-h-screen', getBoardLayout(), className)} 
      {...props}
    >
      {children}
    </div>
  )
}