"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Filter, SortAsc, SortDesc } from "lucide-react"
import { useProjects } from "@/contexts/project-context"
import { CreateProjectDialog } from "@/components/create-project"

export function ProjectsList({ onProjectSelect }) {
  const { projects, loading, loadProjects } = useProjects()
  console.log('📋 [ProjectsList] Component rendered - projects:', projects?.length, 'loading:', loading);
  
  const [filteredProjects, setFilteredProjects] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("name") // name, created_at, updated_at
  const [sortOrder, setSortOrder] = useState("asc")
  const [filterStatus, setFilterStatus] = useState("all") // all, active, hold, completed, archived
  const [filterRole, setFilterRole] = useState("all") // all, owner, collaborator
  const [allUsers, setAllUsers] = useState([])
  const currentUserId = parseInt(process.env.NEXT_PUBLIC_USER_ID || 1)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await fetch('http://localhost:3001/api/users')
        if (usersRes.ok) {
          const usersData = await usersRes.json()
          setAllUsers(usersData.users || [])
        }
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }

    fetchUsers()
    // Projects are loaded by the ProjectProvider
  }, [])

  useEffect(() => {
    console.log('🔍 [ProjectsList] Filtering projects - raw projects:', projects);
    console.log('🔍 [ProjectsList] Projects type:', typeof projects, 'Array:', Array.isArray(projects));
    
    if (!projects) {
      console.log('❌ [ProjectsList] No projects array');
      setFilteredProjects([]);
      return;
    }

    let filtered = projects.filter(project => {
      console.log('🔍 [ProjectsList] Filtering project:', project.name, 'status:', project.status);
      
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

      console.log('🔍 [ProjectsList] Filter results for', project.name, '- search:', matchesSearch, 'status:', matchesStatus, 'role:', matchesRole);
      return matchesSearch && matchesStatus && matchesRole
    })

    console.log('🔍 [ProjectsList] Filtered projects:', filtered.length, 'from', projects.length);

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
      const res = await fetch(`http://localhost:3001/api/tasks/project/${projectId}`)
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
    return <div className="flex-1 bg-[#1a1a1d] p-6 flex items-center justify-center text-white">Loading projects...</div>
  }

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">My Projects</h1>

        {/* Filters and Search */}
        <div className="bg-[#2a2a2e] rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2"
              >
                <option value="name">Name</option>
                <option value="created_at">Creation Date</option>
                <option value="updated_at">Last Activity</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-gray-400 hover:text-white"
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2"
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
              <label className="text-white text-sm">Role:</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const taskCount = project.task_count || 0
            const collaborators = project.collaborators || 'None'

            return (
              <div
                key={project.id}
                className="bg-[#2a2a2e] rounded-lg p-6 cursor-pointer hover:bg-[#3a3a3e] transition-colors"
                onClick={() => onProjectSelect(project.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{project.name || 'Unnamed Project'}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    project.status === 'active' ? 'bg-green-600 text-white' :
                    project.status === 'hold' ? 'bg-yellow-600 text-white' :
                    project.status === 'completed' ? 'bg-blue-600 text-white' :
                    project.status === 'archived' ? 'bg-gray-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {project.status === 'hold' ? 'On Hold' : (project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Unknown')}
                  </span>
                </div>

                <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                  {project.description || 'No description'}
                </p>

                <div className="space-y-2 text-xs text-gray-400">
                  <div>Tasks: {taskCount}</div>
                  <div>Project Members: {collaborators}</div>
                  <div>Created: {project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Unknown'}</div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center text-gray-400 mt-12">
            No projects found matching your criteria.
          </div>
        )}
      </div>
    </div>
  )
}