"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { fetchWithCsrf, getCsrfToken } from "@/lib/csrf"
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
import { ArrowLeft, Plus, Search, X, Check, Filter, ChevronDown, ChevronRight, Edit, Trash, Archive, Calendar, List } from "lucide-react"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/hooks/useAuth"
import { TaskAttachmentsDisplay } from "./task-attachments-display"
import { FileUploadInput } from "./file-upload-input"
import { TaskTimeTracking } from "./task-time-tracking"
import { CommentSection } from "./task-comment/task-comment-section"
import { extractUserHours, normalizeTimeSummary } from "@/lib/time-tracking"
import toast from "react-hot-toast"

const API = process.env.NEXT_PUBLIC_API_URL ;

export function ProjectDetails({ projectId, onBack }) {
  const { currentUserId } = useAuth()
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
    status: 'all',
    showBlockedOnly: false
  })
  const [showFilters, setShowFilters] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState(new Set())
  const [editingTask, setEditingTask] = useState(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [viewMode, setViewMode] = useState('details') // 'details' or 'timeline'

  const { updateProject } = useProjects()

  const isReadOnly = project?.status === 'archived'
  const ensureWritable = useCallback(() => {
    if (isReadOnly) {
      toast.error('This project is archived and read-only.')
      return false
    }
    return true
  }, [isReadOnly])

  useEffect(() => {
    if (isReadOnly) {
      setShowAddMember(false)
      setIsAddingTask(false)
      setEditingTask(null)
      setShowEditProject(false)
    }
  }, [isReadOnly])

  const getPriorityMeta = useCallback((priority) => {
    const p = Number(priority);
    if (!Number.isInteger(p) || p < 1 || p > 10) {
      return { value: 5, label: '5', badgeClass: 'bg-amber-200 text-amber-900', textClass: 'text-amber-400' };
    }

    // Color mapping for 1-10 scale: 1-3 low (green), 4-6 medium (yellow), 7-10 high (red)
    const badgeClass =
      p >= 9 ? 'bg-fuchsia-400 text-fuchsia-950' :
      p >= 7 ? 'bg-red-300 text-red-950' :
      p >= 4 ? 'bg-amber-300 text-amber-950' :
      'bg-teal-200 text-teal-900';

    const textClass =
      p >= 9 ? 'text-fuchsia-400' :
      p >= 7 ? 'text-red-400' :
      p >= 4 ? 'text-yellow-400' :
      'text-green-400';

    return { value: p, label: p.toString(), badgeClass, textClass };
  }, []);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const [projectRes, membersRes, tasksRes, usersRes] = await Promise.all([
          fetchWithCsrf(`${API}/api/projects/${projectId}`),
          fetchWithCsrf(`${API}/api/projects/${projectId}/members`),
          fetchWithCsrf(`${API}/api/tasks/project/${projectId}`),
          fetchWithCsrf(`${API}/api/users`)
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
          console.log('🔍 DEBUG: Current user member:', currentUserMember, 'is creator:', isCurrentUserCreator, 'is project manager:', isCurrentUserProjectManager)
          setUserPermissions(prev => {
            const newPermissions = {
              ...prev,
              isCreator: isCurrentUserCreator,
              canManageMembers: isCurrentUserCreator || isCurrentUserProjectManager
            }
            console.log('User permissions after members:', newPermissions)
            return newPermissions
          })
        } else {
          console.error('Failed to fetch members:', membersRes.status, membersRes.statusText);
        }

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json()
          // Fetch subtasks for each task
          const tasksWithSubtasks = await Promise.all(
            tasksData.tasks.map(async (task) => {
              try {
                const subtasksRes = await fetchWithCsrf(`${API}/api/tasks/${task.id}/subtasks`)
                if (subtasksRes.ok) {
                  const subtasksData = await subtasksRes.json()
                  return { ...task, subtasks: subtasksData.subtasks || [] }
                }
              } catch (error) {
                console.error(`Error fetching subtasks for task ${task.id}:`, error)
              }
              return { ...task, subtasks: [] }
            })
          )
          setTasks(tasksWithSubtasks)
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
    if (!ensureWritable()) return
    try {
      console.log(`Adding user ${userId} to project ${projectId} as collaborator`);
      const response = await fetchWithCsrf(`${API}/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: [userId],
          message: invitationMessage,
          role: 'collaborator' // Default role for new members
        })
      })

      if (response.ok) {
        console.log('Successfully added member');
        // Refresh members from API
        const membersRes = await fetchWithCsrf(`${API}/api/projects/${projectId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData.members);
          console.log('Updated members list:', membersData.members);
        }
        // Don't close the add member section, just clear selection if it was selected
        setSelectedUsers(selectedUsers.filter(id => id !== userId));
        toast.success("Member added successfully!")
      } else {
        const errorData = await response.json();
        console.error('Failed to add member:', errorData.message);
        toast.error(`Failed to add member: ${errorData.message}`)
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error("Failed to add member. Please try again.")
    }
  }

  const handleBulkAddMembers = async () => {
    if (!ensureWritable()) return
    if (selectedUsers.length === 0) {
      toast.error('Please select users to add first.');
      return;
    }

    try {
      console.log(`Adding ${selectedUsers.length} users to project ${projectId} as collaborators`);
      const response = await fetchWithCsrf(`${API}/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          message: invitationMessage,
          role: 'collaborator' // Default role for new members
        })
      })

      if (response.ok) {
        console.log('Successfully added members');
        // Refresh members from API
        const membersRes = await fetchWithCsrf(`${API}/api/projects/${projectId}/members`);
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
        toast.success(`Successfully added ${selectedUsers.length} member(s) to the project!`)
      } else {
        const errorData = await response.json();
        console.error('Failed to add members:', errorData.message);
        toast.error(`Failed to add members: ${errorData.message}`)
      }
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error("Failed to add members. Please try again.")
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
    if (!ensureWritable()) return
    try {
      const response = await fetchWithCsrf(`${API}/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Remove member from local state using new structure
        setMembers(members.filter(member => member.user_id !== userId))
        toast.success("Member removed successfully!")
      } else {
        const errorData = await response.json();
        console.error('Failed to remove member:', errorData.message);
        toast.error(`Failed to remove member: ${errorData.message}`)
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error("Failed to remove member. Please try again.")
    }
  }

  const handleCreateTask = async ({ title, description, dueDate, priority, tags, assignees = [], attachments = [] }) => {
    if (!ensureWritable()) return
    try {
      console.log('Creating task with projectId:', projectId, 'Type:', typeof projectId)
      
      const response = await fetchWithCsrf(`${API}/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description: description || null,
          priority: Number(priority) || 5, // Send as integer
          status: 'pending',
          deadline: dueDate || null,
          project_id: projectId,
          assigned_to: Array.isArray(assignees) && assignees.length > 0
            ? Array.from(new Set(assignees.map((a) => a.id ?? a)))
            : [],
          tags: tags || [],
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to create task: ${response.status}`)
      }

      const responseData = await response.json()
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to create task')
      }
      
      const newTask = responseData.task
      
      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        try {
          const formData = new FormData()
          attachments.forEach(file => {
            formData.append('files', file)
          })
          
          const uploadResponse = await fetchWithCsrf(`${API}/api/tasks/${newTask.id}/files`, {
            method: 'POST',
            body: formData
          })
          
          if (!uploadResponse.ok) {
            console.warn('Failed to upload some attachments')
            toast.error('Task created but some attachments failed to upload')
          } else {
            const uploadResult = await uploadResponse.json()
            if (uploadResult.data?.errors && uploadResult.data.errors.length > 0) {
              console.warn('Some files failed:', uploadResult.data.errors)
              toast.warning('Task created but some attachments failed to upload')
            }
          }
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError)
          toast.error('Task created but attachments failed to upload')
        }
      }
      
      setTasks(prev => [...prev, newTask])
      setIsAddingTask(false)
      toast.success("Task created successfully!")
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error(`Failed to create task: ${error.message}`)
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
      status: 'all',
      showBlockedOnly: false
    })
  }

  const handleUpdateTask = async (taskData) => {
    if (!ensureWritable()) {
      throw new Error('Project is archived and read-only.')
    }
    try {
      const taskId = taskData.id
      if (!taskId) {
        throw new Error('Task ID is required for update')
      }

      const normalizedAssignees = Array.isArray(taskData.assignees)
        ? Array.from(
            new Set(
              taskData.assignees
                .map((value) => {
                  const raw =
                    value && typeof value === 'object'
                      ? value.id ?? value.user_id ?? value.userId ?? null
                      : value;
                  const numeric = Number(raw);
                  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
                })
                .filter((value) => value !== null)
            )
          )
        : undefined;
      const hasValidAssignees = Array.isArray(normalizedAssignees) && normalizedAssignees.length > 0;
      const response = await fetchWithCsrf(`${API}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description || null,
          priority: Number(taskData.priority) || 5, // Send as integer
          status: taskData.status,
          deadline: taskData.deadline || null,
          tags: taskData.tags || [],
          ...(hasValidAssignees ? { assigned_to: normalizedAssignees } : {}),
          ...(typeof taskData.hours === 'number' && taskData.hours >= 0
            ? { hours: taskData.hours }
            : {}),
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update task: ${response.status}`)
      }

      const updatedTask = await response.json()
      setTasks(prev => prev.map(task => {
        // Update if this is the task itself
        if (task.id === updatedTask.id) {
          // Preserve existing subtasks if the updated task doesn't include them
          return {
            ...updatedTask,
            subtasks: updatedTask.subtasks || task.subtasks || []
          }
        }
        // Update if this is a parent task containing the updated subtask
        if (task.subtasks && task.subtasks.some(st => st.id === updatedTask.id)) {
          return {
            ...task,
            subtasks: task.subtasks.map(st => st.id === updatedTask.id ? updatedTask : st)
          }
        }
        return task
      }))
      setEditingTask(null)
      return updatedTask
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error(`Error updating task: ${error.message}`)
      throw error
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (!ensureWritable()) return
    try {
      const response = await fetchWithCsrf(`${API}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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
      toast.error(`Error deleting task: ${error.message}`)
    }
  }

  const handleArchiveProject = async () => {
    if (!ensureWritable()) return
    setShowArchiveConfirm(false)

    try {
      console.log(`Archiving project ${projectId}`)
      const response = await fetchWithCsrf(`${API}/api/projects/${projectId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
      })

      if (response.ok) {
        const responseData = await response.json()
        console.log('Successfully archived project:', responseData)
        toast.success('Project and all its tasks have been archived successfully!')

        // Update the project state to reflect archived status
        setProject(prev => ({ ...prev, status: 'archived' }))

        // Optionally redirect back to projects list
        if (onBack) {
          onBack()
        }
      } else {
        const errorData = await response.json()
        console.error('Failed to archive project:', errorData.message)
        toast.error(`Failed to archive project: ${errorData.message}`)
      }
    } catch (error) {
      console.error('Error archiving project:', error)
      toast.error('Error archiving project. Please try again.')
    }
  }

  const handleEditProject = async (formData) => {
    if (!ensureWritable()) return
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
    // Helper to check if task is blocked
    const isBlocked = task.blocked === true || task.status === 'blocked'

    // If showing blocked only, ignore other filters except assignee and priority
    if (taskFilters.showBlockedOnly) {
      if (!isBlocked) return false

      if (taskFilters.assignee && !task.assigned_to?.some(userId => {
        const user = (allUsers || []).find(u => u.id === userId)
        return user && (user.name || user.email).toLowerCase().includes(taskFilters.assignee.toLowerCase())
      })) {
        return false
      }

      if (taskFilters.priority !== 'all' && Number(task.priority) !== Number(taskFilters.priority)) {
        return false
      }

      if (taskFilters.dueDate && task.deadline) {
        const taskDate = new Date(task.deadline).toDateString()
        const filterDate = new Date(taskFilters.dueDate).toDateString()
        if (taskDate !== filterDate) return false
      }

      return true
    }

    // Normal filtering (exclude blocked tasks)
    if (isBlocked) return false

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

    if (taskFilters.priority !== 'all' && Number(task.priority) !== Number(taskFilters.priority)) {
      return false
    }

    if (taskFilters.status !== 'all' && task.status !== taskFilters.status) {
      return false
    }

    return true
  })

  // Group tasks by status
  const groupedTasks = taskFilters.showBlockedOnly
    ? {
        blocked: filteredTasks
      }
    : {
        pending: filteredTasks.filter(task => task.status === 'pending' && task.status !== 'blocked'),
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
    <div className="flex-1 bg-[#1a1a1d] p-3 sm:p-6 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white self-start sm:self-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back to Board</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{project.name || 'Unnamed Project'}</h1>
            {project.status === 'archived' && (
              <span className="px-2 py-1 bg-gray-600 text-gray-200 text-xs sm:text-sm rounded-full flex-shrink-0">
                Archived
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#2a2a2e] rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === 'details' ? 'default' : 'ghost'}
                onClick={() => setViewMode('details')}
                className={viewMode === 'details' ? 'bg-blue-600 text-white text-xs sm:text-sm' : 'text-gray-400 hover:text-white hover:bg-[#1f1f23] text-xs sm:text-sm'}
              >
                <List className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Details</span>
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                onClick={() => setViewMode('timeline')}
                className={viewMode === 'timeline' ? 'bg-blue-600 text-white text-xs sm:text-sm' : 'text-gray-400 hover:text-white hover:bg-[#1f1f23] text-xs sm:text-sm'}
              >
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Timeline</span>
              </Button>
            </div>
            {userPermissions.isCreator && project.status !== 'archived' && (
              <Button
                onClick={() => setShowEditProject(true)}
                variant="outline"
                size="sm"
                className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white text-xs sm:text-sm"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit Project</span>
                <span className="sm:hidden">Edit</span>
              </Button>
            )}
            {userPermissions.canManageMembers && project.status !== 'archived' && (
              <Button
                onClick={() => setShowArchiveConfirm(true)}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white text-xs sm:text-sm"
              >
                <Archive className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Archive</span>
                <span className="sm:hidden">Archive</span>
              </Button>
            )}
          </div>
        </div>

        {/* Conditional rendering based on view mode */}
        {viewMode === 'details' ? (
          <>
        {isReadOnly && (
          <div className="mb-6 rounded-lg border border-dashed border-gray-600 bg-[#2a2a2e] p-4 text-sm text-gray-300">
            This project is archived.
          </div>
        )}
        {/* Project Info */}
        <div className="bg-[#2a2a2e] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Project Details</h2>
          <p className="text-sm sm:text-base text-gray-300">{project.description || "No description available."}</p>
        </div>

        {/* Members Section */}
        <div className="bg-[#2a2a2e] rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-white">Project Members</h2>
            {userPermissions.canManageMembers && !isReadOnly && (
              <Button
                onClick={() => setShowAddMember(!showAddMember)}
                className="bg-blue-500 hover:bg-blue-600 text-white self-start sm:self-auto"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>

          {/* Add Member Search */}
          {showAddMember && !isReadOnly && (
            <div className="mb-4 p-3 sm:p-4 bg-[#1f1f23] rounded-lg">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-4 p-3 bg-[#2a2a2e] rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 text-xs sm:text-sm">
                      {selectedUsers.length > 0 ? `${selectedUsers.length} user(s) selected` : 'Select users to add in bulk'}
                    </span>
                  </div>
                  <Button
                    onClick={handleBulkAddMembers}
                    disabled={selectedUsers.length === 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white self-start sm:self-auto"
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
                    <div key={user.id} className="flex items-center justify-between gap-2 p-2 hover:bg-gray-700 rounded">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 flex-shrink-0"
                        />
                        <Avatar className="w-6 h-6 flex-shrink-0">
                          <AvatarFallback className="bg-purple-500 text-white text-xs">
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{user.name || 'Unknown User'}</p>
                          <p className="text-gray-400 text-xs truncate">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddMember(user.id)}
                        className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
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
                <div key={member.user_id} className="flex items-center justify-between gap-3 p-3 bg-[#1f1f23] rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className="bg-purple-500 text-white">
                        {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <p className="text-white font-medium text-sm sm:text-base truncate">{member.name || 'Unknown User'}</p>
                        <span className={`text-xs px-2 py-0.5 sm:py-1 rounded-full self-start sm:self-auto flex-shrink-0 ${
                          userRole === 'manager' ? 'bg-blue-600 text-white' :
                          userRole === 'creator' ? 'bg-red-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {userRole}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs sm:text-sm truncate">{member.email}</p>
                    </div>
                  </div>
                  {userPermissions.canManageMembers && !isReadOnly && userRole !== 'creator' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0 p-2"
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
        <div className="bg-[#2a2a2e] rounded-lg p-4 sm:p-6 mt-4 sm:mt-6">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h2 className="text-base sm:text-lg font-semibold text-white">Project Tasks</h2>
                {/* Progress Indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-20 sm:w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-300 whitespace-nowrap">
                    {completedTasks}/{totalTasks} ({progressPercent}%)
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:text-white"
                >
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
                <Button
                  onClick={() => {
                    if (!ensureWritable()) return
                    setIsAddingTask(true)
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                  disabled={isReadOnly || isAddingTask}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Task</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-[#1f1f23] rounded-lg p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-3">
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
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                        <SelectItem key={p} value={p.toString()} style={{ color: 'black' }} className="hover:bg-gray-700 focus:bg-gray-700">
                          Priority {p}
                        </SelectItem>
                      ))}
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
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taskFilters.showBlockedOnly}
                    onChange={(e) => setTaskFilters(prev => ({ ...prev, showBlockedOnly: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-gray-300">Show blocked tasks only</span>
                </label>
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
              <ProjectTaskForm
                onSave={handleCreateTask}
                onCancel={cancelAddTask}
                projectMembers={members}
              />
            </div>
          )}

          {/* Tasks organized by status */}
          {Object.keys(groupedTasks).map(status => {
            const statusTasks = groupedTasks[status]
            const statusLabels = {
              pending: 'Pending',
              in_progress: 'In Progress',
              completed: 'Completed',
              blocked: 'Blocked'
            }
            const statusColors = {
              pending: 'bg-yellow-600',
              in_progress: 'bg-blue-600',
              completed: 'bg-green-600',
              blocked: 'bg-red-600'
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
                      const priorityMeta = getPriorityMeta(task.priority);

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
                                    {priorityMeta.label && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityMeta.badgeClass}`}>
                                        {priorityMeta.label}
                                      </span>
                                    )}
                                    {task.blocked && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-200 border border-red-600">
                                        🚫 BLOCKED
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

                                {/* Attachments */}
                                <TaskAttachmentsDisplay taskId={task.id} />

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
                                {!isReadOnly && (
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
                                )}
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
        </>
      ) : (
        /* Timeline View */
        <ProjectTimeline
          tasks={tasks}
          allUsers={allUsers}
          projectMembers={members}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          readOnly={isReadOnly}
        />
      )}
      </div>

      {/* Task Editing Side Panel */}
      {!isReadOnly && editingTask && (
        <TaskEditingSidePanel
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleUpdateTask}
          onDelete={() => handleDeleteTask(editingTask.id)}
          allUsers={allUsers}
          projectMembers={members}
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
  1: "bg-slate-200 text-slate-800",
  2: "bg-slate-200 text-slate-800",
  3: "bg-teal-200 text-teal-900",
  4: "bg-teal-200 text-teal-900",
  5: "bg-amber-200 text-amber-900",
  6: "bg-amber-300 text-amber-950",
  7: "bg-orange-300 text-orange-950",
  8: "bg-red-300 text-red-950",
  9: "bg-fuchsia-400 text-fuchsia-950",
  10: "bg-purple-500 text-white",
}

function ProjectTaskForm({ onSave, onCancel, projectMembers = [] }) {
  const { user } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState(5) // Default to medium priority
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState("")
  const [assignees, setAssignees] = useState([])
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [attachments, setAttachments] = useState([])

  const PRIORITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const MAX_ASSIGNEES = 5
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
  const canManageAssignees = () => true
  const canSave = title.trim().length > 0 && priority !== "" && assignees.length <= MAX_ASSIGNEES

  const memberOptions = useMemo(() => {
    if (!Array.isArray(projectMembers)) return []
    return projectMembers
      .map((member) => ({
        id: member.user_id ?? member.id,
        name: member.name ?? member.full_name ?? member.email ?? "Unknown User",
        email: member.email ?? "",
      }))
      .filter((member) => member.id != null)
  }, [projectMembers])

  useEffect(() => {
    if (!user?.id) return
    const currentMember = memberOptions.find((member) => member.id === user.id)
    if (!currentMember) return
    setAssignees((prev) => {
      if (prev.some((assignee) => assignee.id === currentMember.id)) return prev
      return [...prev, currentMember]
    })
  }, [user?.id, memberOptions])

  const availableAssigneeResults = useMemo(() => {
    if (!canManageAssignees()) return []
    const search = assigneeQuery.trim().toLowerCase()
    if (!search || assignees.length >= MAX_ASSIGNEES) return []
    return memberOptions
      .filter((member) => !assignees.some((assignee) => assignee.id === member.id))
      .filter((member) => {
        const name = member.name?.toLowerCase() ?? ""
        const email = member.email?.toLowerCase() ?? ""
        return name.includes(search) || email.includes(search)
      })
      .slice(0, 8)
  }, [assigneeQuery, memberOptions, assignees])

  const addAssignee = (member) => {
    if (!canManageAssignees) return
    setAssignees((prev) => {
      if (prev.length >= MAX_ASSIGNEES || prev.some((assignee) => assignee.id === member.id)) return prev
      return [...prev, member]
    })
    setAssigneeQuery("")
  }

  const canRemoveAssignee = (assigneeId) => {
    if (!canManageAssignees) return false
    return assignees.length > 1
  }

  const removeAssignee = (userId) => {
    if (!canRemoveAssignee(userId)) return
    setAssignees((prev) => prev.filter((assignee) => assignee.id !== userId))
  }

  const addTagFromInput = () => {
    const value = tagInput.trim()
    if (!value) return
    if (!tags.includes(value)) setTags((prev) => [...prev, value])
    setTagInput("")
  }

  const removeTag = (index) => {
    setTags((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    const validFiles = []
    const errors = []

    files.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG are allowed.`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 50MB.`)
        return
      }
      validFiles.push(file)
    })

    if (errors.length > 0) {
      toast.error(errors.join(', '))
    }

    setAttachments(prev => [...prev, ...validFiles])
    // Reset input so same file can be selected again
    event.target.value = ''
  }

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleAssigneeInputKeyDown = (event) => {
    if (!canManageAssignees) return
    if (event.key === "Enter" && availableAssigneeResults.length > 0 && assignees.length < MAX_ASSIGNEES) {
      event.preventDefault()
      addAssignee(availableAssigneeResults[0])
    }
    if (event.key === "Escape") {
      setAssigneeQuery("")
    }
  }

  const showNoResults =
    assigneeQuery.trim().length > 0 && availableAssigneeResults.length === 0

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
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center rounded-md bg-gray-700 text-gray-100 px-2 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                removeTag(index)
              }}
              className="ml-1 text-gray-300 hover:text-white"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            addTagFromInput()
          } else if (event.key === "Backspace" && tagInput === "" && tags.length) {
            event.preventDefault()
            setTags((prev) => prev.slice(0, -1))
          }
        }}
        placeholder="Type a tag and press Enter (or comma)"
        className="mb-3 bg-transparent text-gray-100 border-gray-700"
      />

      {/* Assignees */}
      <label className="block text-xs text-gray-400 mb-1">Assignees</label>
      {memberOptions.length === 0 ? (
        <p className="text-xs text-gray-500 mb-3">
          No project members available to assign.
        </p>
      ) : (
        <div className="mb-3">
          <div className="relative">
            <input
              type="text"
              className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-60"
              placeholder="Search project members by name or email..."
              value={assigneeQuery}
              onChange={(event) => setAssigneeQuery(event.target.value)}
              onKeyDown={handleAssigneeInputKeyDown}
              autoComplete="off"
              disabled={!canManageAssignees || assignees.length >= MAX_ASSIGNEES}
            />
            {canManageAssignees && assigneeQuery && (
              <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
                {availableAssigneeResults.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-700 text-gray-100"
                    onClick={() => addAssignee(member)}
                  >
                    <span className="font-medium">{member.name}</span>
                    {member.email && (
                      <span className="ml-2 text-xs text-gray-400">{member.email}</span>
                    )}
                  </button>
                ))}
                {showNoResults && (
                  <div className="px-3 py-2 text-sm text-gray-400">No matching members</div>
                )}
              </div>
            )}
          </div>
        {assignees.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {assignees.map((assignee) => (
              <Badge
                key={assignee.id}
                className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 flex items-center"
                title={assignee.name}
              >
                {assignee.name}
                <button
                  type="button"
                  className="ml-1 text-gray-300 hover:text-white disabled:opacity-60"
                  onClick={() => removeAssignee(assignee.id)}
                  aria-label={`Remove ${assignee.name}`}
                  disabled={!canRemoveAssignee(assignee.id)}
                >
                  ×
                </button>
              </Badge>
        ))}
            </div>
        ) : (
          <span className="text-xs text-gray-500 mt-2 block">No assignees</span>
        )}
        {assignees.length === 1 && (
          <p className="text-xs text-amber-400 mt-2">At least one assignee is required. Add another member before removing the last one.</p>
        )}
          {assignees.length >= MAX_ASSIGNEES && (
            <p className="text-xs text-red-400 mt-2">You can assign up to {MAX_ASSIGNEES} members.</p>
          )}
        </div>
      )}

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
          <Select value={priority.toString()} onValueChange={(value) => setPriority(Number(value))}>
            <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {PRIORITIES.map((item) => (
                <SelectItem key={item} value={item.toString()}>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[item]}`}>
                    {item}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* File Attachments */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1">Attachments</label>
        <div className="border-2 border-dashed border-gray-700 rounded-md p-4 hover:border-gray-600 transition-colors">
          <input
            type="file"
            id="task-file-input"
            multiple
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="task-file-input"
            className="flex flex-col items-center cursor-pointer"
          >
            <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-sm text-gray-400">Click to upload files</span>
            <span className="text-xs text-gray-500 mt-1">PDF, DOCX, XLSX, PNG, JPG (Max 50MB each)</span>
          </label>
        </div>
        
        {attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="text-gray-400 hover:text-red-400 ml-2"
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
              assignees,
              attachments, // Pass attachments to parent
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

function TaskEditingSidePanel({ task, onClose, onSave, onDelete, allUsers, projectMembers = [] }) {
  const { user } = useAuth()
  const [title, setTitle] = useState(task.title || "")
  const [description, setDescription] = useState(task.description || "")
  const [priority, setPriority] = useState(Number(task.priority) || 5)
  const [status, setStatus] = useState(task.status || "pending")
  const [deadline, setDeadline] = useState(task.deadline || "")
  const [tags, setTags] = useState(Array.isArray(task.tags) ? task.tags : [])
  const [tagInput, setTagInput] = useState("")
  const [assignees, setAssignees] = useState([])
  const [assigneeLookup, setAssigneeLookup] = useState(() => {
    const lookup = {}
    if (Array.isArray(task.assignees)) {
      task.assignees.forEach((entry) => {
        const rawId = entry?.id ?? entry?.user_id ?? entry?.userId
        const numericId = Number(rawId)
        if (Number.isFinite(numericId)) {
          const truncated = Math.trunc(numericId)
          lookup[truncated] = entry?.name ?? entry?.email ?? `User ${truncated}`
        }
      })
    }
    return lookup
  })
  const [assigneeQuery, setAssigneeQuery] = useState("")
  const [attachments, setAttachments] = useState([])
  const MAX_ASSIGNEES = 5
  const taskCreatorId = Number(task.creator_id ?? task.created_by ?? task.owner_id ?? null)
  const currentUserId = user?.id ?? null
  const currentUserProjectRole = projectMembers.find((member) => member.user_id === currentUserId)?.member_role
  const globalRole = user?.role?.toLowerCase?.() ?? ''
  const isManagerRole = globalRole === 'manager'
  const isProjectManager =
    (typeof currentUserProjectRole === 'string' && currentUserProjectRole.toLowerCase() === 'manager') ||
    isManagerRole
  const isCreator = currentUserId != null && currentUserId === taskCreatorId

  const [timeTracking, setTimeTracking] = useState(() => normalizeTimeSummary(task.time_tracking))
  const [hoursSpent, setHoursSpent] = useState(() =>
    extractUserHours(normalizeTimeSummary(task.time_tracking), currentUserId)
  )
  const [saving, setSaving] = useState(false)
  const isMountedRef = useRef(true)

  const userIsAssignee = useMemo(() => {
    if (currentUserId == null) return false
    if (assignees.some((a) => a.id === currentUserId)) return true

    if (Array.isArray(task.assignees)) {
      const matchesExisting = task.assignees.some((entry) => {
        const rawId = entry?.id ?? entry?.user_id ?? entry
        const normalizedId = Number(rawId)
        return Number.isFinite(normalizedId) && Math.trunc(normalizedId) === currentUserId
      })
      if (matchesExisting) return true
    }

    if (Array.isArray(task.assigned_to)) {
      const normalizedIds = task.assigned_to
        .map((value) => Number(value))
        .filter(Number.isFinite)
        .map((value) => Math.trunc(value))
      if (normalizedIds.includes(currentUserId)) return true
    }

    return false
  }, [assignees, currentUserId, task])

  const canEditTask = userIsAssignee
  const canAddAssignees = canEditTask
  const canRemoveAssignees = isProjectManager || (canEditTask && isCreator)

  const canUpdateHours = userIsAssignee
  const numericHours = Number(hoursSpent)
  const isHoursValid =
    hoursSpent === "" ||
    (Number.isFinite(numericHours) && numericHours >= 0)
  const canSave =
    (canEditTask || isProjectManager || isManagerRole) &&
    assignees.length <= MAX_ASSIGNEES &&
    isHoursValid

  const memberOptions = useMemo(() => {
    if (!Array.isArray(projectMembers)) return []
    return projectMembers
      .map((member) => ({
        id: member.user_id ?? member.id,
        name: member.name ?? member.full_name ?? member.email ?? "Unknown User",
        email: member.email ?? "",
      }))
      .filter((member) => member.id != null)
  }, [projectMembers])

  const allUsersLookup = useMemo(() => {
    const map = new Map()
    if (Array.isArray(allUsers)) {
      allUsers.forEach((user) => {
        map.set(user.id, user)
      })
    }
    return map
  }, [allUsers])

  const initialAssignees = useMemo(() => {
    const fromTaskAssignees = Array.isArray(task.assignees) ? task.assignees : []
    if (fromTaskAssignees.length > 0) {
      return fromTaskAssignees
        .map((entry) => {
          const id = entry.id ?? entry.user_id ?? entry
          if (id == null) return null
          const member = memberOptions.find((m) => m.id === id)
          const fallbackUser = allUsersLookup.get(id)
          return {
            id,
            name: entry.name ?? member?.name ?? fallbackUser?.name ?? `User ${id}`,
            email: entry.email ?? member?.email ?? fallbackUser?.email ?? "",
          }
        })
        .filter(Boolean)
    }

    if (Array.isArray(task.assigned_to)) {
      return task.assigned_to
        .map((id) => {
          const member = memberOptions.find((m) => m.id === id)
          const fallbackUser = allUsersLookup.get(id)
          if (!member && !fallbackUser) return null
          return {
            id,
            name: member?.name ?? fallbackUser?.name ?? `User ${id}`,
            email: member?.email ?? fallbackUser?.email ?? "",
          }
        })
        .filter(Boolean)
    }

    return []
  }, [task, memberOptions, allUsersLookup])

  useEffect(() => {
    setAssignees(initialAssignees)
    setAssigneeLookup((prev) => {
      const next = { ...prev }
      initialAssignees.forEach((entry) => {
        const numericId = Number(entry?.id ?? entry?.user_id ?? entry?.userId)
        if (Number.isFinite(numericId)) {
          const truncated = Math.trunc(numericId)
          if (next[truncated] == null) {
            next[truncated] = entry?.name ?? entry?.email ?? `User ${truncated}`
          }
        }
      })
      return next
    })
  }, [initialAssignees])

  useEffect(() => {
    if (!task.time_tracking) return
    const summary = normalizeTimeSummary(task.time_tracking)
    console.log('[TaskEditingSidePanel] normalised summary from task prop', summary)
    setTimeTracking(summary)
    const extracted = extractUserHours(summary, currentUserId)
    console.log('[TaskEditingSidePanel] extracted hours from prop summary', { extracted, currentUserId })
    if (extracted !== "") {
      setHoursSpent(extracted)
    }
    setAssigneeLookup((prev) => {
      const next = { ...prev }
      summary.per_assignee.forEach(({ user_id }) => {
        const numericId = Number(user_id)
        if (Number.isFinite(numericId)) {
          const truncated = Math.trunc(numericId)
          if (next[truncated] == null) {
            next[truncated] = `User ${truncated}`
          }
        }
      })
      return next
    })
  }, [task.time_tracking, currentUserId])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const projectId = Number(task.project_id)
    if (!Number.isFinite(projectId)) return
    let active = true
    ;(async () => {
      try {
        const res = await fetchWithCsrf(`${API}/api/projects/${projectId}/tasks/${task.id}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache"
          }
        })
        if (!res.ok) return
        const payload = await res.json().catch(() => null)
        const detail = payload?.task ?? payload
        if (!detail || !active) return
        const summary = normalizeTimeSummary(detail.time_tracking)
        console.log('[TaskEditingSidePanel] fetched time summary', {
          taskId: task.id,
          raw: detail.time_tracking,
          summary,
          currentUserId
        })
        setTimeTracking(summary)
        const extracted = extractUserHours(summary, currentUserId)
        console.log('[TaskEditingSidePanel] extracted hours from fetched summary', { extracted, currentUserId })
        if (extracted !== "") {
          setHoursSpent(extracted)
        }
        setAssigneeLookup((prev) => {
          const next = { ...prev }
          summary.per_assignee.forEach(({ user_id }) => {
            const numericId = Number(user_id)
            if (Number.isFinite(numericId)) {
              const truncated = Math.trunc(numericId)
              if (next[truncated] == null) {
                next[truncated] = `User ${truncated}`
              }
            }
          })
          return next
        })
      } catch (error) {
        console.error('[TaskEditingSidePanel] Failed to fetch time tracking:', error)
      }
    })()
    return () => {
      active = false
    }
  }, [task.id, task.project_id, currentUserId])

  const availableAssigneeResults = useMemo(() => {
    if (!canAddAssignees) return []
    const search = assigneeQuery.trim().toLowerCase()
    if (!search || assignees.length >= MAX_ASSIGNEES) return []
    return memberOptions
      .filter((member) => !assignees.some((assignee) => assignee.id === member.id))
      .filter((member) => {
        const name = member.name?.toLowerCase() ?? ""
        const email = member.email?.toLowerCase() ?? ""
        return name.includes(search) || email.includes(search)
      })
      .slice(0, 8)
  }, [assigneeQuery, memberOptions, assignees, canAddAssignees])

  function addTagFromInput() {
    if (!canEditTask) return
    const t = tagInput.trim()
    if (!t) return
    if (!tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput("")
  }

  function removeTagAt(idx) {
    if (!canEditTask) return
    setTags(prev => prev.filter((_, i) => i !== idx))
  }

  const addAssignee = (member) => {
    if (!canAddAssignees) return
    setAssignees((prev) => {
      if (prev.length >= MAX_ASSIGNEES || prev.some((assignee) => assignee.id === member.id)) return prev
      return [...prev, member]
    })
    if (member?.id != null) {
      const numericId = Number(member.id)
      if (Number.isFinite(numericId)) {
        const truncated = Math.trunc(numericId)
        setAssigneeLookup((prev) => ({
          ...prev,
          [truncated]: member.name ?? member.email ?? `User ${truncated}`
        }))
      }
    }
    setAssigneeQuery("")
  }

  const canRemoveAssignee = (assigneeId) => {
    return canRemoveAssignees && assignees.length > 1
  }

  const removeAssignee = (userId) => {
    if (!canRemoveAssignee(userId)) return
    setAssignees((prev) => prev.filter((assignee) => assignee.id !== userId))
  }

  const handleHoursInputChange = (value) => {
    if (!canUpdateHours) return
    if (value === "" || value === null) {
      setHoursSpent("")
      return
    }
    const parsed = Number(value)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setHoursSpent(value)
    }
  }

  const handleAssigneeInputKeyDown = (event) => {
    if (!canAddAssignees) return
    if (event.key === "Enter" && availableAssigneeResults.length > 0 && assignees.length < MAX_ASSIGNEES) {
      event.preventDefault()
      addAssignee(availableAssigneeResults[0])
    }
    if (event.key === "Escape") {
      setAssigneeQuery("")
    }
  }

  const showNoAssigneeResults =
    canAddAssignees && assigneeQuery.trim().length > 0 && availableAssigneeResults.length === 0

  const breakdownAssignees = useMemo(() => {
    const ids = new Set()
    if (Array.isArray(assignees)) {
      assignees.forEach((entry) => {
        const numericId = Number(entry?.id ?? entry?.user_id ?? entry?.userId)
        if (Number.isFinite(numericId)) ids.add(Math.trunc(numericId))
      })
    }
    if (Array.isArray(timeTracking?.per_assignee)) {
      timeTracking.per_assignee.forEach((entry) => {
        const numericId = Number(entry?.user_id ?? entry?.id)
        if (Number.isFinite(numericId)) ids.add(Math.trunc(numericId))
      })
    }
    return Array.from(ids).map((id) => ({
      id,
      name: assigneeLookup[id] ?? `User ${id}`
    }))
  }, [assignees, timeTracking?.per_assignee, assigneeLookup])

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete()
    }
  }

  const handleSave = async () => {
    if (!canSave || saving) return
    const payload = {
      id: task.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      deadline,
      tags,
      assignees: assignees.map((assignee) => assignee.id)
    }
    if (canUpdateHours && hoursSpent !== "" && Number.isFinite(numericHours) && numericHours >= 0) {
      payload.hours = numericHours
    }
    try {
      if (isMountedRef.current) setSaving(true)
      const updatedTask = await onSave?.(payload)
      if (updatedTask?.time_tracking && isMountedRef.current) {
        const summary = normalizeTimeSummary(updatedTask.time_tracking)
        setTimeTracking(summary)
        const extracted = extractUserHours(summary, currentUserId)
        if (extracted !== "") {
          setHoursSpent(extracted)
        }
      }
    } catch (error) {
      console.error('[TaskEditingSidePanel] Failed to update task:', error)
      toast.error(error.message || 'Failed to update task')
    } finally {
      if (isMountedRef.current) setSaving(false)
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

        {!canEditTask && (
          <div className="mb-4 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            You are not assigned to this task, so the fields are read-only.
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
              disabled={!canEditTask}
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
              disabled={!canEditTask}
            />
          </div>

          {/* Attachments */}
          <TaskAttachmentsDisplay taskId={task.id} />

          {/* Priority */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Priority</label>
            <Select value={priority.toString()} onValueChange={(v) => setPriority(Number(v))} disabled={!canEditTask}>
              <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                  <SelectItem key={p} value={p.toString()}>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[p]}`}>
                      {p}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <Select value={status} onValueChange={setStatus} disabled={!canEditTask}>
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

          <TaskTimeTracking
            value={hoursSpent}
            onChange={handleHoursInputChange}
            canEdit={canUpdateHours && canEditTask}
            totalHours={timeTracking.total_hours}
            perAssignee={timeTracking.per_assignee}
            assignees={breakdownAssignees}
          />
          {!isHoursValid && (
            <p className="text-xs text-red-400">Please enter a non-negative number of hours.</p>
          )}

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
                      className="ml-1 text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => removeTagAt(i)}
                      aria-label={`Remove ${t}`}
                      disabled={!canEditTask}
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
              disabled={!canEditTask}
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assignees</label>
            {memberOptions.length === 0 ? (
              <p className="text-xs text-gray-500">
                No project members available to assign.
              </p>
            ) : (
              <div>
                <div className="relative">
                <input
                  type="text"
                  className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-60"
                  placeholder="Search project members..."
                  value={assigneeQuery}
                  onChange={(event) => setAssigneeQuery(event.target.value)}
                  onKeyDown={handleAssigneeInputKeyDown}
                  autoComplete="off"
                  disabled={!canAddAssignees || assignees.length >= MAX_ASSIGNEES}
                />
                {canAddAssignees && assigneeQuery && assignees.length < MAX_ASSIGNEES && (
                  <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
                      {availableAssigneeResults.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-700 text-gray-100"
                          onClick={() => addAssignee(member)}
                        >
                          <span className="font-medium">{member.name}</span>
                          {member.email && (
                            <span className="ml-2 text-xs text-gray-400">{member.email}</span>
                          )}
                        </button>
                      ))}
                      {showNoAssigneeResults && (
                        <div className="px-3 py-2 text-sm text-gray-400">No matching members</div>
                      )}
                    </div>
                  )}
                </div>
            {assignees.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {assignees.map((assignee) => (
                  <Badge
                    key={assignee.id}
                    className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 flex items-center"
                    title={assignee.name}
                  >
                        {assignee.name}
                        {canRemoveAssignees && (
                      <button
                        type="button"
                        className="ml-1 text-gray-300 hover:text-white disabled:opacity-60"
                        onClick={() => removeAssignee(assignee.id)}
                        aria-label={`Remove ${assignee.name}`}
                        disabled={!canRemoveAssignee(assignee.id)}
                      >
                        ×
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500 mt-2 block">No assignees</span>
            )}
            {canRemoveAssignees && assignees.length === 1 && (
              <p className="text-xs text-amber-400 mt-2">At least one assignee is required. Add another member before removing the last one.</p>
            )}
            {canAddAssignees && assignees.length >= MAX_ASSIGNEES && (
              <p className="text-xs text-red-400 mt-2">You can assign up to {MAX_ASSIGNEES} members.</p>
            )}
              </div>
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
              disabled={!canEditTask}
            />
          </div>

          {/* Upload New Attachments */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Upload New Attachments</label>
            <FileUploadInput
              onFilesChange={setAttachments}
              disabled={!canEditTask}
            />
            {attachments.length > 0 && (
              <Button
                type="button"
                onClick={async () => {
                  try {
                    const formData = new FormData()
                    attachments.forEach(file => {
                      formData.append('files', file)
                    })

                    const response = await fetchWithCsrf(`${API}/api/tasks/${task.id}/files`, {
                      method: 'POST',
                      body: formData,
                    })

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}))
                      throw new Error(errorData.message || 'Failed to upload files')
                    }

                    const result = await response.json()
                    
                    // Check if there were any errors during upload
                    if (result.data?.errors && result.data.errors.length > 0) {
                      result.data.errors.forEach(error => {
                        toast.error(error, { duration: 5000 })
                      })
                    }
                    
                    if (result.data?.uploaded && result.data.uploaded.length > 0) {
                      toast.success(`${result.data.uploaded.length} file(s) uploaded successfully`)
                    }

                    setAttachments([])
                    // Optionally refresh attachments display
                    window.location.reload()
                  } catch (error) {
                    console.error('Error uploading files:', error)
                    toast.error(error.message || 'Failed to upload files', { duration: 5000 })
                  }
                }}
                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white"
                size="sm"
                disabled={!canEditTask}
              >
                Upload {attachments.length} File{attachments.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {/* Actions & Comments */}
          <div className="mt-8 space-y-6">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="bg-white/90 text-black"
              >
                {saving ? "Saving…" : "Save"}
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

            <div className="pt-4 border-t border-gray-700">
              <CommentSection taskId={task.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectTimeline({ tasks, allUsers, projectMembers, onUpdateTask, onDeleteTask, readOnly = false }) {
  const scrollContainerRef = useRef(null)
  const headerScrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [pixelsPerDay, setPixelsPerDay] = useState(20)
  const [expandedTasks, setExpandedTasks] = useState(new Set())
  const [hoveredTask, setHoveredTask] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [editingTask, setEditingTask] = useState(null)
  const [taskColumnWidth, setTaskColumnWidth] = useState(180) // Default width - more space for timeline
  const [isResizing, setIsResizing] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [showBlockedOnly, setShowBlockedOnly] = useState(false)
  const [isTaskColumnCollapsed, setIsTaskColumnCollapsed] = useState(false)
  const readOnlyMode = Boolean(readOnly)

  useEffect(() => {
    if (readOnlyMode) {
      setEditingTask(null)
    }
  }, [readOnlyMode])

  const getPriorityMeta = useCallback((priority) => {
    const p = Number(priority);
    if (!Number.isInteger(p) || p < 1 || p > 10) {
      return { value: 5, label: '5', badgeClass: 'bg-amber-200 text-amber-900', textClass: 'text-amber-400' };
    }

    // Color mapping for 1-10 scale: 1-3 low (green), 4-6 medium (yellow), 7-10 high (red)
    const badgeClass =
      p >= 9 ? 'bg-fuchsia-400 text-fuchsia-950' :
      p >= 7 ? 'bg-red-300 text-red-950' :
      p >= 4 ? 'bg-amber-300 text-amber-950' :
      'bg-teal-200 text-teal-900';

    const textClass =
      p >= 9 ? 'text-fuchsia-400' :
      p >= 7 ? 'text-red-400' :
      p >= 4 ? 'text-yellow-400' :
      'text-green-400';

    return { value: p, label: p.toString(), badgeClass, textClass };
  }, []);

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Timeline height constants
  const TIMELINE_HEIGHTS = {
    BASE: 56,           // Base task row height
    EXPANDED_DETAILS: 90, // Expanded details section height
    SUBTASK_ITEM: 28     // Height per subtask item
  }

  // Helper function to calculate task row height
  const calculateTaskHeight = (task, isExpanded) => {
    if (!isExpanded) return TIMELINE_HEIGHTS.BASE
    const subtaskCount = task.subtasks?.length || 0
    return TIMELINE_HEIGHTS.BASE + TIMELINE_HEIGHTS.EXPANDED_DETAILS + (subtaskCount * TIMELINE_HEIGHTS.SUBTASK_ITEM)
  }

  // Filter tasks based on blocked filter
  const filteredTasks = showBlockedOnly
    ? (tasks || []).filter(task => task.blocked === true || task.status === 'blocked')
    : (tasks || []).filter(task => !(task.blocked === true || task.status === 'blocked'))

  // Calculate timeline date range with more padding
  const getTimelineRange = () => {
    const start = new Date(today)
    start.setDate(start.getDate() - 90) // 3 months before
    const end = new Date(today)
    end.setDate(end.getDate() + 180) // 6 months after

    if (filteredTasks && filteredTasks.length > 0) {
      const dates = filteredTasks.map(task => {
        const created = new Date(task.created_at)
        const deadline = task.deadline ? new Date(task.deadline) : null
        const updated = task.updated_at ? new Date(task.updated_at) : null
        return [created, deadline, updated].filter(Boolean)
      }).flat()

      if (dates.length > 0) {
        const minTask = new Date(Math.min(...dates))
        const maxTask = new Date(Math.max(...dates))

        if (minTask < start) {
          start.setTime(minTask.getTime())
          start.setDate(start.getDate() - 30)
        }
        if (maxTask > end) {
          end.setTime(maxTask.getTime())
          end.setDate(end.getDate() + 30)
        }
      }
    }

    return { minDate: start, maxDate: end }
  }

  const { minDate, maxDate } = getTimelineRange()
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24))
  const timelineWidth = totalDays * pixelsPerDay

  // Generate date markers - start from first day of each month
  const generateDateMarkers = () => {
    const markers = []
    // Create a new date to avoid mutating minDate
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1)

    while (current <= maxDate) {
      markers.push(new Date(current))
      // Move to first day of next month
      current.setMonth(current.getMonth() + 1)
    }

    return markers
  }

  const dateMarkers = generateDateMarkers()

  // Generate 5-day grid lines starting from first of each month (5th, 10th, 15th, 20th, 25th, 30th)
  const generateFiveDayGridLines = () => {
    const lines = []

    // Start from the first day of the month containing minDate
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1)

    while (current <= maxDate) {
      // For each month, add lines on 5th, 10th, 15th, 20th, 25th, 30th (every 5 days starting from 5)
      for (let day = 5; day <= 30; day += 5) {
        const gridDate = new Date(current.getFullYear(), current.getMonth(), day)
        // Only add if it's still in the same month and within our range
        if (gridDate.getMonth() === current.getMonth() && gridDate >= minDate && gridDate <= maxDate) {
          lines.push(new Date(gridDate))
        }
      }
      // Move to next month
      current.setMonth(current.getMonth() + 1)
    }

    return lines
  }

  const fiveDayGridLines = generateFiveDayGridLines()

  // Generate daily subdividers - optimized to only generate when zoomed in
  const generateDailySubdividers = () => {
    // Only show daily subdividers when zoomed in enough
    if (pixelsPerDay < 10) return []

    const lines = []
    const current = new Date(minDate)
    current.setHours(0, 0, 0, 0)

    // Limit to reasonable number of subdividers
    const maxSubdividers = 500
    let count = 0

    while (current <= maxDate && count < maxSubdividers) {
      // Skip days that already have a 5-day grid line
      const day = current.getDate()
      if (day % 5 !== 0) {
        lines.push(new Date(current))
        count++
      }
      current.setDate(current.getDate() + 1)
    }

    return lines
  }

  const dailySubdividers = generateDailySubdividers()

  // Calculate pixel position for a date
  const getDatePosition = (date) => {
    if (!date) return 0
    const dateObj = new Date(date)
    dateObj.setHours(0, 0, 0, 0) // Normalize to start of day
    const minDateNormalized = new Date(minDate)
    minDateNormalized.setHours(0, 0, 0, 0)
    const daysSinceStart = Math.round((dateObj - minDateNormalized) / (1000 * 60 * 60 * 24))
    return daysSinceStart * pixelsPerDay
  }

  // Consolidated scroll sync function
  const syncScroll = (scrollLeft) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollLeft
    }
  }

  // Center on "Today" when component mounts (only once on initial mount)
  useEffect(() => {
    if (scrollContainerRef.current && !hasInitialized) {
      const todayNormalized = new Date(today)
      todayNormalized.setHours(0, 0, 0, 0)
      const minDateNormalized = new Date(minDate)
      minDateNormalized.setHours(0, 0, 0, 0)
      const daysSinceStart = Math.round((todayNormalized - minDateNormalized) / (1000 * 60 * 60 * 24))
      const todayPosition = daysSinceStart * pixelsPerDay
      const containerWidth = scrollContainerRef.current.offsetWidth
      // Center "today" in the visible scrollable area
      const scrollTo = todayPosition - containerWidth / 2
      const newScrollLeft = Math.max(0, scrollTo)
      scrollContainerRef.current.scrollLeft = newScrollLeft
      syncScroll(newScrollLeft)
      setHasInitialized(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialized])

  // Sync scroll between header and timeline
  const handleTimelineScroll = (e) => {
    syncScroll(e.target.scrollLeft)
  }

  // Mouse drag handlers - only for desktop
  const handleMouseDown = (e) => {
    // Skip drag on touch devices - use native scroll instead
    if (e.type === 'touchstart' || 'ontouchstart' in window) return
    if (!scrollContainerRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleDragMove = (e) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 2 // Scroll speed multiplier
    const newScrollLeft = scrollLeft - walk
    scrollContainerRef.current.scrollLeft = newScrollLeft
    syncScroll(newScrollLeft)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeaveContainer = () => {
    setIsDragging(false)
  }

  // Resizable column handlers
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(256)

  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = taskColumnWidth
  }

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing) return
      e.preventDefault()
      const delta = e.clientX - resizeStartXRef.current
      const newWidth = Math.max(150, Math.min(400, resizeStartWidthRef.current + delta))
      setTaskColumnWidth(newWidth)
    }

    const handleResizeEnd = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, taskColumnWidth])

  // Tooltip positioning with boundary detection
  const handleMouseMove = (e, taskId) => {
    if (taskId) {
      setHoveredTask(taskId)
      // Calculate tooltip position with boundary detection
      const tooltipWidth = 250 // Approximate tooltip width
      const tooltipHeight = 150 // Approximate tooltip height
      const padding = 10

      let x = e.clientX + padding
      let y = e.clientY + padding

      // Check right boundary
      if (x + tooltipWidth > window.innerWidth) {
        x = e.clientX - tooltipWidth - padding
      }

      // Check bottom boundary
      if (y + tooltipHeight > window.innerHeight) {
        y = e.clientY - tooltipHeight - padding
      }

      setTooltipPosition({ x, y })
    }
  }

  const handleMouseLeaveBar = () => {
    setHoveredTask(null)
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

  const todayPosition = getDatePosition(today)

  // Helper function to zoom while maintaining center point
  const zoomWithAnchor = useCallback((zoomFactor) => {
    const container = scrollContainerRef.current
    if (!container) return

    const currentScroll = container.scrollLeft
    const rect = container.getBoundingClientRect()
    const viewportCenter = rect.width / 2
    const anchorPoint = viewportCenter + currentScroll

    const newPixelsPerDay = Math.max(5, Math.min(50, pixelsPerDay * zoomFactor))
    const zoomRatio = newPixelsPerDay / pixelsPerDay
    const newScrollLeft = anchorPoint * zoomRatio - viewportCenter

    setPixelsPerDay(newPixelsPerDay)

    requestAnimationFrame(() => {
      if (container) {
        container.scrollLeft = newScrollLeft
        syncScroll(newScrollLeft)
      }
    })
  }, [pixelsPerDay])

  // Setup wheel event listener for zoom - only when hovering over timeline
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const wheelHandler = (e) => {
      // Prevent default vertical scroll and zoom instead
      e.preventDefault()
      e.stopPropagation()

      // Calculate zoom factor based on scroll direction
      const delta = -e.deltaY
      const zoomFactor = delta > 0 ? 1.05 : 0.95

      // Use the same zoom function as buttons/keyboard for consistency
      zoomWithAnchor(zoomFactor)
    }

    // Use passive: false to allow preventDefault
    container.addEventListener('wheel', wheelHandler, { passive: false })

    return () => {
      container.removeEventListener('wheel', wheelHandler)
    }
  }, [zoomWithAnchor]) // Re-attach when zoomWithAnchor changes

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Zoom in: Ctrl/Cmd + Plus
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        zoomWithAnchor(1.1)
      }
      // Zoom out: Ctrl/Cmd + Minus
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        zoomWithAnchor(0.9)
      }
      // Reset zoom: Ctrl/Cmd + 0
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        zoomWithAnchor(20 / pixelsPerDay)
      }
      // Toggle shortcuts help: ?
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowKeyboardShortcuts(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pixelsPerDay])

  return (
    <>
    <div className="bg-[#2a2a2e] rounded-lg p-4 sm:p-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h2 className="text-base sm:text-lg font-semibold text-white">Project Timeline</h2>
          <div className="text-xs text-gray-400 bg-[#1f1f23] px-2 sm:px-3 py-1.5 rounded border border-gray-700 self-start">
            <span className="hidden sm:inline">{minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → {maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="sm:hidden">{minDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} → {maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={showBlockedOnly}
              onChange={(e) => setShowBlockedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500 focus:ring-offset-0"
            />
            <span className="text-xs sm:text-sm text-gray-300 whitespace-nowrap">Show blocked only</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 sm:gap-2 bg-[#1f1f23] px-2 py-1.5 rounded border border-gray-700">
            <button
              onClick={() => zoomWithAnchor(0.9)}
              className="text-gray-400 hover:text-white active:text-white px-2 py-1 rounded hover:bg-gray-700 active:bg-gray-600 transition-colors touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Zoom out (Ctrl + -)"
            >
              −
            </button>
            <div className="text-xs text-gray-400 min-w-[50px] sm:min-w-[70px] text-center">
              <span className="hidden sm:inline">{Math.round(pixelsPerDay)}px/day</span>
              <span className="sm:hidden">{Math.round(pixelsPerDay)}px</span>
            </div>
            <button
              onClick={() => zoomWithAnchor(1.1)}
              className="text-gray-400 hover:text-white active:text-white px-2 py-1 rounded hover:bg-gray-700 active:bg-gray-600 transition-colors touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Zoom in (Ctrl + +)"
            >
              +
            </button>
            <button
              onClick={() => zoomWithAnchor(20 / pixelsPerDay)}
              className="text-xs text-gray-400 hover:text-white active:text-white px-2 py-1 rounded hover:bg-gray-700 active:bg-gray-600 transition-colors touch-manipulation min-h-[32px]"
              title="Reset zoom (Ctrl + 0)"
            >
              <span className="hidden sm:inline">Reset</span>
              <span className="sm:hidden">↺</span>
            </button>
          </div>
          {/* Help button */}
          <button
            onClick={() => setShowKeyboardShortcuts(prev => !prev)}
            className="text-xs text-gray-400 hover:text-white active:text-white bg-[#1f1f23] px-3 py-1.5 rounded border border-gray-700 transition-colors touch-manipulation min-h-[32px]"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowKeyboardShortcuts(false)} />
          <div className="relative bg-[#2a2a2e] border border-gray-600 rounded-lg p-4 sm:p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Zoom in</span>
                <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Ctrl/Cmd + +</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Zoom out</span>
                <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Ctrl/Cmd + -</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Reset zoom</span>
                <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Ctrl/Cmd + 0</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Pan timeline</span>
                <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Click & Drag</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Zoom with scroll</span>
                <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Scroll over timeline</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Toggle this help</span>
                <kbd className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">?</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowKeyboardShortcuts(false)}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded transition-colors touch-manipulation min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {readOnlyMode && (
        <div className="mb-4 rounded-lg border border-dashed border-gray-600 bg-[#1f1f23] p-3 text-sm text-gray-300">
          Timeline interactions are disabled because this project is archived.
        </div>
      )}

      {/* Legend - Compact Grid Layout */}
      <div className="mb-4 p-3 bg-[#1f1f23] rounded-lg border border-gray-700">
        <div className="flex items-start gap-3">
          <span className="text-gray-400 font-semibold text-xs whitespace-nowrap pt-0.5">Legend:</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-x-4 gap-y-2 text-xs flex-1">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-gray-500 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-blue-500 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-green-500 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-red-500 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">Overdue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-gradient-to-r from-blue-500 to-red-400 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-gradient-to-r from-gray-500 to-gray-500/20 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">No Deadline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-red-900 border border-red-600 rounded flex-shrink-0"></div>
              <span className="text-gray-300 truncate">🚫 Blocked</span>
            </div>
          </div>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No tasks to display in timeline.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Header row - sticky */}
          <div className="flex border-b border-gray-600 sticky top-0 bg-[#2a2a2e] z-20">
            {/* Task header - fixed with resize handle */}
            {!isTaskColumnCollapsed ? (
              <div className="flex-shrink-0 h-16 sm:h-20 flex items-center pr-2 relative" style={{ width: `${taskColumnWidth}px` }}>
                <button
                  onClick={() => setIsTaskColumnCollapsed(true)}
                  className="text-gray-400 hover:text-white active:text-white transition-colors touch-manipulation p-1 mr-1"
                  title="Collapse tasks column"
                  aria-label="Collapse tasks column"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <h3 className="text-xs sm:text-sm font-semibold text-gray-300 truncate flex-1">Tasks</h3>
                {/* Resize handle - hidden on mobile */}
                <div
                  className="hidden sm:block absolute right-0 top-0 bottom-0 w-1 hover:w-2 bg-gray-600 hover:bg-blue-500 cursor-col-resize transition-all group"
                  onMouseDown={handleResizeStart}
                  title="Drag to resize"
                >
                  <div className="absolute inset-y-0 -left-1 -right-1" />
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 h-16 sm:h-20 flex items-center border-r border-gray-600">
                <button
                  onClick={() => setIsTaskColumnCollapsed(false)}
                  className="text-gray-400 hover:text-white active:text-white bg-[#1f1f23] hover:bg-gray-700 active:bg-gray-600 transition-colors touch-manipulation p-2 h-full flex items-center"
                  title="Expand tasks column"
                  aria-label="Expand tasks column"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            )}

            {/* Timeline header - scrollable */}
            <div
              ref={headerScrollRef}
              className="flex-1 overflow-x-auto overflow-y-hidden -webkit-overflow-scrolling-touch"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', pointerEvents: 'none' }}
            >
              <div className="relative h-16 sm:h-20" style={{ width: `${timelineWidth}px`, pointerEvents: 'auto' }}>
                {dateMarkers.map((date, index) => {
                  const position = getDatePosition(date)
                  return (
                    <div
                      key={index}
                      className="absolute text-xs sm:text-sm font-medium text-gray-300 top-2 sm:top-4"
                      style={{ left: `${position}px`, transform: 'translateX(-50%)' }}
                    >
                      <div className="whitespace-nowrap">
                        {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  )
                })}

                {/* Today indicator line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 sm:w-1 bg-blue-400 z-10 pointer-events-none shadow-lg"
                  style={{ left: `${todayPosition}px` }}
                >
                  <div className="absolute top-0.5 sm:top-1 left-1/2 -translate-x-1/2 px-1.5 sm:px-3 py-0.5 sm:py-1 bg-blue-400 text-white text-[10px] sm:text-xs font-semibold rounded-md shadow-md whitespace-nowrap">
                    {today.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Task rows container with scroll */}
          <div className="mt-2 sm:mt-4 flex">
            {/* Fixed task labels column */}
            {!isTaskColumnCollapsed && (
              <div className="flex-shrink-0" style={{ width: `${taskColumnWidth}px` }}>
                <div className="pr-1 sm:pr-2 space-y-2 sm:space-y-3">
                {filteredTasks.map((task, index) => {
                  const isExpanded = expandedTasks.has(task.id)
                  const assigneeNames = task.assigned_to?.map(userId => {
                    const user = (allUsers || []).find(u => u.id === userId)
                    return user ? (user.name || user.email) : 'Unknown'
                  }).join(', ') || 'Unassigned'
                  const totalHeight = calculateTaskHeight(task, isExpanded)

                  return (
                    <div
                      key={`label-${task.id}`}
                      className={`pr-1 sm:pr-2 cursor-pointer hover:bg-[#1f1f23] active:bg-[#1f1f23] rounded-l transition-all duration-200 touch-manipulation ${index % 2 === 0 ? 'bg-[#25252a]/30' : ''}`}
                      onClick={() => toggleTaskExpansion(task.id)}
                      style={{ height: `${totalHeight}px` }}
                    >
                      <div className="h-12 sm:h-14 flex items-center gap-1 sm:gap-2">
                        <ChevronRight className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="text-xs sm:text-sm font-medium text-white truncate" title={task.title}>
                              {task.title}
                            </div>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 h-4 sm:h-5 bg-blue-900/50 text-blue-300 border-blue-700 flex-shrink-0">
                                {task.subtasks.length}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-400 truncate">
                            {assigneeNames}
                          </div>
                        </div>
                      </div>
                      <div
                        className="overflow-hidden transition-all duration-200"
                        style={{
                          maxHeight: isExpanded ? '400px' : '0',
                          opacity: isExpanded ? 1 : 0
                        }}
                      >
                        <div className="pb-3 space-y-1 text-xs text-gray-400 pl-6">
                          {(() => {
                            const priorityMeta = getPriorityMeta(task.priority);
                            return (
                              <div>
                                Priority:{' '}
                                <span className={priorityMeta.textClass}>
                                  {priorityMeta.label ?? 'N/A'}
                                </span>
                              </div>
                            );
                          })()}
                          <div>Status: <span className="text-blue-400">{task.status}</span></div>
                          {task.blocked && (
                            <div className="text-red-400 font-semibold">🚫 BLOCKED</div>
                          )}
                          {task.description && (
                            <div className="mt-1 text-gray-500 line-clamp-2">{task.description}</div>
                          )}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <div className="font-semibold text-gray-300 mb-1">Subtasks ({task.subtasks.length}):</div>
                              <div className="space-y-0">
                                {task.subtasks.map((subtask) => (
                                  <div key={subtask.id} className="flex items-center gap-2" style={{ height: `${TIMELINE_HEIGHTS.SUBTASK_ITEM}px` }}>
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      subtask.status === 'completed' ? 'bg-green-500' :
                                      subtask.status === 'in_progress' ? 'bg-blue-500' :
                                      subtask.status === 'blocked' ? 'bg-red-500' :
                                      'bg-gray-500'
                                    }`}></div>
                                    <span className="truncate text-gray-300" title={subtask.title}>{subtask.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            )}

            {/* Scrollable timeline bars */}
            <div
              ref={scrollContainerRef}
              className={`flex-1 overflow-x-auto overflow-y-hidden -webkit-overflow-scrolling-touch ${isDragging ? 'cursor-grabbing sm:cursor-grabbing' : 'sm:cursor-grab'} sm:active:cursor-grabbing`}
              onScroll={handleTimelineScroll}
              onMouseDown={handleMouseDown}
              onMouseMove={handleDragMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeaveContainer}
              style={{ userSelect: isDragging ? 'none' : 'auto' }}
            >
              <div style={{ width: `${timelineWidth}px` }} className="space-y-2 sm:space-y-3">
                {filteredTasks.map((task, index) => {
                  const createdDate = new Date(task.created_at)
                  const deadlineDate = task.deadline ? new Date(task.deadline) : null
                  const updatedDate = task.updated_at ? new Date(task.updated_at) : null
                  const isCompleted = task.status === 'completed'
                  const isBlocked = task.blocked === true || task.status === 'blocked'
                  const isOverdue = deadlineDate && !isCompleted && deadlineDate < today
                  const isExpanded = expandedTasks.has(task.id)

                  const startPos = getDatePosition(createdDate)
                  let endPos
                  let showOverdueExtension = false
                  let wasLateCompletion = false

                  if (isCompleted && updatedDate) {
                    endPos = getDatePosition(updatedDate)
                    if (deadlineDate && updatedDate > deadlineDate) {
                      wasLateCompletion = true
                    }
                  } else if (deadlineDate) {
                    endPos = getDatePosition(deadlineDate)
                    if (isOverdue) {
                      showOverdueExtension = true
                    }
                  } else {
                    // No deadline - extend far to the right
                    endPos = timelineWidth
                  }

                  const barWidth = endPos - startPos
                  const overdueExtensionWidth = showOverdueExtension
                    ? getDatePosition(today) - endPos
                    : 0
                  const totalHeight = calculateTaskHeight(task, isExpanded)

                  return (
                    <div
                      key={`bar-${task.id}`}
                      className={`relative group hover:bg-[#1f1f23]/50 active:bg-[#1f1f23]/50 rounded-r transition-all duration-200 ${index % 2 === 0 ? 'bg-[#25252a]/30' : ''}`}
                      style={{ height: `${totalHeight}px` }}
                    >
                      {/* Main task bar section */}
                      <div className="relative h-12 sm:h-14">
                        {/* Monthly grid lines (darker) */}
                        {dateMarkers.map((date, index) => (
                          <div
                            key={`month-${index}`}
                            className="absolute top-0 bottom-0 w-px bg-gray-600/70 pointer-events-none"
                            style={{ left: `${getDatePosition(date)}px` }}
                          />
                        ))}
                        {/* 5-day grid lines (medium) */}
                        {fiveDayGridLines.map((date, index) => (
                          <div
                            key={`five-day-${index}`}
                            className="absolute top-0 bottom-0 w-px bg-gray-700/40 pointer-events-none"
                            style={{ left: `${getDatePosition(date)}px` }}
                          />
                        ))}
                        {/* Daily subdividers (light) */}
                        {dailySubdividers.map((date, index) => (
                          <div
                            key={`daily-${index}`}
                            className="absolute top-0 bottom-0 w-px bg-gray-700/15 pointer-events-none"
                            style={{ left: `${getDatePosition(date)}px` }}
                          />
                        ))}

                        {/* Main task bar */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-6 rounded group-hover:h-7 cursor-pointer hover:shadow-lg transition-shadow"
                          style={{
                            left: `${startPos}px`,
                            width: `${barWidth}px`,
                            pointerEvents: 'auto',
                          }}
                          onMouseMove={(e) => handleMouseMove(e, task.id)}
                          onMouseLeave={handleMouseLeaveBar}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (readOnlyMode) return
                            setEditingTask(task)
                          }}
                        >
                          {wasLateCompletion && deadlineDate ? (
                            <>
                              <div
                                className="absolute h-full bg-blue-500 rounded-l"
                                style={{
                                  left: 0,
                                  width: `${getDatePosition(deadlineDate) - startPos}px`,
                                }}
                              />
                              <div
                                className="absolute h-full bg-red-400 rounded-r"
                                style={{
                                  left: `${getDatePosition(deadlineDate) - startPos}px`,
                                  right: 0,
                                }}
                              />
                            </>
                          ) : (
                            <div
                              className={`h-full ${showOverdueExtension ? 'rounded-l' : 'rounded'} ${
                                isBlocked ? 'bg-red-900 border-2 border-red-600' :
                                isCompleted ? 'bg-green-500' :
                                task.status === 'in_progress' ? 'bg-blue-500' :
                                'bg-gray-500'
                              } ${
                                !deadlineDate && !isCompleted && !isBlocked ? 'bg-gradient-to-r from-gray-500 to-gray-500/20' : ''
                              }`}
                            />
                          )}

                          {/* Overdue extension */}
                          {showOverdueExtension && (
                            <div
                              className="absolute top-0 h-full bg-red-500 rounded-r"
                              style={{
                                left: '100%',
                                width: `${overdueExtensionWidth}px`,
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Expanded details section */}
                      {isExpanded && (
                        <div style={{ height: `${TIMELINE_HEIGHTS.EXPANDED_DETAILS}px` }} className="px-2">
                          {/* Empty space for task details that are shown on the left */}
                        </div>
                      )}

                      {/* Subtasks bars - shown when expanded */}
                      {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                        <div className="space-y-0">
                          {task.subtasks.map((subtask) => {
                            const subtaskCreatedDate = new Date(subtask.created_at)
                            const subtaskDeadlineDate = subtask.deadline ? new Date(subtask.deadline) : null
                            const subtaskUpdatedDate = subtask.updated_at ? new Date(subtask.updated_at) : null
                            const subtaskIsCompleted = subtask.status === 'completed'
                            const subtaskIsBlocked = subtask.status === 'blocked'
                            const subtaskIsOverdue = subtaskDeadlineDate && !subtaskIsCompleted && subtaskDeadlineDate < today

                            const subtaskStartPos = getDatePosition(subtaskCreatedDate)
                            let subtaskEndPos
                            let subtaskShowOverdueExtension = false
                            let subtaskWasLateCompletion = false

                            if (subtaskIsCompleted && subtaskUpdatedDate) {
                              subtaskEndPos = getDatePosition(subtaskUpdatedDate)
                              if (subtaskDeadlineDate && subtaskUpdatedDate > subtaskDeadlineDate) {
                                subtaskWasLateCompletion = true
                              }
                            } else if (subtaskDeadlineDate) {
                              subtaskEndPos = getDatePosition(subtaskDeadlineDate)
                              if (subtaskIsOverdue) {
                                subtaskShowOverdueExtension = true
                              }
                            } else {
                              // No deadline - use parent task end
                              subtaskEndPos = startPos + barWidth
                            }

                            const subtaskBarWidth = subtaskEndPos - subtaskStartPos
                            const subtaskOverdueExtensionWidth = subtaskShowOverdueExtension
                              ? getDatePosition(today) - subtaskEndPos
                              : 0

                            return (
                              <div key={`subtask-bar-${subtask.id}`} className="relative flex items-center" style={{ height: `${TIMELINE_HEIGHTS.SUBTASK_ITEM}px` }}>
                                <div
                                  className="absolute h-6 rounded cursor-pointer hover:shadow-lg transition-shadow"
                                  style={{
                                    left: `${subtaskStartPos}px`,
                                    width: `${subtaskBarWidth}px`,
                                    pointerEvents: 'auto',
                                  }}
                                  onMouseMove={(e) => handleMouseMove(e, `subtask-${subtask.id}`)}
                                  onMouseLeave={handleMouseLeaveBar}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingTask(subtask)
                                  }}
                                >
                                  {subtaskWasLateCompletion && subtaskDeadlineDate ? (
                                    <>
                                      <div
                                        className="absolute h-full bg-blue-500 rounded-l"
                                        style={{
                                          left: 0,
                                          width: `${getDatePosition(subtaskDeadlineDate) - subtaskStartPos}px`,
                                        }}
                                      />
                                      <div
                                        className="absolute h-full bg-red-400 rounded-r"
                                        style={{
                                          left: `${getDatePosition(subtaskDeadlineDate) - subtaskStartPos}px`,
                                          right: 0,
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <div
                                      className={`h-full ${subtaskShowOverdueExtension ? 'rounded-l' : 'rounded'} ${
                                        subtaskIsBlocked ? 'bg-red-900 border-2 border-red-600' :
                                        subtaskIsCompleted ? 'bg-green-500' :
                                        subtask.status === 'in_progress' ? 'bg-blue-500' :
                                        'bg-gray-500'
                                      } ${
                                        !subtaskDeadlineDate && !subtaskIsCompleted && !subtaskIsBlocked ? 'bg-gradient-to-r from-gray-500 to-gray-500/20' : ''
                                      }`}
                                    />
                                  )}

                                  {/* Overdue extension for subtask */}
                                  {subtaskShowOverdueExtension && (
                                    <div
                                      className="absolute top-0 h-full bg-red-500 rounded-r"
                                      style={{
                                        left: '100%',
                                        width: `${subtaskOverdueExtensionWidth}px`,
                                      }}
                                    />
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Floating tooltip that follows cursor */}
          {hoveredTask && (
            (() => {
              // Check if it's a subtask (string format: 'subtask-{id}')
              const isSubtask = typeof hoveredTask === 'string' && hoveredTask.startsWith('subtask-')
              let task, subtask

              if (isSubtask) {
                const subtaskId = parseInt(hoveredTask.replace('subtask-', ''))
                // Find the parent task that contains this subtask
                for (const t of filteredTasks) {
                  subtask = t.subtasks?.find(st => st.id === subtaskId)
                  if (subtask) {
                    task = t
                    break
                  }
                }
                if (!subtask) return null
              } else {
                task = filteredTasks.find(t => t.id === hoveredTask)
                if (!task) return null
              }

              const itemToShow = isSubtask ? subtask : task
              const createdDate = new Date(itemToShow.created_at)
              const deadlineDate = itemToShow.deadline ? new Date(itemToShow.deadline) : null
              const updatedDate = itemToShow.updated_at ? new Date(itemToShow.updated_at) : null
              const isCompleted = itemToShow.status === 'completed'
              const isOverdue = deadlineDate && !isCompleted && deadlineDate < today
              const wasLateCompletion = isCompleted && updatedDate && deadlineDate && updatedDate > deadlineDate

              return (
                <div
                  className="fixed bg-gray-800 text-white text-xs rounded px-3 py-2 z-50 pointer-events-none shadow-lg border border-gray-600"
                  style={{
                    left: `${tooltipPosition.x + 10}px`,
                    top: `${tooltipPosition.y + 10}px`,
                  }}
                >
                  {isSubtask && <div className="text-blue-300 text-[10px] mb-1">SUBTASK of: {task.title}</div>}
                  <div className="font-semibold mb-1">{itemToShow.title}</div>
                  <div>Start: {createdDate.toLocaleDateString()}</div>
                  {deadlineDate && <div>Deadline: {deadlineDate.toLocaleDateString()}</div>}
                  {isCompleted && updatedDate && <div>Completed: {updatedDate.toLocaleDateString()}</div>}
                  {!deadlineDate && !isCompleted && <div>No deadline set</div>}
                  {itemToShow.blocked && <div className="text-red-400 font-semibold">🚫 BLOCKED</div>}
                  {isOverdue && <div className="text-red-400">Overdue!</div>}
                  {wasLateCompletion && <div className="text-red-300">Completed late</div>}
                  <div className="mt-1 text-gray-400">Status: {itemToShow.status}</div>
                </div>
              )
            })()
          )}
        </div>
      )}
    </div>

    {/* Task Editing Side Panel for Timeline */}
    {!readOnlyMode && editingTask && (
      <TaskEditingSidePanel
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={onUpdateTask}
        onDelete={() => onDeleteTask(editingTask.id)}
        allUsers={allUsers}
        projectMembers={projectMembers}
      />
    )}
    </>
  )
}
