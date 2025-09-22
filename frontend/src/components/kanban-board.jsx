"use client"

import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { CreateProjectDialog } from "./create-project"
import { useProjects } from "@/contexts/project-context"
import { Plus } from "lucide-react"
import { useEffect } from "react"

export function KanbanBoard() {
  const {
    projects,
    loading,
    error,
    selectedProject,
    selectProject,
    projectTasks,
    tasksLoading,
    loadProjectTasks
  } = useProjects()

  // Load tasks when a project is selected
  useEffect(() => {
    if (selectedProject?.id) {
      loadProjectTasks(selectedProject.id)
    }
  }, [selectedProject?.id, loadProjectTasks])

  // Filter tasks by status
  const getTasksByStatus = (status) => {
    return (projectTasks || []).filter(task => task.status === status)
  }

  const pendingTasks = getTasksByStatus('pending')
  const inProgressTasks = getTasksByStatus('in_progress')
  const completedTasks = getTasksByStatus('completed')

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      {selectedProject ? (
        // Project-specific Kanban Board
        <div>
          <div className="mb-6">
            <h2 className="text-white text-lg font-semibold mb-2">{selectedProject.name}</h2>
            <p className="text-gray-400 text-sm">{selectedProject.description || "No description provided"}</p>
          </div>
          
          {tasksLoading && (
            <div className="text-gray-400 text-center py-4 mb-6">Loading tasks...</div>
          )}

          <div className="grid grid-cols-3 gap-6 h-full">
            {/* To do Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-medium">To do</h2>
                  <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">{pendingTasks.length}</span>
                </div>
              </div>

              {pendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  priority={task.priority || 'medium'}
                  status="On track"
                  assignee={{
                    name: task.assigned_to && task.assigned_to.length > 0 ? `User ${task.assigned_to[0]}` : "Unassigned",
                    avatar: "",
                    fallback: task.assigned_to && task.assigned_to.length > 0 ? task.assigned_to[0].toString().charAt(0) : "U",
                    color: "bg-blue-500",
                  }}
                  dateRange={task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
                />
              ))}

              <Button
                variant="ghost"
                className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add task
              </Button>
            </div>

            {/* Doing Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-medium">Doing</h2>
                  <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">{inProgressTasks.length}</span>
                </div>
              </div>

              {inProgressTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  priority={task.priority || 'medium'}
                  status="In progress"
                  assignee={{
                    name: task.assigned_to && task.assigned_to.length > 0 ? `User ${task.assigned_to[0]}` : "Unassigned",
                    avatar: "",
                    fallback: task.assigned_to && task.assigned_to.length > 0 ? task.assigned_to[0].toString().charAt(0) : "U",
                    color: "bg-orange-500",
                  }}
                  dateRange={task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
                />
              ))}

              <Button
                variant="ghost"
                className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add task
              </Button>
            </div>

            {/* Done Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-medium">Done</h2>
                  <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">{completedTasks.length}</span>
                </div>
              </div>

              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  priority={task.priority || 'medium'}
                  status="Completed"
                  assignee={{
                    name: task.assigned_to && task.assigned_to.length > 0 ? `User ${task.assigned_to[0]}` : "Unassigned",
                    avatar: "",
                    fallback: task.assigned_to && task.assigned_to.length > 0 ? task.assigned_to[0].toString().charAt(0) : "U",
                    color: "bg-green-500",
                  }}
                  dateRange={task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
                />
              ))}

              <Button
                variant="ghost"
                className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add task
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Projects Overview Section
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">Projects Overview</h2>
            <CreateProjectDialog>
              <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </CreateProjectDialog>
          </div>
          
          {loading && (
            <div className="text-gray-400 text-center py-4">Loading projects...</div>
          )}
          
          {error && (
            <div className="text-red-400 text-center py-4">Error: {error}</div>
          )}
          
          {!loading && projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {projects.map((project) => (
                <div key={project.id} className="bg-[#1f1f23] rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors" onClick={() => selectProject(project.id)}>
                  <h3 className="text-white font-medium mb-2">{project.name}</h3>
                  <p className="text-gray-400 text-sm mb-3">{project.description || "No description provided"}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      ID: {project.id} • {project.user_ids?.length || 0} members
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <div className="mb-4">No projects found</div>
              <CreateProjectDialog>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first project
                </Button>
              </CreateProjectDialog>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
