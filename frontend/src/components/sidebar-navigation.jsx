"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
    const [isTeamsExpanded, setIsTeamsExpanded] = useState(true)
    const [projects, setProjects] = useState([])
    const [currentUserRole, setCurrentUserRole] = useState('staff')
    const currentUserId = parseInt(process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 1) // Allow override via env

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log('Fetching user data...');
                // Fetch current user info
                const userRes = await fetch('http://localhost:3001/api/users')
                console.log('User API response status:', userRes.status);
                if (userRes.ok) {
                    const usersData = await userRes.json()
                    console.log('Users data:', usersData);
                    const currentUser = usersData.users.find(u => u.id === currentUserId)
                    console.log('Current user found:', currentUser);
                    if (currentUser) {
                        console.log('Setting user role to:', currentUser.role);
                        setCurrentUserRole(currentUser.role)
                    } else {
                        console.log('User not found, defaulting to manager for testing');
                        setCurrentUserRole('manager') // Default to manager for testing
                    }
                } else {
                    console.error('Failed to fetch users:', userRes.status, userRes.statusText);
                    console.log('Defaulting to manager role for testing');
                    setCurrentUserRole('manager') // Default to manager for testing
                }

                console.log('Fetching projects...');
                // Fetch projects (backend will filter based on user permissions)
                const response = await fetch('http://localhost:3001/api/projects')
                console.log('Projects API response status:', response.status);
                console.log('Projects API response ok:', response.ok);
                const rawText = await response.text();
                console.log('Projects API raw response:', rawText);
                const data = JSON.parse(rawText);
                console.log('Projects data:', data);
                if (data.success) {
                    console.log('Setting projects from API:', data.projects);
                    setProjects(data.projects)
                } else {
                    console.log('Projects API failed, using sample data for testing');
                    // Add sample projects for testing
                    setProjects([
                        { id: 1, name: 'Website Redesign' },
                        { id: 3, name: 'Database Migration' },
                        { id: 5, name: 'Security Audit' }
                    ])
                }
            } catch (error) {
                console.error('Error fetching data:', error)
                console.log('Using fallback data for testing');
                setCurrentUserRole('manager') // Default to manager for testing
                setProjects([
                    { id: 1, name: 'Website Redesign' },
                    { id: 3, name: 'Database Migration' },
                    { id: 5, name: 'Security Audit' }
                ])
            }
        }
        fetchData()
    }, []) // Remove currentUserRole dependency to avoid timing issues

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

                {currentUserRole === 'manager' && (
                    isCollapsed ? (
                        <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-2">
                            <Plus className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                        </Button>
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
                                        {currentUserRole === 'manager' && <Plus className="w-4 h-4" />}
                                    </div>
                                    {isProjectsExpanded && (
                                        <nav className="space-y-1">
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
                            )}

                            {/* Teams Section */}
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
