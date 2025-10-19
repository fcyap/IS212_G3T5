"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project"
import { useProjects } from "@/contexts/project-context"
import { useSession } from "@/components/session-provider"
import {
    Home,
    CheckSquare,
    Inbox,
    BarChart3,
    Briefcase,
    Target,
    FolderOpen,
    Users,
    Plus,
    ChevronRight,
    ChevronDown,
    Menu,
    Settings,
    Mail,
} from "lucide-react"

const NavItem = ({ icon: Icon, label, isActive, isCollapsed, onClick, hasChevron }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
        isActive
          ? "bg-blue-500 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
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

    const { projects, loading, error, selectedProject, selectProject } = useProjects()
    const { user, role, loading: sessionLoading } = useSession()

    // Check if user can create projects (only managers and admins)
    const canCreateProject = () => {
        return user?.role === 'manager' || user?.role === 'admin'
    }

    return (
        <div
            className={`${isCollapsed ? "w-16" : "w-64"} bg-[#1f1f23] text-white flex flex-col h-screen transition-all duration-300`}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onToggleCollapse} className="p-1 hover:bg-gray-700 rounded transition-colors">
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
                            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-2">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </CreateProjectDialog>
                    ) : (
                        <CreateProjectDialog isCollapsed={false}>
                            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
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
                        <NavItem icon={CheckSquare} label="My tasks" isCollapsed={isCollapsed} />
                        <NavItem icon={Inbox} label="Inbox" isCollapsed={isCollapsed} />
                        <NavItem 
                          icon={BarChart3} 
                          label="Board" 
                          isActive={currentView === 'board' && !selectedProjectId}
                          isCollapsed={isCollapsed} 
                          onClick={() => onViewSelect('board')}
                        />
                    </nav>

                    {!isCollapsed && (
                        <>
                            {/* Insights Section */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-white">
                                    <span>Insights</span>
                                    <Plus className="w-4 h-4" />
                                </div>
                                <nav className="space-y-1">
                                    <NavItem icon={BarChart3} label="Reporting" isCollapsed={isCollapsed} />
                                    <NavItem icon={Briefcase} label="Portfolios" isCollapsed={isCollapsed} />
                                    <NavItem icon={Target} label="Goals" isCollapsed={isCollapsed} />
                                </nav>
                            </div>

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
                                                Projects
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
                                        {error && (
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
                            <NavItem icon={BarChart3} label="Reporting" isCollapsed={isCollapsed} />
                            <NavItem icon={Briefcase} label="Portfolios" isCollapsed={isCollapsed} />
                            <NavItem icon={Target} label="Goals" isCollapsed={isCollapsed} />
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
                
                            <NavItem icon={Settings} label="Settings" isCollapsed={isCollapsed} />
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
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-semibold">
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{user.name || 'Unknown User'}</div>
                                    <div className="text-xs text-gray-400 capitalize">
                                        {role?.label || user.role || 'No Role'}
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
