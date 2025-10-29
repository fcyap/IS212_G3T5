"use client";

import { useState, useEffect } from "react"
import { useSession } from "@/components/session-provider"
import { useRouter, useSearchParams } from "next/navigation"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { BoardHeader } from "@/components/board-header"
import { KanbanBoard } from "@/components/kanban-board"
import { ProjectsList } from "@/components/projects-list"
import { ProjectDetails } from "@/components/project-details"
import { CommentBox } from "@/components/task-comment/task-comment"
import { CommentItem } from "@/components/task-comment/task-comment-item"
import { KanbanProvider } from "@/components/kanban-context"
import { useProjects } from "@/contexts/project-context"
import { FolderOpen, CheckCircle2, Clock, AlertCircle, TrendingUp, Calendar } from "lucide-react"
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Read state from URL
  const selectedProjectId = searchParams.get('project') ? Number(searchParams.get('project')) : null
  const currentView = searchParams.get('view') || 'home'

  const { user, loading: sessionLoading } = useSession()
  const { projects, loading: projectsLoading } = useProjects()
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0
  })

  // Define fetchTaskStats before useEffect
  const fetchTaskStats = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        const tasks = data.tasks || []
        
        const completed = tasks.filter(t => t.status === 'completed').length
        const pending = tasks.filter(t => t.status === 'pending').length
        const now = new Date()
        const overdue = tasks.filter(t => 
          t.status !== 'completed' && t.deadline && new Date(t.deadline) < now
        ).length

        setStats(prev => ({
          ...prev,
          completedTasks: completed,
          pendingTasks: pending,
          overdueTasks: overdue
        }))
      }
    } catch (error) {
      console.error('Error fetching task stats:', error)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed)
  const toggleMobileSidebar = () => setIsMobileSidebarOpen(!isMobileSidebarOpen)

  const handleProjectSelect = (projectId) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('project', projectId.toString())
    params.delete('view') // Clear view when selecting project
    router.push(`/?${params.toString()}`)
    setIsMobileSidebarOpen(false)
  }

  const handleViewSelect = (view) => {
    const params = new URLSearchParams()
    params.set('view', view)
    router.push(`/?${params.toString()}`)
    setIsMobileSidebarOpen(false)
  }

  const handleBackToBoard = () => {
    router.push('/')
  }

  // useEffect must come after all useState calls but before conditional returns
  useEffect(() => {
    if (projects && projects.length > 0) {
      const activeProjects = projects.filter(p => p.status === 'active').length
      setStats(prev => ({
        ...prev,
        totalProjects: projects.length,
        activeProjects
      }))

      // Fetch task stats
      fetchTaskStats()
    }
  }, [projects])

  // Show loading state while checking authentication (after all hooks)
  if (sessionLoading) {
    return (
      <div className="flex h-screen bg-[#1a1a1d] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated (SessionProvider will handle this, but show nothing while it does)
  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen bg-[#1a1a1d] dark overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transform transition-transform duration-300 lg:transform-none ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <SidebarNavigation 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={toggleSidebar}
          onProjectSelect={handleProjectSelect}
          onViewSelect={handleViewSelect}
          selectedProjectId={selectedProjectId}
          currentView={currentView}
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
        {/* Mobile Menu Button */}
        <div className="lg:hidden bg-[#1f1f23] border-b border-gray-700 p-3 flex items-center justify-between">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 text-white hover:bg-gray-700 active:bg-gray-600 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-white font-semibold text-lg">G3T5 Project Manager</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <KanbanProvider>
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
              <BoardHeader />
              <KanbanBoard />
            </>
          ) : currentView === 'home' ? (
            <div className="flex-1 bg-[#1a1a1d] p-3 sm:p-6 overflow-y-auto">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Welcome Header */}
                <div className="mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                    {getGreeting()}, {user?.name || 'User'}!
                  </h1>
                  <p className="text-gray-400">Here&apos;s what&apos;s happening with your projects today</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Total Projects */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 sm:hover:scale-105 cursor-pointer touch-manipulation">
                    <div className="flex items-center justify-between mb-3">
                      <FolderOpen className="w-8 h-8 text-white/90" />
                      <div className="bg-white/20 rounded-lg px-2 py-1">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.totalProjects}</div>
                    <div className="text-blue-100 text-sm font-medium">Total Projects</div>
                  </div>

                  {/* Active Projects */}
                  <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 sm:hover:scale-105 cursor-pointer touch-manipulation">
                    <div className="flex items-center justify-between mb-3">
                      <CheckCircle2 className="w-8 h-8 text-white/90" />
                      <div className="bg-white/20 rounded-lg px-2 py-1">
                        <span className="text-xs text-white font-semibold">{stats.activeProjects}</span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.activeProjects}</div>
                    <div className="text-green-100 text-sm font-medium">Active Projects</div>
                  </div>

                  {/* Pending Tasks */}
                  <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 sm:hover:scale-105 cursor-pointer touch-manipulation">
                    <div className="flex items-center justify-between mb-3">
                      <Clock className="w-8 h-8 text-white/90" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.pendingTasks}</div>
                    <div className="text-amber-100 text-sm font-medium">Pending Tasks</div>
                  </div>

                  {/* Overdue Tasks */}
                  <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 sm:hover:scale-105 cursor-pointer touch-manipulation">
                    <div className="flex items-center justify-between mb-3">
                      <AlertCircle className="w-8 h-8 text-white/90" />
                      {stats.overdueTasks > 0 && (
                        <div className="bg-white/20 rounded-lg px-2 py-1">
                          <span className="text-xs text-white font-semibold">!</span>
                        </div>
                      )}
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stats.overdueTasks}</div>
                    <div className="text-red-100 text-sm font-medium">Overdue Tasks</div>
                  </div>
                </div>

                {/* Quick Actions & Recent Projects */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Quick Actions */}
                  <div className="lg:col-span-1">
                    <div className="bg-[#2a2a2e] rounded-xl p-4 sm:p-6 border border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        Quick Actions
                      </h2>
                      <div className="space-y-3">
                        <button
                          onClick={() => handleViewSelect('board')}
                          className="w-full text-left p-3 sm:p-4 bg-[#1f1f23] rounded-lg text-gray-300 hover:bg-blue-600 hover:text-white active:bg-blue-700 transition-all duration-200 hover:translate-x-1 flex items-center gap-3 group touch-manipulation min-h-[44px]"
                        >
                          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-white/20">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">Task Board</div>
                            <div className="text-xs text-gray-400 group-hover:text-blue-100">Manage your tasks</div>
                          </div>
                        </button>
                        <button
                          onClick={() => handleViewSelect('projects')}
                          className="w-full text-left p-3 sm:p-4 bg-[#1f1f23] rounded-lg text-gray-300 hover:bg-green-600 hover:text-white active:bg-green-700 transition-all duration-200 hover:translate-x-1 flex items-center gap-3 group touch-manipulation min-h-[44px]"
                        >
                          <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center group-hover:bg-white/20">
                            <FolderOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">All Projects</div>
                            <div className="text-xs text-gray-400 group-hover:text-green-100">View all projects</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Projects */}
                  <div className="lg:col-span-2">
                    <div className="bg-[#2a2a2e] rounded-xl p-4 sm:p-6 border border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        Recent Projects
                      </h2>
                      {projectsLoading ? (
                        <div className="text-gray-400 text-center py-8">Loading projects...</div>
                      ) : projects && projects.length > 0 ? (
                        <div className="space-y-3">
                          {projects.slice(0, 3).map((project) => (
                            <button
                              key={project.id}
                              onClick={() => handleProjectSelect(project.id)}
                              className="w-full text-left p-3 sm:p-4 bg-[#1f1f23] rounded-lg hover:bg-[#3a3a3e] active:bg-[#4a4a4e] transition-all duration-200 hover:translate-x-1 touch-manipulation min-h-[44px]"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="text-white font-medium mb-1">{project.name}</h3>
                                  <p className="text-gray-400 text-sm line-clamp-2">{project.description || 'No description'}</p>
                                </div>
                                <span className={`ml-3 text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                                  project.status === 'active' ? 'bg-green-600 text-white' :
                                  project.status === 'hold' ? 'bg-yellow-600 text-white' :
                                  project.status === 'completed' ? 'bg-blue-600 text-white' :
                                  'bg-gray-600 text-white'
                                }`}>
                                  {project.status?.charAt(0).toUpperCase() + project.status?.slice(1) || 'Unknown'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center py-8">
                          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No projects yet. Create one to get started!</p>
                        </div>
                      )}
                    </div>
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
    </div>
  );
}

export default function Page() {
  return <ProtectedProjectTimelinePage />;
}
