"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getCsrfToken } from "@/lib/csrf"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Plus, Search, X, Check, Filter, ChevronDown, ChevronRight, Edit, Trash, Archive } from "lucide-react"
import { useProjects } from "@/contexts/project-context"
import { useSession } from "@/components/session-provider"
import toast from "react-hot-toast"

export function ProjectDetails({ projectId, onBack }) {
  const [project, setProject] = useState(null)
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddMember, setShowAddMember] = useState(false)
  const [invitationMessage, setInvitationMessage] = useState("")
  const [selectedUsers, setSelectedUsers] = useState([]) // For bulk selection
  const [loading, setLoading] = useState(true)
  const [userPermissions, setUserPermissions] = useState({ canManageMembers: false, isCreator: false })
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [taskFilters, setTaskFilters] = useState({
    assignee: '',
    dueDate: '',
    priority: 'all',
    status: 'all'
  })
  const [showFilters, setShowFilters] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState(new Set())
  const [editingTask, setEditingTask] = useState(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)

  const currentUserId = parseInt(process.env.NEXT_PUBLIC_CURRENT_USER_ID || 1) // Allow override via env
  const { updateProject } = useProjects()
  const { user } = useSession() // Get current user from session

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const [projectRes, membersRes, tasksRes, usersRes] = await Promise.all([
          fetch(`http://localhost:3001/api/projects/${projectId}`),
          fetch(`http://localhost:3001/api/projects/${projectId}/members`),
          fetch(`http://localhost:3001/api/tasks/project/${projectId}`),
          fetch('http://localhost:3001/api/users')
        ])

        if (projectRes.ok) {
          const projectData = await projectRes.json()
          setProject(projectData.project)
          // Set permissions based on global user role
          setUserPermissions({
            canManageMembers: false, // Will be set after fetching user data
            isCreator: false // Will be determined from member role
          })
        }

        if (membersRes.ok) {
          const membersData = await membersRes.json()
          console.log('Members data received:', membersData);
          setMembers(membersData.members)
          // Check current user's role in this specific project
          console.log('🔍 DEBUG: currentUserId =', currentUserId, 'type:', typeof currentUserId)
          console.log('🔍 DEBUG: membersData.members =', membersData.members)
          const currentUserMember = membersData.members.find(m => m.user_id === currentUserId)
          console.log('🔍 DEBUG: currentUserMember =', currentUserMember)
          const isCurrentUserCreator = currentUserMember?.role === 'creator'
          const isCurrentUserProjectManager = currentUserMember?.role === 'manager'
          const isSystemManager = user?.role === 'manager' // Check if user is system-level manager
          console.log('🔍 DEBUG: Current user member:', currentUserMember, 'is creator:', isCurrentUserCreator, 'is project manager:', isCurrentUserProjectManager, 'is system manager:', isSystemManager)
          setUserPermissions(prev => {
            const newPermissions = {
              ...prev,
              isCreator: isCurrentUserCreator,
              canManageMembers: isCurrentUserCreator || isCurrentUserProjectManager || isSystemManager
            }
            console.log('User permissions after members:', newPermissions)
            return newPermissions
          })
        } else {
          console.error('Failed to fetch members:', membersRes.status, membersRes.statusText);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json()
          setTasks(tasksData.tasks)
        }

        if (usersRes.ok) {
          const usersData = await usersRes.json()
          setAllUsers(usersData.users)
          console.log('Users loaded:', usersData.users)
          // No longer checking global role for permissions - only project-level roles matter
          console.log('Permissions are now based only on project-level roles (creator/manager)')
        } else {
          console.error('Failed to fetch users:', usersRes.status, usersRes.statusText)
        }
      } catch (error) {
        console.error('Error fetching project data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      fetchProjectData()
    }
  }, [projectId, currentUserId])

  const filteredUsers = (allUsers || []).filter(user => {
    // Filter out existing members
    const isAlreadyMember = (members || []).some(member => member.user_id === user.id);
    if (isAlreadyMember) return false;
    
    // Apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      const nameMatch = (user.name || '').toLowerCase().includes(searchLower);
      const emailMatch = (user.email || '').toLowerCase().includes(searchLower);
      return nameMatch || emailMatch;
    }
    
    // If no search term, show all non-members
    return true;
  });

  console.log('All users:', allUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));
  console.log('Project members:', members.map(m => ({ user_id: m.user_id, name: m.name, email: m.email, role: m.role })));
  console.log('Filtered users available to add:', filteredUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));

  const handleAddMember = async (userId) => {
    try {
      console.log(`Adding user ${userId} to project ${projectId} as collaborator`);
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          userIds: [userId],
          message: invitationMessage,
          role: 'collaborator' // Default role for new members
        })
      })

      if (response.ok) {
        console.log('Successfully added member');
        // Refresh members from API
        const membersRes = await fetch(`http://localhost:3001/api/projects/${projectId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData.members);
          console.log('Updated members list:', membersData.members);
        }
        // Don't close the add member section, just clear selection if it was selected
        setSelectedUsers(selectedUsers.filter(id => id !== userId));
      } else {
        const errorData = await response.json();
        console.error('Failed to add member:', errorData.message);
        alert(`Failed to add member: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Error adding member. Please try again.');
    }
  }

  const handleBulkAddMembers = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select users to add first.');
      return;
    }

    try {
      console.log(`Adding ${selectedUsers.length} users to project ${projectId} as collaborators`);
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          userIds: selectedUsers,
          message: invitationMessage,
          role: 'collaborator' // Default role for new members
        })
      })

      if (response.ok) {
        console.log('Successfully added members');
        // Refresh members from API
        const membersRes = await fetch(`http://localhost:3001/api/projects/${projectId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData.members);
          console.log('Updated members list:', membersData.members);
        }
        // Clear selections and close add member section
        setSelectedUsers([]);
        setSearchTerm("");
        setInvitationMessage("");
        setShowAddMember(false);
        alert(`Successfully added ${selectedUsers.length} member(s) to the project!`);
      } else {
        const errorData = await response.json();
        console.error('Failed to add members:', errorData.message);
        alert(`Failed to add members: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Error adding members. Please try again.');
    }
  }

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }

  const handleRemoveMember = async (userId) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfToken
        },
        credentials: 'include'
      })

      if (response.ok) {
        // Remove member from local state using new structure
        setMembers(members.filter(member => member.user_id !== userId))
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const handleCreateTask = async ({ title, description, dueDate, priority, tags }) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description: description || null,
          priority: (priority || "Low").toLowerCase(),
          status: 'pending',
          deadline: dueDate || null,
          project_id: projectId,
          assigned_to: [],
          tags: tags || [],
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to create task: ${response.status}`)
      }

      const newTask = await response.json()
      setTasks(prev => [...prev, newTask])
      setIsAddingTask(false)
    } catch (error) {
      console.error('Error creating task:', error)
      alert(`Error creating task: ${error.message}`)
    }
  }

  const cancelAddTask = () => {
    setIsAddingTask(false)
  }

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const resetFilters = () => {
    setTaskFilters({
      assignee: '',
      dueDate: '',
      priority: 'all',
      status: 'all'
    })
  }

  const handleUpdateTask = async (taskData) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description || null,
          priority: taskData.priority.toLowerCase(),
          status: taskData.status,
          deadline: taskData.deadline || null,
          tags: taskData.tags || [],
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update task: ${response.status}`)
      }

      const updatedTask = await response.json()
      setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task))
      setEditingTask(null)
    } catch (error) {
      console.error('Error updating task:', error)
      alert(`Error updating task: ${error.message}`)
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ archived: true }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to delete task: ${response.status}`)
      }

      setTasks(prev => prev.filter(task => task.id !== taskId))
      setEditingTask(null)
    } catch (error) {
      console.error('Error deleting task:', error)
      alert(`Error deleting task: ${error.message}`)
    }
  }

  const handleArchiveProject = async () => {
    setShowArchiveConfirm(false)

    try {
      console.log(`Archiving project ${projectId}`)
      const csrfToken = await getCsrfToken();
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
      })

      if (response.ok) {
        const responseData = await response.json()
        console.log('Successfully archived project:', responseData)
        alert('Project and all its tasks have been archived successfully!')

        // Update the project state to reflect archived status
        setProject(prev => ({ ...prev, status: 'archived' }))

        // Optionally redirect back to projects list
        if (onBack) {
          onBack()
        }
      } else {
        const errorData = await response.json()
        console.error('Failed to archive project:', errorData.message)
        alert(`Failed to archive project: ${errorData.message}`)
      }
    } catch (error) {
      console.error('Error archiving project:', error)
      alert('Error archiving project. Please try again.')
    }
  }

  const handleEditProject = async (formData) => {
    try {
      const updatedProject = await updateProject(projectId, {
        name: formData.name,
        description: formData.description,
        status: formData.status
      })

      // Update local state with new project data
      setProject(prev => ({
        ...prev,
        name: formData.name,
        description: formData.description,
        status: formData.status
      }))

      setShowEditProject(false)
      toast.success("Project updated successfully!")
    } catch (error) {
      console.error("Failed to update project:", error)
      toast.error("Failed to update project. Please try again.")
    }
  }

  // Filter tasks based on current filters
  const filteredTasks = (tasks || []).filter(task => {
    if (taskFilters.assignee && !task.assigned_to?.some(userId => {
      const user = (allUsers || []).find(u => u.id === userId)
      return user && (user.name || user.email).toLowerCase().includes(taskFilters.assignee.toLowerCase())
    })) {
      return false
    }

    if (taskFilters.dueDate && task.deadline) {
      const taskDate = new Date(task.deadline).toDateString()
      const filterDate = new Date(taskFilters.dueDate).toDateString()
      if (taskDate !== filterDate) return false
    }

    if (taskFilters.priority !== 'all' && task.priority !== taskFilters.priority.toLowerCase()) {
      return false
    }

    if (taskFilters.status !== 'all' && task.status !== taskFilters.status) {
      return false
    }

    return true
  })

  // Group tasks by status
  const groupedTasks = {
    pending: filteredTasks.filter(task => task.status === 'pending'),
    in_progress: filteredTasks.filter(task => task.status === 'in_progress'),
    completed: filteredTasks.filter(task => task.status === 'completed')
  }

  // Calculate progress
  const totalTasks = (tasks || []).length
  const completedTasks = (tasks || []).filter(task => task.status === 'completed').length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  if (loading) {
    return <div className="flex-1 bg-[#1a1a1d] p-6 flex items-center justify-center text-white">Loading project...</div>
  }

  if (!project) {
    return <div className="flex-1 bg-[#1a1a1d] p-6 flex items-center justify-center text-white">Project not found</div>
  }

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Board
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <h1 className="text-2xl font-bold text-white">{project.name || 'Unnamed Project'}</h1>
            {project.status === 'archived' && (
              <span className="px-2 py-1 bg-gray-600 text-gray-200 text-sm rounded-full">
                Archived
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {userPermissions.isCreator && project.status !== 'archived' && (
              <Button
                onClick={() => setShowEditProject(true)}
                variant="outline"
                className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Project
              </Button>
            )}
            {userPermissions.canManageMembers && project.status !== 'archived' && (
              <Button
                onClick={() => setShowArchiveConfirm(true)}
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Project
              </Button>
            )}
          </div>
        </div>

        {/* Project Info */}
        <div className="bg-[#2a2a2e] rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Project Details</h2>
          <p className="text-gray-300">{project.description || "No description available."}</p>
        </div>

        {/* Members Section */}
        <div className="bg-[#2a2a2e] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Project Members</h2>
            {userPermissions.canManageMembers && (
              <Button
                onClick={() => setShowAddMember(!showAddMember)}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>

          {/* Add Member Search */}
          {showAddMember && (
            <div className="mb-4 p-4 bg-[#1f1f23] rounded-lg">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Invitation Message (optional)</label>
                <textarea
                  value={invitationMessage}
                  onChange={(e) => setInvitationMessage(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add a personal message with the invitation..."
                />
              </div>
              
              {/* Bulk Actions */}
              {filteredUsers.length > 0 && (
                <div className="flex items-center justify-between mb-4 p-3 bg-[#2a2a2e] rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">
                      {selectedUsers.length > 0 ? `${selectedUsers.length} user(s) selected` : 'Select users to add in bulk'}
                    </span>
                  </div>
                  <Button
                    onClick={handleBulkAddMembers}
                    disabled={selectedUsers.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white"
                    size="sm"
                  >
                    Add Selected ({selectedUsers.length})
                  </Button>
                </div>
              )}

              <div className="max-h-40 overflow-y-auto">
                {console.log('About to render filteredUsers:', filteredUsers)}
                {filteredUsers.length === 0 ? (
                  <div className="text-gray-400 text-sm p-2">
                    <div>No users available to add.</div>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-purple-500 text-white text-xs">
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white text-sm">{user.name || 'Unknown User'}</p>
                          <p className="text-gray-400 text-xs">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddMember(user.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            {console.log('Rendering members:', members)}
            {(members || []).map((member) => {
              console.log('Rendering member:', member);
              // New structure: properties are directly on member object
              const isCreator = member.role === 'creator';
              const userRole = member.role; // 'creator', 'manager', or 'collaborator'

              return (
                <div key={member.user_id} className="flex items-center justify-between p-3 bg-[#1f1f23] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-purple-500 text-white">
                        {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{member.name || 'Unknown User'}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          userRole === 'manager' ? 'bg-blue-600 text-white' :
                          userRole === 'creator' ? 'bg-red-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {userRole}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{member.email}</p>
                    </div>
                  </div>
                  {userPermissions.canManageMembers && userRole !== 'creator' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tasks Section */}
        <div className="bg-[#2a2a2e] rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Project Tasks</h2>
              {/* Progress Indicator */}
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-300">
                  {completedTasks}/{totalTasks} ({progressPercent}%)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:text-white"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button
                onClick={() => setIsAddingTask(true)}
                className="bg-green-500 hover:bg-green-600 text-white"
                disabled={isAddingTask}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-[#1f1f23] rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Assignee</label>
                  <Input
                    placeholder="Search assignee..."
                    value={taskFilters.assignee}
                    onChange={(e) => setTaskFilters(prev => ({ ...prev, assignee: e.target.value }))}
                    className="bg-gray-700 border-gray-600 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                  <Input
                    type="date"
                    value={taskFilters.dueDate}
                    onChange={(e) => setTaskFilters(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="bg-gray-700 border-gray-600 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <Select
                    value={taskFilters.priority}
                    onValueChange={(value) => setTaskFilters(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white text-sm">
                      <SelectValue placeholder="Any priority" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2e] border-gray-600" style={{ color: 'white' }}>
                      <SelectItem value="all" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-cyan-200">Any priority</SelectItem>
                      <SelectItem value="low" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-green-200">Low</SelectItem>
                      <SelectItem value="medium" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-amber-200">Medium</SelectItem>
                      <SelectItem value="high" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-red-200">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <Select
                    value={taskFilters.status}
                    onValueChange={(value) => setTaskFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white text-sm">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2e] border-gray-600" style={{ color: 'white' }}>
                      <SelectItem value="all" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-cyan-200">Any status</SelectItem>
                      <SelectItem value="pending" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-red-200">Pending</SelectItem>
                      <SelectItem value="in_progress" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-amber-200">In Progress</SelectItem>
                      <SelectItem value="completed" style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700 data-[highlighted]:bg-green-200">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:text-white"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* Add Task Form */}
          {isAddingTask && (
            <div className="mb-6">
              <ProjectTaskForm onSave={handleCreateTask} onCancel={cancelAddTask} />
            </div>
          )}

          {/* Tasks organized by status */}
          {Object.keys(groupedTasks).map(status => {
            const statusTasks = groupedTasks[status]
            const statusLabels = {
              pending: 'Pending',
              in_progress: 'In Progress',
              completed: 'Completed'
            }
            const statusColors = {
              pending: 'bg-yellow-600',
              in_progress: 'bg-blue-600',
              completed: 'bg-green-600'
            }

            return (
              <div key={status} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${statusColors[status]}`}></div>
                  <h3 className="text-white font-medium">{statusLabels[status]}</h3>
                  <span className="text-sm text-gray-400">({statusTasks.length})</span>
                </div>

                <div className="space-y-2">
                  {statusTasks.length === 0 ? (
                    <div className="p-4 bg-[#1f1f23] rounded-lg">
                      <p className="text-gray-400 text-sm">No {statusLabels[status].toLowerCase()} tasks</p>
                    </div>
                  ) : (
                    statusTasks.map((task) => {
                      const isExpanded = expandedTasks.has(task.id)
                      const assigneeNames = task.assigned_to?.map(userId => {
                        const user = (allUsers || []).find(u => u.id === userId)
                        return user ? (user.name || user.email) : 'Unknown User'
                      }).join(', ') || 'Unassigned'

                      return (
                        <div key={task.id} className="bg-[#1f1f23] rounded-lg overflow-hidden">
                          <div
                            className="p-4 cursor-pointer hover:bg-[#252529] transition-colors"
                            onClick={() => toggleTaskExpansion(task.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <button className="mt-1 text-gray-400 hover:text-white">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="flex-1">
                                  <h4 className="text-white font-medium mb-1">{task.title}</h4>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="text-gray-400">Assigned to:
                                      <span className="text-blue-400 ml-1">{assigneeNames}</span>
                                    </span>
                                    {task.priority && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        task.priority === 'high' ? 'bg-red-600 text-white' :
                                        task.priority === 'medium' ? 'bg-yellow-600 text-white' :
                                        'bg-green-600 text-white'
                                      }`}>
                                        {task.priority.toUpperCase()}
                                      </span>
                                    )}
                                    {task.deadline && (
                                      <span className="text-gray-400">Due:
                                        <span className="text-purple-400 ml-1">
                                          {new Date(task.deadline).toLocaleDateString()}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded task details */}
                          {isExpanded && (
                            <div className="border-t border-gray-700 p-4 bg-[#1a1a1d]">
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Description</label>
                                  <p className="text-gray-300 text-sm">
                                    {task.description || 'No description provided'}
                                  </p>
                                </div>

                                {task.tags && task.tags.length > 0 && (
                                  <div>
                                    <label className="text-xs text-gray-400 block mb-1">Tags</label>
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.map((tag, index) => (
                                        <span
                                          key={index}
                                          className="bg-gray-700 text-gray-200 px-2 py-1 rounded-md text-xs"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs text-gray-400 block mb-1">Created</label>
                                    <p className="text-gray-300 text-sm">
                                      {task.created_at ? new Date(task.created_at).toLocaleString() : 'Unknown'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-400 block mb-1">Last Updated</label>
                                    <p className="text-gray-300 text-sm">
                                      {task.updated_at ? new Date(task.updated_at).toLocaleString() : 'Unknown'}
                                    </p>
                                  </div>
                                </div>

                                {/* Edit Task Button */}
                                <div className="flex justify-end pt-2">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingTask(task)
                                    }}
                                    size="sm"
                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Edit Task
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}

          {/* Show message if no tasks match filters */}
          {totalTasks > 0 && filteredTasks.length === 0 && !isAddingTask && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-2">No tasks match the current filters</p>
              <Button
                onClick={resetFilters}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:text-white"
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Show message if no tasks at all */}
          {totalTasks === 0 && !isAddingTask && (
            <div className="text-center py-8">
              <p className="text-gray-400">No tasks found for this project.</p>
            </div>
          )}
        </div>
      </div>

      {/* Task Editing Side Panel */}
      {editingTask && (
        <TaskEditingSidePanel
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleUpdateTask}
          onDelete={() => handleDeleteTask(editingTask.id)}
          allUsers={allUsers}
        />
      )}

      {/* Edit Project Dialog */}
      {showEditProject && (
        <EditProjectDialog
          project={project}
          open={showEditProject}
          onClose={() => setShowEditProject(false)}
          onSave={handleEditProject}
        />
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowArchiveConfirm(false)}
          />

          {/* Modal */}
          <div className="relative bg-[#2a2a2e] border border-gray-600 rounded-lg p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Archive className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Archive Project
                </h3>
                <p className="text-gray-300 text-sm mb-6">
                  Are you sure you want to archive this project? This action will:
                </p>
                <ul className="text-gray-400 text-sm mb-6 space-y-1 ml-4">
                  <li>• Set the project status to &quot;archived&quot;</li>
                  <li>• Archive all tasks within the project</li>
                  <li>• Make the project read-only</li>
                </ul>
                <p className="text-gray-400 text-sm mb-6">
                  This action cannot be undone from the interface.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
              <Button
                onClick={() => setShowArchiveConfirm(false)}
                variant="outline"
                className="border-gray-500 text-gray-300 hover:text-white hover:border-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleArchiveProject}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Project
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditProjectDialog({ project, open, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
    status: project?.status || 'active'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form data when project changes or dialog opens
  useEffect(() => {
    if (open && project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'active'
      })
    }
  }, [open, project])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      await onSave(formData)
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Error in EditProjectDialog:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1f1f23] border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Project Name
            </label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter project name..."
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter project description..."
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none"
              rows={4}
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-2">
              Status
            </label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="!bg-gray-800 !border-gray-600 !text-white">
                <SelectItem 
                  value="active" 
                  className="!text-white !hover:bg-gray-600 !focus:bg-gray-600 !data-[highlighted]:bg-gray-600 hover:!bg-gray-600 focus:!bg-gray-600"
                >
                  Active
                </SelectItem>
                <SelectItem 
                  value="hold" 
                  className="!text-white !hover:bg-gray-600 !focus:bg-gray-600 !data-[highlighted]:bg-gray-600 hover:!bg-gray-600 focus:!bg-gray-600"
                >
                  Hold
                </SelectItem>
                <SelectItem 
                  value="completed" 
                  className="!text-white !hover:bg-gray-600 !focus:bg-gray-600 !data-[highlighted]:bg-gray-600 hover:!bg-gray-600 focus:!bg-gray-600"
                >
                  Completed
                </SelectItem>
                <SelectItem 
                  value="archived" 
                  className="!text-white !hover:bg-gray-600 !focus:bg-gray-600 !data-[highlighted]:bg-gray-600 hover:!bg-gray-600 focus:!bg-gray-600"
                >
                  Archived
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-gray-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const priorityChipClasses = {
  Low: "bg-teal-200 text-teal-900",
  Medium: "bg-amber-300 text-amber-950",
  High: "bg-fuchsia-300 text-fuchsia-950",
}

function ProjectTaskForm({ onSave, onCancel }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState("")
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState("")

  const PRIORITIES = ["Low", "Medium", "High"]
  const canSave = title.trim().length > 0 && priority !== ""

  const addTagFromInput = () => {
    const v = tagInput.trim()
    if (!v) return
    if (!tags.includes(v)) setTags((prev) => [...prev, v])
    setTagInput("")
  }

  const removeTag = (index) => {
    setTags((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-[#1f1f23] p-4 shadow-sm">
      {/* Title */}
      <label className="block text-xs text-gray-400 mb-1">Title</label>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="mb-3 bg-transparent text-gray-100 border-gray-700 placeholder:text-gray-500"
      />

      {/* Description */}
      <label className="block text-xs text-gray-400 mb-1">Description</label>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a short description…"
        className="mb-3 bg-transparent text-gray-100 border-gray-700 placeholder:text-gray-500"
        rows={3}
      />

      {/* Tags */}
      <label className="block text-xs text-gray-400 mb-1">Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center rounded-md bg-gray-700 text-gray-100 px-2 py-1 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setTags(prev => prev.filter((_, idx) => idx !== i))
              }}
              className="ml-1 text-gray-300 hover:text-white"
              aria-label={`Remove tag ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            addTagFromInput()
          } else if (e.key === "Backspace" && tagInput === "" && tags.length) {
            e.preventDefault()
            setTags(prev => prev.slice(0, -1))
          }
        }}
        placeholder="Type a tag and press Enter (or comma)"
        className="mb-3 bg-transparent text-gray-100 border-gray-700"
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Due date */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Deadline</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-transparent text-gray-100 border-gray-700"
          />
        </div>

        {/* Priority dropdown */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Priority</label>
          <Select value={priority} onValueChange={(v) => setPriority(v)}>
            <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[p]}`}>
                    {p}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() =>
            onSave({
              title: title.trim(),
              description: description.trim() || undefined,
              dueDate: dueDate || undefined,
              priority,
              tags,
            })
          }
          disabled={!canSave}
          className="bg-white/90 text-black hover:bg-white"
        >
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>

        <Button variant="ghost" onClick={onCancel} className="text-gray-300 hover:text-white">
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  )
}

function TaskEditingSidePanel({ task, onClose, onSave, onDelete, allUsers }) {
  const [title, setTitle] = useState(task.title || "")
  const [description, setDescription] = useState(task.description || "")
  const [priority, setPriority] = useState(task.priority || "low")
  const [status, setStatus] = useState(task.status || "pending")
  const [deadline, setDeadline] = useState(task.deadline || "")
  const [tags, setTags] = useState(Array.isArray(task.tags) ? task.tags : [])
  const [tagInput, setTagInput] = useState("")

  const canSave = title.trim().length > 0 && priority
  const assignees = Array.isArray(task.assigned_to) ? task.assigned_to : []

  function addTagFromInput() {
    const t = tagInput.trim()
    if (!t) return
    if (!tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput("")
  }

  function removeTagAt(idx) {
    setTags(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete()
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-[420px] bg-[#1f2023] border-l border-gray-700 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Edit task</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Priority</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {["low", "medium", "high"].map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                      p === 'high' ? 'bg-fuchsia-300 text-fuchsia-950' :
                      p === 'medium' ? 'bg-amber-300 text-amber-950' :
                      'bg-teal-200 text-teal-900'
                    }`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-400">Tags</label>

            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center rounded-md px-2 py-0.5 mb-1 text-xs font-medium bg-gray-700 text-gray-200"
                  >
                    {t}
                    <button
                      type="button"
                      className="ml-1 text-gray-300 hover:text-white"
                      onClick={() => removeTagAt(i)}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              className="mt-1 w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addTagFromInput()
                }
                if (e.key === "Backspace" && tagInput === "" && tags.length) {
                  removeTagAt(tags.length - 1)
                }
              }}
              placeholder="Type a tag and press Enter (or comma)"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assignees</label>
            {assignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignees.map((userId) => {
                  const user = (allUsers || []).find(u => u.id === userId)
                  return (
                    <span
                      key={userId}
                      className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 rounded-md"
                      title={user?.name || 'Unknown User'}
                    >
                      {user?.name || 'Unknown User'}
                    </span>
                  )
                })}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No assignees</span>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deadline</label>
            <Input
              type="date"
              value={deadline || ""}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => onSave({
              title: title.trim(),
              description: description.trim(),
              priority,
              status,
              deadline,
              tags
            })}
            disabled={!canSave}
            className="bg-white/90 text-black"
          >
            Save
          </Button>
          <Button variant="ghost" className="bg-white/10 text-gray-300 hover:text-white" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            className="bg-red-400 hover:bg-red-700 text-white ml-auto"
            type="button">
            <Trash className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>
      </div>
    </div>
  )
}