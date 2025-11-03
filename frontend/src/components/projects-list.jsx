"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Filter, SortAsc, SortDesc } from "lucide-react"
import { useProjects } from "@/contexts/project-context"
import { CreateProjectDialog } from "@/components/create-project"
import { userService } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

export function ProjectsList({ onProjectSelect }) {
  const { projects, loading, loadProjects } = useProjects()
  const { currentUserId } = useAuth()
  const [filteredProjects, setFilteredProjects] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("name") // name, created_at, updated_at
  const [sortOrder, setSortOrder] = useState("asc")
  const [filterStatus, setFilterStatus] = useState("all") // all, active, hold, completed, archived
  const [filterRole, setFilterRole] = useState("all") // all, owner, collaborator
  const [allUsers, setAllUsers] = useState([])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await userService.getAllUsers()
        setAllUsers(users || [])
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }

    fetchUsers()
    // Projects are loaded by the ProjectProvider
  }, [])

  useEffect(() => {
    let filtered = projects.filter(project => {
      // Search filter
      const matchesSearch = (project.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (project.description || '').toLowerCase().includes(searchTerm.toLowerCase())

      // Status filter
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus

      // Role filter
      let matchesRole = true
      if (filterRole === 'creator') {
        matchesRole = project.creator_id === currentUserId
      } else if (filterRole === 'manager') {
        // TODO: Update this logic when role-based system is fully implemented
        matchesRole = false // Temporarily disabled
      } else if (filterRole === 'collaborator') {
        matchesRole = project.creator_id !== currentUserId
      }

      return matchesSearch && matchesStatus && matchesRole
    })

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'name':
          aVal = (a.name || '').toLowerCase()
          bVal = (b.name || '').toLowerCase()
          break
        case 'created_at':
          aVal = new Date(a.created_at || 0)
          bVal = new Date(b.created_at || 0)
          break
        case 'updated_at':
          aVal = new Date(a.updated_at || a.created_at || 0)
          bVal = new Date(b.updated_at || b.created_at || 0)
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })

    setFilteredProjects(filtered)
  }, [projects, searchTerm, sortBy, sortOrder, filterStatus, filterRole, currentUserId])

  const getTaskCount = async (projectId) => {
    try {
      const res = await fetch(`http://localhost:3001/api/tasks/project/${projectId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        return data.tasks ? data.tasks.length : 0
      }
    } catch (error) {
      console.error('Error fetching task count:', error)
    }
    return 0
  }



  if (loading) {
    return <div className="flex-1 p-6 flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--foreground))' }}>Loading projects...</div>
  }

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-y-auto" style={{ backgroundColor: 'rgb(var(--background))' }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6" style={{ color: 'rgb(var(--foreground))' }}>My Projects</h1>

        {/* Filters and Search */}
        <div className="rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" style={{ backgroundColor: 'rgb(var(--card))' }}>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-full sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--muted-foreground))' }} />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                style={{
                  backgroundColor: 'rgb(var(--muted))',
                  borderColor: 'rgb(var(--border))',
                  color: 'rgb(var(--foreground))'
                }}
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-sm whitespace-nowrap" style={{ color: 'rgb(var(--foreground))' }}>Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border rounded px-2 sm:px-3 py-2 text-sm flex-1"
                style={{
                  backgroundColor: 'rgb(var(--muted))',
                  borderColor: 'rgb(var(--border))',
                  color: 'rgb(var(--foreground))'
                }}
              >
                <option value="name">Name</option>
                <option value="created_at">Creation Date</option>
                <option value="updated_at">Last Activity</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex-shrink-0 transition-colors"
                style={{ color: 'rgb(var(--muted-foreground))' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'rgb(var(--foreground))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgb(var(--muted-foreground))'
                }}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-2">
              <label className="text-sm whitespace-nowrap" style={{ color: 'rgb(var(--foreground))' }}>Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded px-2 sm:px-3 py-2 text-sm flex-1"
                style={{
                  backgroundColor: 'rgb(var(--muted))',
                  borderColor: 'rgb(var(--border))',
                  color: 'rgb(var(--foreground))'
                }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="hold">Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Filter Role */}
            <div className="flex items-center gap-2">
              <label className="text-sm whitespace-nowrap" style={{ color: 'rgb(var(--foreground))' }}>Role:</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="border rounded px-2 sm:px-3 py-2 text-sm flex-1"
                style={{
                  backgroundColor: 'rgb(var(--muted))',
                  borderColor: 'rgb(var(--border))',
                  color: 'rgb(var(--foreground))'
                }}
              >
                <option value="all">All</option>
                <option value="creator">Creator</option>
                <option value="manager">Manager</option>
                <option value="collaborator">Collaborator</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredProjects.map((project) => {
            const taskCount = project.task_count || 0
            const collaborators = project.collaborators || 'None'

            return (
              <div
                key={project.id}
                className="rounded-lg p-4 sm:p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
                style={{
                  backgroundColor: 'rgb(var(--card))',
                  borderColor: 'rgb(var(--border))',
                  border: '1px solid'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--card))'
                }}
                onClick={() => onProjectSelect(project.id)}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold line-clamp-2 flex-1 mr-2" style={{ color: 'rgb(var(--foreground))' }}>{project.name || 'Unnamed Project'}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 border font-medium ${
                    project.status === 'active' ? 'bg-green-100 dark:bg-green-600 text-green-800 dark:text-white border-green-300 dark:border-green-600' :
                    project.status === 'hold' ? 'bg-yellow-100 dark:bg-yellow-600 text-yellow-800 dark:text-white border-yellow-300 dark:border-yellow-600' :
                    project.status === 'completed' ? 'bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white border-blue-300 dark:border-blue-600' :
                    project.status === 'archived' ? 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600' :
                    'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600'
                  }`}>
                    {project.status === 'hold' ? 'On Hold' : (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Unknown')}
                  </span>
                </div>

                <p className="text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {project.description || 'No description'}
                </p>

                <div className="space-y-1.5 sm:space-y-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  <div className="flex items-center justify-between">
                    <span>Tasks:</span>
                    <span className="font-semibold">{taskCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Members:</span>
                    <span className="font-semibold">{collaborators}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs pt-1 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center mt-8 sm:mt-12" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <p className="text-sm sm:text-base">No projects found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}