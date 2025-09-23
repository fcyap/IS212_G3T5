"use client"

import { useState } from "react"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { ProjectHeader } from "@/components/project-header"
import { KanbanBoard } from "@/components/kanban-board"
import { CommentBox } from "@/components/task-comment/task-comment"
import { CommentItem } from "@/components/task-comment/task-comment-item"
import { CommentSection } from "@/components/task-comment/task-comment-section"

export default function ProjectTimelinePage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <div className="flex h-screen bg-[#1a1a1d] dark">
      <SidebarNavigation isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? "ml-0" : "ml-0"}`}>
        <ProjectHeader />
        <KanbanBoard />
        <CommentSection />
      </div>
    </div>
  )
}
