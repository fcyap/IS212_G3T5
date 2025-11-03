"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project"
import { SettingsMenu } from "@/components/settings-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { useProjects } from "@/contexts/project-context"
import { useNotifications } from "@/contexts/notification-context"
import { useSession } from "@/components/session-provider"
import { useRouter } from "next/navigation"
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
          : "hover:text-white active:bg-opacity-80"
      }`}
      style={!isActive ? {
        color: 'rgb(var(--muted-foreground))',
        backgroundColor: 'transparent'
      } : {}}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
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
    const { projects, loading, error, selectedProject, selectProject } = useProjects()
    const { unreadCount } = useNotifications()
    const { user, role, loading: sessionLoading } = useSession()
    const router = useRouter()

    // Check if user can create projects (only managers and admins)
    const canCreateProject = () => {
        return user?.role === 'manager' || user?.role === 'admin'
    }

    // Notification count is now provided by NotificationContext - no need to fetch separately

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
            className={`${isCollapsed ? "w-16" : "w-64"} flex flex-col h-screen transition-all duration-300 flex-shrink-0 border-r safe-area-inset-left`}
            style={{
                backgroundColor: 'rgb(var(--card))',
                color: 'rgb(var(--foreground))',
                borderColor: 'rgb(var(--border))'
            }}
        >
            {/* Header */}
            <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 rounded transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        style={{
                            color: 'rgb(var(--foreground))'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                        aria-label="Toggle sidebar"
                    >
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
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors relative touch-manipulation min-h-[44px]"
                                style={{
                                    color: 'rgb(var(--muted-foreground))',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
                                    e.currentTarget.style.color = 'rgb(var(--foreground))'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                    e.currentTarget.style.color = 'rgb(var(--muted-foreground))'
                                }}
                            >
                                <Bell className="w-4 h-4" />
                                <span className="flex-1 text-left">Notifications</span>
                                {unreadCount > 0 && (
                                    <span className="bg-red-100 dark:bg-red-500 text-red-800 dark:text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold border border-red-300 dark:border-red-500">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {isCollapsed && (
                            <button
                                onClick={handleNotificationClick}
                                className="w-full flex items-center justify-center px-3 py-2 text-sm rounded-lg transition-colors relative touch-manipulation min-h-[44px]"
                                style={{
                                    color: 'rgb(var(--muted-foreground))',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
                                    e.currentTarget.style.color = 'rgb(var(--foreground))'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                    e.currentTarget.style.color = 'rgb(var(--muted-foreground))'
                                }}
                            >
                                <Bell className="w-4 h-4" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-100 dark:bg-red-500 text-red-800 dark:text-white text-xs rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-semibold border border-red-300 dark:border-red-500">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        )}
                        
                        {/* Theme Toggle */}
                        <div className="mt-2">
                            <ThemeToggle isCollapsed={isCollapsed} />
                        </div>
                        
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
                                    <div className="flex items-center justify-between px-3 py-2 text-sm font-medium" style={{ color: 'rgb(var(--card-foreground))' }}>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setIsProjectsExpanded(!isProjectsExpanded);
                                                    if (!isProjectsExpanded) {
                                                        onViewSelect('projects');
                                                    }
                                                }}
                                                className="p-0 transition-colors"
                                                style={{ backgroundColor: 'transparent', color: 'rgb(var(--card-foreground))' }}
                                            >
                                                {isProjectsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                            <span
                                                className="cursor-pointer transition-colors"
                                                style={{ color: 'rgb(var(--card-foreground))' }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--card-foreground))'}
                                                onClick={() => onViewSelect('projects')}
                                            >
                                                My Projects
                                            </span>
                                        </div>
                                        {canCreateProject() && (
                                            <CreateProjectDialog>
                                                <button
                                                  className="transition-colors"
                                                  style={{ color: 'rgb(var(--muted-foreground))' }}
                                                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
                                                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
                                                >
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
                                                <div className="px-3 py-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
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
                <div className="p-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    {isCollapsed ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center justify-center p-2 rounded-lg" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-semibold">
                                    {initials}
                                </div>
                            </div>
                            <SettingsMenu />
                        </div>
                    ) : (
                        <div className="rounded-lg p-3" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-semibold">
                                    {initials}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium" style={{ color: 'rgb(var(--card-foreground))' }}>{displayName}</div>
                                    <div className="text-xs capitalize" style={{ color: 'rgb(var(--muted-foreground))' }}>
                                        {roleLabel}
                                        {user.division && ` - ${user.division}`}
                                    </div>
                                </div>
                                <SettingsMenu />
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    )
}
