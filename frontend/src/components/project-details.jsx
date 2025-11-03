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
import { getPriorityMeta } from "@/lib/utils"
import { PriorityDropdown } from "./priority-dropdown"
import { RecurrencePicker } from "./recurrence-picker"
import { SubtaskDialog } from "./subtask-dialog"
import toast from "react-hot-toast"

const API = process.env.NEXT_PUBLIC_API_URL ;

const normalizePriorityValue = (priority) => {
  if (priority === null || priority === undefined) {
    return null;
  }
  if (typeof priority === "string") {
    const trimmed = priority.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }
  if (typeof priority === "object") {
    if (typeof priority.value === "string" && priority.value.trim().length > 0) {
      return priority.value.trim().toLowerCase();
    }
    if (typeof priority.label === "string" && priority.label.trim().length > 0) {
      return priority.label.trim().toLowerCase();
    }
  }
  const fallback = String(priority).trim();
  return fallback ? fallback.toLowerCase() : null;
};

const getPriorityPresentation = (priority) => {
  const normalized = normalizePriorityValue(priority);
  if (!normalized) {
    return {
      normalized: null,
      uppercase: null,
      badgeClass: "bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 font-medium",
      textClass: "text-gray-400"
    };
  }

  const badgeClass = normalized === "high"
    ? "bg-red-100 dark:bg-red-600 text-red-800 dark:text-white border border-red-300 dark:border-red-600 font-medium"
    : normalized === "medium"
      ? "bg-amber-100 dark:bg-amber-600 text-amber-800 dark:text-white border border-amber-300 dark:border-amber-600 font-medium"
      : normalized === "low"
        ? "bg-green-100 dark:bg-green-600 text-green-800 dark:text-white border border-green-300 dark:border-green-600 font-medium"
        : "bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border border-gray-300 dark:border-gray-600 font-medium";

  const textClass = normalized === "high"
    ? "text-red-400"
    : normalized === "medium"
      ? "text-yellow-400"
      : normalized === "low"
        ? "text-green-400"
        : "text-gray-400";

  return {
    normalized,
    uppercase: normalized.toUpperCase(),
    badgeClass,
    textClass
  };
};

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

  const handleCreateTask = async ({ title, description, dueDate, priority, tags, assignees = [], attachments = [], recurrence }) => {
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
          recurrence: recurrence ?? null,
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
        const errorMessage = errorData.message || errorData.error || `Failed to update task: ${response.status}`
        throw new Error(errorMessage)
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
    const normalizedPriority = normalizePriorityValue(task.priority)
    const matchesPriority = taskFilters.priority === 'all' || normalizedPriority === taskFilters.priority.toLowerCase()

    // If showing blocked only, ignore other filters except assignee and priority
    if (taskFilters.showBlockedOnly) {
      if (!isBlocked) return false

      if (taskFilters.assignee && !task.assigned_to?.some(userId => {
        const user = (allUsers || []).find(u => u.id === userId)
        return user && (user.name || user.email).toLowerCase().includes(taskFilters.assignee.toLowerCase())
      })) {
        return false
      }

      if (taskFilters.priority !== 'all') {
        const taskPriority = Number(task.priority);
        const filterPriority = Number(taskFilters.priority);
        if (!isNaN(taskPriority) && !isNaN(filterPriority) && taskPriority !== filterPriority) {
          return false;
        }
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

    if (taskFilters.priority !== 'all') {
      const taskPriority = Number(task.priority)
      const filterPriority = Number(taskFilters.priority)
      const bothNumeric = !Number.isNaN(taskPriority) && !Number.isNaN(filterPriority)
      if (bothNumeric) {
        if (taskPriority !== filterPriority) {
          return false
        }
      } else if (!matchesPriority) {
        return false
      }
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
    return <div className="flex-1 p-6 flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--foreground))' }}>Loading project...</div>
  }

  if (!project) {
    return <div className="flex-1 p-6 flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--foreground))' }}>Project not found</div>
  }

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-x-hidden" style={{ backgroundColor: 'rgb(var(--background))' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white self-start sm:self-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back to Board</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate" style={{ color: 'rgb(var(--foreground))' }}>{project.name || 'Unnamed Project'}</h1>
            {project.status === 'archived' && (
              <span className="px-2 py-1 text-xs sm:text-sm rounded-full flex-shrink-0" style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}>
                Archived
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'rgb(var(--card))' }}>
              <Button
                size="sm"
                variant={viewMode === 'details' ? 'default' : 'ghost'}
                onClick={() => setViewMode('details')}
                className={viewMode === 'details' ? 'bg-blue-600 text-white text-xs sm:text-sm' : 'text-xs sm:text-sm'}
                style={viewMode === 'details' ? {} : { color: 'rgb(var(--muted-foreground))' }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'details') {
                    e.currentTarget.style.color = 'rgb(var(--foreground))';
                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'details') {
                    e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
              >
                <List className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Details</span>
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                onClick={() => setViewMode('timeline')}
                className={viewMode === 'timeline' ? 'bg-blue-600 text-white text-xs sm:text-sm' : 'text-xs sm:text-sm'}
                style={viewMode === 'timeline' ? {} : { color: 'rgb(var(--muted-foreground))' }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'timeline') {
                    e.currentTarget.style.color = 'rgb(var(--foreground))';
                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'timeline') {
                    e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
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
          <div className="mb-6 rounded-lg border border-dashed p-4 text-sm" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))', color: 'rgb(var(--muted-foreground))' }}>
            This project is archived.
          </div>
        )}
        {/* Project Info */}
        <div className="rounded-lg p-4 sm:p-6 mb-4 sm:mb-6" style={{ backgroundColor: 'rgb(var(--card))' }}>
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4" style={{ color: 'rgb(var(--foreground))' }}>Project Details</h2>
          <p className="text-sm sm:text-base" style={{ color: 'rgb(var(--muted-foreground))' }}>{project.description || "No description available."}</p>
        </div>

        {/* Members Section */}
        <div className="rounded-lg p-4 sm:p-6" style={{ backgroundColor: 'rgb(var(--card))' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>Project Members</h2>
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
            <div className="mb-4 p-3 sm:p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--muted))' }}>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--muted-foreground))' }} />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Invitation Message (optional)</label>
                <textarea
                  value={invitationMessage}
                  onChange={(e) => setInvitationMessage(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}
                  rows={3}
                  placeholder="Add a personal message with the invitation..."
                />
              </div>

              {/* Bulk Actions */}
              {filteredUsers.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--card))' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
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
                  <div className="text-sm p-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    <div>No users available to add.</div>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-2 p-2 rounded"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2 flex-shrink-0"
                          style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))' }}
                        />
                        <Avatar className="w-6 h-6 flex-shrink-0">
                          <AvatarFallback className="bg-purple-500 text-white text-xs">
                            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'rgb(var(--foreground))' }}>{user.name || 'Unknown User'}</p>
                          <p className="text-xs truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>{user.email}</p>
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
                <div key={member.user_id} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className="bg-purple-500 text-white">
                        {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <p className="font-medium text-sm sm:text-base truncate" style={{ color: 'rgb(var(--foreground))' }}>{member.name || 'Unknown User'}</p>
                        <span className={`text-xs px-2 py-0.5 sm:py-1 rounded-full self-start sm:self-auto flex-shrink-0 border font-medium ${
                          userRole === 'manager' ? 'bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white border-blue-300 dark:border-blue-600' :
                          userRole === 'creator' ? 'bg-red-100 dark:bg-red-600 text-red-800 dark:text-white border-red-300 dark:border-red-600' :
                          'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600'
                        }`}>
                          {userRole}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>{member.email}</p>
                    </div>
                  </div>
                  {userPermissions.canManageMembers && !isReadOnly && userRole !== 'creator' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-400 flex-shrink-0 p-2"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#fca5a5';
                        e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#f87171';
                        e.currentTarget.style.backgroundColor = '';
                      }}
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
        <div className="rounded-lg p-4 sm:p-6 mt-4 sm:mt-6" style={{ backgroundColor: 'rgb(var(--card))' }}>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>Project Tasks</h2>
                {/* Progress Indicator */}
                <div className="flex items-center gap-2">
                  <div className="w-20 sm:w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {completedTasks}/{totalTasks} ({progressPercent}%)
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  size="sm"
                  style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--muted-foreground))' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
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
            <div className="rounded-lg p-3 sm:p-4 mb-4" style={{ backgroundColor: 'rgb(var(--muted))' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Assignee</label>
                  <Input
                    placeholder="Search assignee..."
                    value={taskFilters.assignee}
                    onChange={(e) => setTaskFilters(prev => ({ ...prev, assignee: e.target.value }))}
                    className="text-sm"
                    style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Due Date</label>
                  <Input
                    type="date"
                    value={taskFilters.dueDate}
                    onChange={(e) => setTaskFilters(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="text-sm"
                    style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Priority</label>
                  <Select
                    value={taskFilters.priority}
                    onValueChange={(value) => setTaskFilters(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger className="text-sm" style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}>
                      <SelectValue placeholder="Any priority" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))', color: 'white' }}>
                      <SelectItem value="all" style={{ color: 'black' }} className="data-[highlighted]:bg-cyan-200">Any priority</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                        <SelectItem key={p} value={p.toString()} style={{ color: 'black' }}>
                          Priority {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Status</label>
                  <Select
                    value={taskFilters.status}
                    onValueChange={(value) => setTaskFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="text-sm" style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}>
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))', color: 'white' }}>
                      <SelectItem value="all" style={{ color: 'black' }} className="data-[highlighted]:bg-cyan-200">Any status</SelectItem>
                      <SelectItem value="pending" style={{ color: 'black' }} className="data-[highlighted]:bg-red-200">Pending</SelectItem>
                      <SelectItem value="in_progress" style={{ color: 'black' }} className="data-[highlighted]:bg-amber-200">In Progress</SelectItem>
                      <SelectItem value="completed" style={{ color: 'black' }} className="data-[highlighted]:bg-green-200">Completed</SelectItem>
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
                    className="w-4 h-4 rounded text-red-500 focus:ring-red-500 focus:ring-offset-0"
                    style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--muted))' }}
                  />
                  <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>Show blocked tasks only</span>
                </label>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  size="sm"
                  style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--muted-foreground))' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
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
              pending: 'bg-amber-400 dark:bg-amber-600',
              in_progress: 'bg-blue-400 dark:bg-blue-600',
              completed: 'bg-green-400 dark:bg-green-600',
              blocked: 'bg-red-400 dark:bg-red-600'
            }

            return (
              <div key={status} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${statusColors[status]}`}></div>
                  <h3 className="font-medium" style={{ color: 'rgb(var(--foreground))' }}>{statusLabels[status]}</h3>
                  <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>({statusTasks.length})</span>
                </div>

                <div className="space-y-2">
                  {statusTasks.length === 0 ? (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                      <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>No {statusLabels[status].toLowerCase()} tasks</p>
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
                        <div key={task.id} className="rounded-lg overflow-hidden" style={{ backgroundColor: 'rgb(var(--muted))' }}>
                          <div
                            className="p-4 cursor-pointer transition-colors"
                            onClick={() => toggleTaskExpansion(task.id)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--card))'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <button
                                  className="mt-1"
                                  style={{ color: 'rgb(var(--muted-foreground))' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="flex-1">
                                  <h4 className="font-medium mb-1" style={{ color: 'rgb(var(--foreground))' }}>{task.title}</h4>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span style={{ color: 'rgb(var(--muted-foreground))' }}>Assigned to:
                                      <span className="text-blue-400 ml-1">{assigneeNames}</span>
                                    </span>
                                    {priorityMeta.label && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityMeta.badgeClass}`}>
                                        {priorityMeta.label}
                                      </span>
                                    )}
                                    {task.blocked && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-600">
                                        🚫 BLOCKED
                                      </span>
                                    )}
                                    {task.deadline && (
                                      <span style={{ color: 'rgb(var(--muted-foreground))' }}>Due:
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
                            <div className="border-t p-4" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--background))' }}>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Description</label>
                                  <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                                    {task.description || 'No description provided'}
                                  </p>
                                </div>

                                {task.tags && task.tags.length > 0 && (
                                  <div>
                                    <label className="text-xs block mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Tags</label>
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.map((tag, index) => (
                                        <span
                                          key={index}
                                          className="px-2 py-1 rounded-md text-xs"
                                          style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
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
          <div className="relative border rounded-lg p-6 max-w-md mx-4 shadow-2xl" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Archive className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>
                  Archive Project
                </h3>
                <p className="text-sm mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  Are you sure you want to archive this project? This action will:
                </p>
                <ul className="text-sm mb-6 space-y-1 ml-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  <li>• Set the project status to &quot;archived&quot;</li>
                  <li>• Archive all tasks within the project</li>
                  <li>• Make the project read-only</li>
                </ul>
                <p className="text-sm mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  This action cannot be undone from the interface.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button
                onClick={() => setShowArchiveConfirm(false)}
                variant="outline"
                style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--muted-foreground))' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'rgb(var(--foreground))';
                  e.currentTarget.style.borderColor = 'rgb(var(--muted-foreground))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                  e.currentTarget.style.borderColor = 'rgb(var(--border))';
                }}
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
      <DialogContent className="max-w-md" style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}>
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
              style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}
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
              className="resize-none"
              style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}
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
              <SelectTrigger style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))', color: 'rgb(var(--foreground))' }}>
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
  const [recurrence, setRecurrence] = useState(null)

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
  const canSave = title.trim().length > 0 && description.trim().length > 0 && priority !== "" && assignees.length <= MAX_ASSIGNEES && dueDate.trim().length > 0

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
    <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--muted))' }}>
      {/* Title */}
      <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Title</label>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="mb-3 bg-transparent"
        style={{ color: 'rgb(var(--foreground))', borderColor: 'rgb(var(--border))' }}
      />

      {/* Description */}
      <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Description</label>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a short description…"
        className="mb-3 bg-transparent"
        style={{ color: 'rgb(var(--foreground))', borderColor: 'rgb(var(--border))' }}
        rows={3}
      />

      {/* Tags */}
      <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center rounded-md px-2 py-1 text-xs"
            style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
          >
            {tag}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                removeTag(index)
              }}
              className="ml-1"
              style={{ color: 'rgb(var(--muted-foreground))' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
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
              <div className="absolute z-50 border rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
                {availableAssigneeResults.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="w-full px-3 py-2 text-left"
                    style={{ color: 'rgb(var(--foreground))' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    onClick={() => addAssignee(member)}
                  >
                    <span className="font-medium">{member.name}</span>
                    {member.email && (
                      <span className="ml-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>{member.email}</span>
                    )}
                  </button>
                ))}
                {showNoResults && (
                  <div className="px-3 py-2 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>No matching members</div>
                )}
              </div>
            )}
          </div>
        {assignees.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {assignees.map((assignee) => (
              <Badge
                key={assignee.id}
                className="px-2 py-0.5 text-xs font-medium flex items-center"
                style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
                title={assignee.name}
              >
                {assignee.name}
                <button
                  type="button"
                  className="ml-1 disabled:opacity-60"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
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
          <PriorityDropdown
            value={priority}
            onValueChange={setPriority}
            triggerClassName="bg-transparent text-gray-100 border-gray-700"
            contentClassName="bg-white"
          />
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

      {/* Recurrence */}
      <div className="mb-4">
        <RecurrencePicker
          value={recurrence}
          onChange={setRecurrence}
        />
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
              recurrence: recurrence ?? undefined,
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
  const [recurrence, setRecurrence] = useState(task.recurrence ?? null)
  const [subtasks, setSubtasks] = useState([])
  const [isSubtaskOpen, setIsSubtaskOpen] = useState(false)
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

  const isPendingStatus = status === "pending"
  const canUpdateHours = userIsAssignee && !isPendingStatus
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

  // Load subtasks
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetchWithCsrf(`${API}/tasks?archived=false&parent_id=${task.id}`)
        if (!res.ok) throw new Error(`GET /tasks ${res.status}`)
        const rows = await res.json()
        if (mounted) setSubtasks(Array.isArray(rows) ? rows : [])
      } catch (e) {
        console.error('[load subtasks]', e)
      }
    })()
    return () => { mounted = false }
  }, [task.id])

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
    
    try {
      if (isMountedRef.current) setSaving(true)
      
      // Upload attachments first if there are any
      if (attachments.length > 0) {
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
        } catch (error) {
          console.error('Error uploading files:', error)
          toast.error(error.message || 'Failed to upload files', { duration: 5000 })
          // Don't proceed with save if file upload fails
          return
        }
      }
      
      // Now save the task
      const payload = {
        id: task.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        deadline,
        tags,
        assignees: assignees.map((assignee) => assignee.id),
        recurrence: recurrence ?? null
      }
      if (canUpdateHours && hoursSpent !== "" && Number.isFinite(numericHours) && numericHours >= 0) {
        payload.hours = numericHours
      }
      
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
      <div className="absolute right-0 top-0 h-full w-[420px] border-l p-6 overflow-y-auto" style={{ backgroundColor: 'rgb(var(--background))', borderColor: 'rgb(var(--border))' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>Edit task</h3>
          <button
            onClick={onClose}
            className="text-xl leading-none"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
          >×</button>
        </div>

        {!canEditTask && (
          <div className="mb-4 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            You are not assigned to this task, so the fields are read-only.
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent"
              style={{ color: 'rgb(var(--foreground))', borderColor: 'rgb(var(--border))' }}
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
            <PriorityDropdown
              value={priority}
              onValueChange={setPriority}
              disabled={!canEditTask}
              triggerClassName="bg-transparent text-gray-100 border-gray-700"
              contentClassName="bg-white"
            />
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

          {!isPendingStatus ? (
            <>
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
            </>
          ) : (
            <div className="rounded-md border p-3 text-xs" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))', color: 'rgb(var(--muted-foreground))' }}>
              Time tracking becomes available after this task leaves the pending state.
            </div>
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
                  <div className="absolute z-50 border rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
                      {availableAssigneeResults.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className="w-full px-3 py-2 text-left"
                          style={{ color: 'rgb(var(--foreground))' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                          onClick={() => addAssignee(member)}
                        >
                          <span className="font-medium">{member.name}</span>
                          {member.email && (
                            <span className="ml-2 text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>{member.email}</span>
                          )}
                        </button>
                      ))}
                      {showNoAssigneeResults && (
                        <div className="px-3 py-2 text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>No matching members</div>
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
              <p className="text-xs text-gray-400 mt-2">
                {attachments.length} file{attachments.length > 1 ? 's' : ''} selected. Click &quot;Save&quot; to upload and save changes.
              </p>
            )}
          </div>

          {/* Subtasks - Only show for parent tasks (not for subtasks themselves) */}
          {!task.parent_id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">Subtasks</label>
                <Button
                  type="button"
                  className="text-white h-8 px-3 bg-gray-700 hover:bg-gray-600"
                  onClick={() => setIsSubtaskOpen(true)}
                  disabled={!canEditTask}
                >
                  + Add subtask
                </Button>
              </div>

              {/* Table: Name + Status */}
              {subtasks.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 text-gray-300">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {subtasks.map((st) => (
                        <tr
                          key={st.id}
                          className="hover:bg-gray-800 text-gray-300"
                        >
                          <td className="px-3 py-2">
                            {st.title}
                          </td>
                          <td className="px-3 py-2">
                            {st.workflow || st.status || "pending"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-gray-500">No subtasks yet.</div>
              )}

              {/* Subtask Dialog */}
              {isSubtaskOpen && (
                <SubtaskDialog
                  parentId={task.id}
                  parentDeadline={deadline}
                  onClose={() => setIsSubtaskOpen(false)}
                  onCreated={(row) => {
                    setSubtasks((prev) => [row, ...prev])
                    setIsSubtaskOpen(false)
                  }}
                />
              )}
            </div>
          )}

          {/* Recurrence */}
          <RecurrencePicker
            value={recurrence}
            onChange={setRecurrence}
            disabled={!canEditTask}
          />

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
    <div className="rounded-lg p-4 sm:p-6 overflow-x-hidden" style={{ backgroundColor: 'rgb(var(--card))' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'rgb(var(--foreground))' }}>Project Timeline</h2>
          <div className="text-xs px-2 sm:px-3 py-1.5 rounded border self-start" style={{ color: 'rgb(var(--muted-foreground))', backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))' }}>
            <span className="hidden sm:inline">{minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → {maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="sm:hidden">{minDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} → {maxDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={showBlockedOnly}
              onChange={(e) => setShowBlockedOnly(e.target.checked)}
              className="w-4 h-4 rounded text-red-500 focus:ring-red-500 focus:ring-offset-0"
              style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--muted))' }}
            />
            <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--muted-foreground))' }}>Show blocked only</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 rounded border" style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))' }}>
            <button
              onClick={() => zoomWithAnchor(0.9)}
              className="px-2 py-1 rounded transition-colors touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ color: 'rgb(var(--muted-foreground))' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgb(var(--foreground))';
                e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                e.currentTarget.style.backgroundColor = '';
              }}
              title="Zoom out (Ctrl + -)"
            >
              −
            </button>
            <div className="text-xs min-w-[50px] sm:min-w-[70px] text-center" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <span className="hidden sm:inline">{Math.round(pixelsPerDay)}px/day</span>
              <span className="sm:hidden">{Math.round(pixelsPerDay)}px</span>
            </div>
            <button
              onClick={() => zoomWithAnchor(1.1)}
              className="px-2 py-1 rounded transition-colors touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ color: 'rgb(var(--muted-foreground))' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgb(var(--foreground))';
                e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                e.currentTarget.style.backgroundColor = '';
              }}
              title="Zoom in (Ctrl + +)"
            >
              +
            </button>
            <button
              onClick={() => zoomWithAnchor(20 / pixelsPerDay)}
              className="text-xs px-2 py-1 rounded transition-colors touch-manipulation min-h-[32px]"
              style={{ color: 'rgb(var(--muted-foreground))' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgb(var(--foreground))';
                e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                e.currentTarget.style.backgroundColor = '';
              }}
              title="Reset zoom (Ctrl + 0)"
            >
              <span className="hidden sm:inline">Reset</span>
              <span className="sm:hidden">↺</span>
            </button>
          </div>
          {/* Help button */}
          <button
            onClick={() => setShowKeyboardShortcuts(prev => !prev)}
            className="text-xs px-3 py-1.5 rounded border transition-colors touch-manipulation min-h-[32px]"
            style={{ color: 'rgb(var(--muted-foreground))', backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgb(var(--foreground))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
            }}
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
          <div className="relative border rounded-lg p-4 sm:p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }}>
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
        <div className="mb-4 rounded-lg border border-dashed p-3 text-sm" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--muted-foreground))' }}>
          Timeline interactions are disabled because this project is archived.
        </div>
      )}

      {/* Legend - Compact Grid Layout */}
      <div className="mb-4 p-3 rounded-lg border" style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))' }}>
        <div className="flex items-start gap-3">
          <span className="font-semibold text-xs whitespace-nowrap pt-0.5" style={{ color: 'rgb(var(--muted-foreground))' }}>Legend:</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-x-4 gap-y-2 text-xs flex-1">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-gray-500 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-blue-500 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-green-500 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-red-500 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>Overdue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-gradient-to-r from-blue-500 to-red-400 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-gradient-to-r from-gray-500 to-gray-500/20 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>No Deadline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-2.5 bg-red-900 border border-red-600 rounded flex-shrink-0"></div>
              <span className="truncate" style={{ color: 'rgb(var(--muted-foreground))' }}>🚫 Blocked</span>
            </div>
          </div>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-8">
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>No tasks to display in timeline.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Header row - sticky */}
          <div className="flex border-b sticky top-0 z-20" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))' }}>
            {/* Task header - fixed with resize handle */}
            {!isTaskColumnCollapsed ? (
              <div className="flex-shrink-0 h-16 sm:h-20 flex items-center pr-2 relative" style={{ width: `${taskColumnWidth}px` }}>
                <button
                  onClick={() => setIsTaskColumnCollapsed(true)}
                  className="transition-colors touch-manipulation p-1 mr-1"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--foreground))'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--muted-foreground))'}
                  title="Collapse tasks column"
                  aria-label="Collapse tasks column"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <h3 className="text-xs sm:text-sm font-semibold truncate flex-1" style={{ color: 'rgb(var(--muted-foreground))' }}>Tasks</h3>
                {/* Resize handle - hidden on mobile */}
                <div
                  className="hidden sm:block absolute right-0 top-0 bottom-0 w-1 hover:w-2 cursor-col-resize transition-all group"
                  style={{ backgroundColor: 'rgb(var(--border))' }}
                  onMouseDown={handleResizeStart}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--border))'}
                  title="Drag to resize"
                >
                  <div className="absolute inset-y-0 -left-1 -right-1" />
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 h-16 sm:h-20 flex items-center border-r" style={{ borderColor: 'rgb(var(--border))' }}>
                <button
                  onClick={() => setIsTaskColumnCollapsed(false)}
                  className="transition-colors touch-manipulation p-2 h-full flex items-center"
                  style={{ color: 'rgb(var(--muted-foreground))', backgroundColor: 'rgb(var(--muted))' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'rgb(var(--foreground))';
                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
                  }}
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
                      className="absolute text-xs sm:text-sm font-medium top-2 sm:top-4"
                      style={{ left: `${position}px`, transform: 'translateX(-50%)', color: 'rgb(var(--muted-foreground))' }}
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
                  const priorityInfo = getPriorityPresentation(task.priority)
                  const priorityTextClass = priorityInfo.uppercase ? priorityInfo.textClass : "text-gray-500"
                  const priorityText = priorityInfo.uppercase || "N/A"

                  return (
                    <div
                      key={`label-${task.id}`}
                      className="pr-1 sm:pr-2 cursor-pointer rounded-l transition-all duration-200 touch-manipulation"
                      onClick={() => toggleTaskExpansion(task.id)}
                      style={{
                        height: `${totalHeight}px`,
                        backgroundColor: index % 2 === 0 ? 'rgba(var(--muted-rgb), 0.3)' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'rgba(var(--muted-rgb), 0.3)' : 'transparent'}
                    >
                      <div className="h-12 sm:h-14 flex items-center gap-1 sm:gap-2">
                        <ChevronRight className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} style={{ color: 'rgb(var(--muted-foreground))' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="text-xs sm:text-sm font-medium truncate" style={{ color: 'rgb(var(--foreground))' }} title={task.title}>
                              {task.title}
                            </div>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 h-4 sm:h-5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 flex-shrink-0 font-medium">
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
                                      subtask.status === 'completed' ? 'bg-green-400 dark:bg-green-500' :
                                      subtask.status === 'in_progress' ? 'bg-blue-400 dark:bg-blue-500' :
                                      subtask.status === 'blocked' ? 'bg-red-400 dark:bg-red-500' :
                                      'bg-gray-400 dark:bg-gray-500'
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
                      className="relative group rounded-r transition-all duration-200"
                      style={{
                        height: `${totalHeight}px`,
                        backgroundColor: index % 2 === 0 ? 'rgba(var(--muted-rgb), 0.3)' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--muted-rgb), 0.5)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'rgba(var(--muted-rgb), 0.3)' : 'transparent'}
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
                                isBlocked ? 'bg-red-200 dark:bg-red-900 border-2 border-red-400 dark:border-red-600' :
                                isCompleted ? 'bg-green-400 dark:bg-green-500' :
                                task.status === 'in_progress' ? 'bg-blue-400 dark:bg-blue-500' :
                                'bg-gray-400 dark:bg-gray-500'
                              } ${
                                !deadlineDate && !isCompleted && !isBlocked ? 'bg-gradient-to-r from-gray-400 dark:from-gray-500 to-gray-400/20 dark:to-gray-500/20' : ''
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
                                        subtaskIsBlocked ? 'bg-red-200 dark:bg-red-900 border-2 border-red-400 dark:border-red-600' :
                                        subtaskIsCompleted ? 'bg-green-400 dark:bg-green-500' :
                                        subtask.status === 'in_progress' ? 'bg-blue-400 dark:bg-blue-500' :
                                        'bg-gray-400 dark:bg-gray-500'
                                      } ${
                                        !subtaskDeadlineDate && !subtaskIsCompleted && !subtaskIsBlocked ? 'bg-gradient-to-r from-gray-400 dark:from-gray-500 to-gray-400/20 dark:to-gray-500/20' : ''
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
