"use client";

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
      // Request all tasks with maximum page size to get accurate counts
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tasks?limit=1000`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        // API can return either an array directly or an object with tasks property
        const tasks = Array.isArray(data) ? data : (data.tasks || [])

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
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'rgb(var(--background))' }}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: 'rgb(var(--foreground))', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated (SessionProvider will handle this, but show nothing while it does)
  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--background))' }}>
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
        <div className="lg:hidden border-b p-3 flex items-center justify-between" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ color: 'rgb(var(--foreground))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-semibold text-lg" style={{ color: 'rgb(var(--foreground))' }}>G3T5 Project Manager</h1>
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
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto" style={{ backgroundColor: 'rgb(var(--background))' }}>
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Welcome Header */}
                <div className="mb-8">
                  <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
                    {getGreeting()}, {user?.name || 'User'}!
                  </h1>
                  <p style={{ color: 'rgb(var(--muted-foreground))' }}>Here&apos;s what&apos;s happening with your projects today</p>
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
                    <div className="rounded-xl p-4 sm:p-6 border" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'rgb(var(--foreground))' }}>
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        Quick Actions
                      </h2>
                      <div className="space-y-3">
                        <button
                          onClick={() => handleViewSelect('board')}
                          className="w-full text-left p-3 sm:p-4 rounded-lg hover:bg-blue-600 hover:text-white active:bg-blue-700 transition-all duration-200 hover:translate-x-1 flex items-center gap-3 group touch-manipulation min-h-[44px]"
                          style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
                        >
                          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-white/20">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">Task Board</div>
                            <div className="text-xs group-hover:text-blue-100" style={{ color: 'rgb(var(--muted-foreground))' }}>Manage your tasks</div>
                          </div>
                        </button>
                        <button
                          onClick={() => handleViewSelect('projects')}
                          className="w-full text-left p-3 sm:p-4 rounded-lg hover:bg-green-600 hover:text-white active:bg-green-700 transition-all duration-200 hover:translate-x-1 flex items-center gap-3 group touch-manipulation min-h-[44px]"
                          style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
                        >
                          <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center group-hover:bg-white/20">
                            <FolderOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">All Projects</div>
                            <div className="text-xs group-hover:text-green-100" style={{ color: 'rgb(var(--muted-foreground))' }}>View all projects</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Projects */}
                  <div className="lg:col-span-2">
                    <div className="rounded-xl p-4 sm:p-6 border" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: 'rgb(var(--foreground))' }}>
                        <Calendar className="w-5 h-5 text-purple-400" />
                        Recent Projects
                      </h2>
                      {projectsLoading ? (
                        <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>Loading projects...</div>
                      ) : projects && projects.length > 0 ? (
                        <div className="space-y-3">
                          {projects.slice(0, 3).map((project) => (
                            <button
                              key={project.id}
                              onClick={() => handleProjectSelect(project.id)}
                              className="w-full text-left p-3 sm:p-4 rounded-lg transition-all duration-200 hover:translate-x-1 touch-manipulation min-h-[44px]"
                              style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgb(var(--accent))'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium mb-1" style={{ color: 'rgb(var(--foreground))' }}>{project.name}</h3>
                                  <p className="text-sm line-clamp-2" style={{ color: 'rgb(var(--muted-foreground))' }}>{project.description || 'No description'}</p>
                                </div>
                                <span className={`ml-3 text-xs px-2 py-1 rounded-full flex-shrink-0 border font-medium ${
                                  project.status === 'active' ? 'bg-green-100 dark:bg-green-600 text-green-800 dark:text-white border-green-300 dark:border-green-600' :
                                  project.status === 'hold' ? 'bg-yellow-100 dark:bg-yellow-600 text-yellow-800 dark:text-white border-yellow-300 dark:border-yellow-600' :
                                  project.status === 'completed' ? 'bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white border-blue-300 dark:border-blue-600' :
                                  'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600'
                                }`}>
                                  {project.status?.charAt(0).toUpperCase() + project.status?.slice(1) || 'Unknown'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8" style={{ color: 'rgb(var(--muted-foreground))' }}>
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
