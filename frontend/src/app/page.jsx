"use client";

import { useState } from "react"
import { useSession } from "@/components/session-provider"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { ProjectHeader } from "@/components/project-header"
import { KanbanBoard } from "@/components/kanban-board"
import { ProjectsList } from "@/components/projects-list"
import { ProjectDetails } from "@/components/project-details"
import { CommentBox } from "@/components/task-comment/task-comment"
import { CommentItem } from "@/components/task-comment/task-comment-item"
import { KanbanProvider } from "@/components/kanban-context"
import dynamic from 'next/dynamic'

// Dynamically import ReportsPage to avoid SSR issues
const ReportsPage = dynamic(() => import('./reports/page'), { ssr: false })

/*function RoleBadge() {
  const { role } = useSession() || {};
  if (!role) return null;
  return (
    <span className="ml-auto text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5">
      {role.label}
    </span>
  );
}*/

function ProtectedProjectTimelinePage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [currentView, setCurrentView] = useState('home') // 'home', 'board', 'projects', etc.

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed)

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId)
  }

  const handleViewSelect = (view) => {
    setCurrentView(view)
    setSelectedProjectId(null) // Clear project selection when switching views
  }

  const handleBackToBoard = () => {
    setSelectedProjectId(null)
  }

  return (
    <div className="flex h-screen bg-[#1a1a1d] dark">
      <SidebarNavigation 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={toggleSidebar}
        onProjectSelect={handleProjectSelect}
        onViewSelect={handleViewSelect}
        selectedProjectId={selectedProjectId}
        currentView={currentView}
      />
      <div className={`flex-1 flex flex-col overflow-y-auto transition-all duration-300 ${isSidebarCollapsed ? "ml-0" : "ml-0"}`}>
        <KanbanProvider>
          {currentView !== 'projects' && currentView !== 'reports' && !selectedProjectId && (
            <div className="">
              <ProjectHeader currentView={currentView} />
            </div>
          )}
          {selectedProjectId ? (
            <ProjectDetails
              projectId={selectedProjectId}
              onBack={handleBackToBoard}
            />
          ) : currentView === 'reports' ? (
            <ReportsPage />
          ) : currentView === 'projects' ? (
            <ProjectsList onProjectSelect={handleProjectSelect} />
          ) : currentView === 'board' ? (
            <>
              <KanbanBoard />
            </>
          ) : currentView === 'home' ? (
            <div className="flex-1 bg-[#1a1a1d] p-6">
              <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-8">Welcome to Project Management</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-[#2a2a2e] rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
                    <div className="space-y-3">
                      <button
                        onClick={() => setCurrentView('projects')}
                        className="w-full text-left p-3 bg-[#1f1f23] rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        View All Projects
                      </button>
                      <button
                        onClick={() => setCurrentView('board')}
                        className="w-full text-left p-3 bg-[#1f1f23] rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        Go to Board
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#2a2a2e] rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
                    <p className="text-gray-400">No recent activity to display.</p>
                  </div>
                  <div className="bg-[#2a2a2e] rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Statistics</h2>
                    <p className="text-gray-400">Project statistics will appear here.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <KanbanBoard />
            </>
          )}
        </KanbanProvider>
      </div>
    </div>
  );
}

export default function Page() {
  return <ProtectedProjectTimelinePage />;
}
