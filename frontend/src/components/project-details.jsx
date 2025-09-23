"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ArrowLeft, Plus, Search, X } from "lucide-react"

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

  const currentUserId = parseInt(process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 1) // Allow override via env

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
          const currentUserMember = membersData.members.find(m => m.user_id === currentUserId)
          const isCurrentUserCreator = currentUserMember?.role === 'creator'
          const isCurrentUserProjectManager = currentUserMember?.role === 'manager'
          console.log('Current user member:', currentUserMember, 'is creator:', isCurrentUserCreator, 'is project manager:', isCurrentUserProjectManager)
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
  }, [projectId])

  const filteredUsers = (allUsers || []).filter(user => {
    const isAlreadyMember = (members || []).some(member => member.user_id === user.id);
    console.log(`User ${user.id} (${user.name}) - Already member: ${isAlreadyMember}`);
    return !isAlreadyMember;
  });

  console.log('All users:', allUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));
  console.log('Project members:', members.map(m => ({ user_id: m.user_id, name: m.name, email: m.email, role: m.role })));
  console.log('Filtered users available to add:', filteredUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));

  const handleAddMember = async (userId) => {
    try {
      console.log(`Adding user ${userId} to project ${projectId} as collaborator`);
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove member from local state using new structure
        setMembers(members.filter(member => member.user_id !== userId))
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

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
          <h2 className="text-lg font-semibold text-white mb-4">Project Tasks</h2>
          {(tasks || []).length === 0 ? (
            <p className="text-gray-400">No tasks found for this project.</p>
          ) : (
            <div className="space-y-3">
              {(tasks || []).map((task) => {
                const assigneeNames = task.assigned_to?.map(userId => {
                  const user = (allUsers || []).find(u => u.id === userId)
                  return user ? (user.name || user.email) : 'Unknown User'
                }).join(', ') || 'Unassigned'

                return (
                  <div key={task.id} className="p-4 bg-[#1f1f23] rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">{task.title}</h3>
                        <p className="text-gray-300 text-sm mb-2">{task.description || 'No description'}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>Status: <span className="text-blue-400">{task.status}</span></span>
                          <span>Assigned to: <span className="text-blue-400">{assigneeNames}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}