"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project"
import { useProjects } from "@/contexts/project-context"
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

export function SidebarNavigation({ isCollapsed, onToggleCollapse }) {
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)
    const [isTeamsExpanded, setIsTeamsExpanded] = useState(true)
    const { projects, loading, error, selectedProject, selectProject } = useProjects()

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
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-white rounded-full"></div>
                            </div>
                            <span className="text-lg font-semibold">G3T5</span>
                        </div>
                    )}
                </div>

                {isCollapsed ? (
                    <CreateProjectDialog>
                        <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg p-2">
                            <Plus className="w-4 h-4" />
                        </Button>
                    </CreateProjectDialog>
                ) : (
                    <CreateProjectDialog>
                        <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg">
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                        </Button>
                    </CreateProjectDialog>
                )}
            </div>

            {/* Main Navigation */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                    {/* Primary Navigation */}
                    <nav className="space-y-1 mb-6">
                        <NavItem icon={Home} label="Home" isCollapsed={isCollapsed} />
                        <NavItem icon={CheckSquare} label="My tasks" isCollapsed={isCollapsed} />
                        <NavItem icon={Inbox} label="Inbox" isCollapsed={isCollapsed} />
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

                            {/* Projects Section */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-white">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                                            className="p-0 bg-[#1f1f23] text-white"
                                        >
                                            {isProjectsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => selectProject(null)}
                                            className="hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                                        >
                                            <span>Projects</span>
                                        </button>
                                    </div>
                                    <CreateProjectDialog>
                                        <button className="p-1 hover:bg-gray-700 rounded">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </CreateProjectDialog>
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
                                                    isActive={selectedProject?.id === project.id} 
                                                    isCollapsed={isCollapsed}
                                                    onClick={() => selectProject(project.id)}
                                                />
                                            ))
                                        ) : !loading && (
                                            <div className="px-3 py-2 text-xs text-gray-400">
                                                No projects yet. Create your first project!
                                            </div>
                                        )}
                                    </nav>
                                )}
                            </div>
                            <div className="mb-6">
                                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-white">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
                                            className="p-0 bg-[#1f1f23] text-white"
                                        >
                                            {isTeamsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </button>
                                        <span>Teams</span>
                                    </div>
                                    <Plus className="w-4 h-4" />
                                </div>
                                {isTeamsExpanded && (
                                    <nav className="space-y-1">
                                        <NavItem icon={Users} label="YANG's first team" hasChevron isCollapsed={isCollapsed} />
                                    </nav>
                                )}
                            </div>
                        </>
                    )}

                    {isCollapsed && (
                        <nav className="space-y-1">
                            <NavItem icon={BarChart3} label="Reporting" isCollapsed={isCollapsed} />
                            <NavItem icon={Briefcase} label="Portfolios" isCollapsed={isCollapsed} />
                            <NavItem icon={Target} label="Goals" isCollapsed={isCollapsed} />
                            <NavItem icon={FolderOpen} label="Software Project Management" isActive isCollapsed={isCollapsed} />
                            <NavItem icon={Users} label="YANG's first team" isCollapsed={isCollapsed} />
                            <NavItem icon={Settings} label="Settings" isCollapsed={isCollapsed} />
                        </nav>
                    )}
                </div>
            </div>

            {/* Bottom Section */}
            <div className="p-4 border-t border-gray-700 space-y-3">
                {isCollapsed ? (
                    <Button variant="ghost" className="w-full text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg p-2">
                        <Mail className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button variant="ghost" className="w-full text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                        <Users className="w-4 h-4 mr-2" />
                        Invite teammates
                    </Button>
                )}
            </div>
        </div>
    )
}

function NavItem({ icon: Icon, label, isActive, hasChevron, isCollapsed, onClick }) {
    return (
        <div
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${isActive ? "bg-gray-700 text-white" : "bg-[#1f1f23] text-white hover:text-white hover:bg-gray-700"
                }`}
            title={isCollapsed ? label : undefined}
            onClick={onClick}
        >
            {isCollapsed ? (
                <Icon className="w-4 h-4 mx-auto" />
            ) : (
                <>
                    <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                    </div>
                    {hasChevron && <ChevronRight className="w-4 h-4" />}
                </>
            )}
        </div>
    )
}
