"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project"
import { useProjects } from "@/contexts/project-context"
import { useSession } from "@/components/session-provider"
import { useRouter } from "next/navigation"
import { notificationService } from "@/lib/api"
import {
    Home,
    BarChart3,
    FolderOpen,
    Plus,
    ChevronRight,
    ChevronDown,
    Menu,
    Bell,
    Inbox,
} from "lucide-react"

const NavItem = ({ icon: Icon, label, isActive, isCollapsed, onClick, hasChevron }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors touch-manipulation min-h-[44px] ${
        isActive
          ? "bg-blue-500 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white active:bg-gray-600"
      }`}
    >
      <Icon className="w-4 h-4" />
      {!isCollapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {hasChevron && <ChevronRight className="w-4 h-4" />}
        </>
      )}
    </button>
  )
}

export function SidebarNavigation({ isCollapsed, onToggleCollapse, onProjectSelect, onViewSelect, selectedProjectId, currentView }) {
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)
    const [notificationCount, setNotificationCount] = useState(0)
    const { projects, loading, error, selectedProject, selectProject } = useProjects()
    const { user, role, loading: sessionLoading } = useSession()
    const router = useRouter()

    // Check if user can create projects (only managers and admins)
    const canCreateProject = () => {
        return user?.role === 'manager' || user?.role === 'admin'
    }

    useEffect(() => {
        if (user) {
            fetchNotificationCount()
            // Refresh notification count every 2 minutes
            const interval = setInterval(fetchNotificationCount, 120000)
            return () => clearInterval(interval)
        }
    }, [user])

    const fetchNotificationCount = async () => {
        if (!user?.email) return
        
        try {
            const data = await notificationService.getUserNotifications(50, 0, false)
            const unreadNotifications = data.notifications.filter(notif => {
                if (!notif.recipient_emails) return false
                const recipients = notif.recipient_emails.split(',').map(email => email.trim())
                return recipients.includes(user.email)
            })
            setNotificationCount(unreadNotifications.length)
        } catch (err) {
            console.error('Failed to fetch notification count:', err)
            setNotificationCount(0)
        }
    }

    const handleNotificationClick = () => {
        router.push('/notifications')
    }

    const displayName = user?.name || user?.email || 'Unknown User'
    const initials = (user?.name || user?.email || 'U')
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    const roleLabel = role?.label
      || user?.role?.label
      || user?.role_label
      || user?.roleName
      || (typeof user?.role === 'string' ? user.role : null)
      || 'No Role'

    return (
        <div
            className={`${isCollapsed ? "w-16" : "w-64"} bg-[#1f1f23] text-white flex flex-col h-screen transition-all duration-300 flex-shrink-0 border-r border-gray-700 safe-area-inset-left`}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onToggleCollapse} className="p-2 hover:bg-gray-700 active:bg-gray-600 rounded transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Toggle sidebar">
                        <Menu className="w-5 h-5" />
                    </button>
                    {!isCollapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-white rounded-full"></div>
                            </div>
                            <span className="text-lg font-semibold">G3T5</span>
                        </div>
                    )}
                </div>

                {canCreateProject() && (
                    isCollapsed ? (
                        <CreateProjectDialog isCollapsed={true}>
                            <Button className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg p-2 min-h-[44px] touch-manipulation">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </CreateProjectDialog>
                    ) : (
                        <CreateProjectDialog isCollapsed={false}>
                            <Button className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg min-h-[44px] touch-manipulation">
                                <Plus className="w-4 h-4 mr-2" />
                                Create
                            </Button>
                        </CreateProjectDialog>
                    )
                )}
            </div>

            {/* Main Navigation */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                    {/* Primary Navigation */}
                    <nav className="space-y-1 mb-6">
                        <NavItem 
                          icon={Home} 
                          label="Home" 
                          isActive={currentView === 'home' && !selectedProjectId}
                          isCollapsed={isCollapsed} 
                          onClick={() => onViewSelect('home')}
                        />
                        <NavItem 
                          icon={BarChart3} 
                          label="Board" 
                          isActive={currentView === 'board' && !selectedProjectId}
                          isCollapsed={isCollapsed} 
                          onClick={() => onViewSelect('board')}
                        />
                        {!isCollapsed && (
                            <button
                                onClick={handleNotificationClick}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-gray-300 hover:bg-gray-700 hover:text-white active:bg-gray-600 relative touch-manipulation min-h-[44px]"
                            >
                                <Bell className="w-4 h-4" />
                                <span className="flex-1 text-left">Notifications</span>
                                {notificationCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                        {notificationCount > 99 ? '99+' : notificationCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {isCollapsed && (
                            <button
                                onClick={handleNotificationClick}
                                className="w-full flex items-center justify-center px-3 py-2 text-sm rounded-lg transition-colors text-gray-300 hover:bg-gray-700 hover:text-white active:bg-gray-600 relative touch-manipulation min-h-[44px]"
                            >
                                <Bell className="w-4 h-4" />
                                {notificationCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px]">
                                        {notificationCount > 9 ? '9+' : notificationCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {(user?.role === 'hr' || user?.role === 'admin') && (
                          <NavItem 
                            icon={BarChart3} 
                            label="Reports" 
                            isCollapsed={isCollapsed}
                            isActive={currentView === 'reports'}
                            onClick={() => onViewSelect('reports')}
                          />
                        )}
                    </nav>

                    {!isCollapsed && (
                        <>
                            {/* Projects Section - Show for all users who have projects */}
                            {projects.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-white">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setIsProjectsExpanded(!isProjectsExpanded);
                                                    if (!isProjectsExpanded) {
                                                        onViewSelect('projects');
                                                    }
                                                }}
                                                className="p-0 bg-[#1f1f23] text-white"
                                            >
                                                {isProjectsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                            <span
                                                className="cursor-pointer hover:text-gray-300"
                                                onClick={() => onViewSelect('projects')}
                                            >
                                                My Projects
                                            </span>
                                        </div>
                                        {canCreateProject() && (
                                            <CreateProjectDialog>
                                                <button className="text-gray-400 hover:text-white transition-colors">
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </CreateProjectDialog>
                                        )}
                                    </div>
                                {isProjectsExpanded && (
                                    <nav className="space-y-1">
                                        {error && !error.includes('Unauthorized') && (
                                            <div className="px-3 py-2 text-xs text-red-400">
                                                Error loading projects: {error}
                                            </div>
                                        )}
                                        {projects.length > 0 ? (
                                            projects.map((project) => (
                                                <NavItem
                                                    key={project.id}
                                                    icon={FolderOpen}
                                                    label={project.name}
                                                    isActive={selectedProjectId === project.id}
                                                    isCollapsed={isCollapsed}
                                                    onClick={() => onProjectSelect(project.id)}
                                                />
                                            ))
                                        ) : (
                                            !loading && (
                                                <div className="px-3 py-2 text-xs text-gray-400">
                                                    No projects available
                                                </div>
                                            )
                                        )}
                                    </nav>
                                )}
                                </div>
                            )}
                        </>
                    )}

                    {isCollapsed && (
                        <nav className="space-y-1">
                            {(user?.role === 'hr' || user?.role === 'admin') && (
                              <NavItem 
                                icon={BarChart3} 
                                label="Reports" 
                                isCollapsed={isCollapsed}
                                isActive={currentView === 'reports'}
                                onClick={() => onViewSelect('reports')}
                              />
                            )}
                            {projects.map((project) => (
                                <NavItem
                                    key={project.id}
                                    icon={FolderOpen}
                                    label={project.name}
                                    isActive={selectedProjectId === project.id}
                                    isCollapsed={isCollapsed}
                                    onClick={() => onProjectSelect(project.id)}
                                />
                            ))}
                        </nav>
                    )}
                </div>
            </div>

            {/* User Info Section */}
            {!sessionLoading && user && (
                <div className="p-4 border-t border-gray-700">
                    {isCollapsed ? (
                        <div className="flex items-center justify-center p-2 bg-gray-800 rounded-lg">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-semibold">
                                {initials}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-semibold">
                                    {initials}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{displayName}</div>
                                    <div className="text-xs text-gray-400 capitalize">
                                        {roleLabel}
                                        {user.division && ` - ${user.division}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    )
}
