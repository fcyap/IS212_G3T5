"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { Plus } from "lucide-react"

export function KanbanBoard() {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const currentUserId = parseInt(process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 1) // Allow override via env

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, usersRes] = await Promise.all([
          fetch('http://localhost:3001/api/tasks'),
          fetch('http://localhost:3001/api/users')
        ])
        const tasksData = await tasksRes.json()
        const usersData = await usersRes.json()
        if (tasksData.success) setTasks(tasksData.tasks)
        if (usersData.success) setUsers(usersData.users)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter tasks assigned to current user
  const userTasks = tasks.filter(task => task.assigned_to && task.assigned_to.includes(currentUserId))
  const todoTasks = userTasks.filter(task => task.status === 'pending' || !task.status)
  const doingTasks = userTasks.filter(task => task.status === 'in_progress')
  const doneTasks = userTasks.filter(task => task.status === 'completed')

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId)
    return user ? (user.name || 'Unknown') : 'Unknown'
  }

  if (loading) {
    return <div className="flex-1 bg-[#1a1a1d] p-6 flex items-center justify-center text-white">Loading tasks...</div>
  }

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      <div className="grid grid-cols-3 gap-6 h-full">
        {/* To do Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">To do</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">{todoTasks.length}</span>
            </div>
          </div>

          <div className="space-y-3">
            {todoTasks.map((task) => (
              <TaskCard
                key={task.id}
                title={task.title}
                priority="Medium" // Default, or map from task data
                status="On track"
                assignee={{
                  name: task.assigned_to && task.assigned_to.length > 0 ? getUserName(task.assigned_to[0]) : "Unassigned",
                  avatar: "",
                  fallback: task.assigned_to && task.assigned_to.length > 0 ? (getUserName(task.assigned_to[0]).charAt(0) || 'U') : "U",
                  color: "bg-purple-500",
                }}
                dateRange={task.created_at ? new Date(task.created_at).toLocaleDateString() : ""}
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

        {/* Doing Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Doing</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">{doingTasks.length}</span>
            </div>
          </div>

          <div className="space-y-3">
            {doingTasks.map((task) => (
              <TaskCard
                key={task.id}
                title={task.title}
                priority="Medium"
                status="On track"
                assignee={{
                  name: task.assigned_to && task.assigned_to.length > 0 ? getUserName(task.assigned_to[0]) : "Unassigned",
                  avatar: "",
                  fallback: task.assigned_to && task.assigned_to.length > 0 ? (getUserName(task.assigned_to[0]).charAt(0) || 'U') : "U",
                  color: "bg-purple-500",
                }}
                dateRange={task.created_at ? new Date(task.created_at).toLocaleDateString() : ""}
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

        {/* Done Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Done</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">{doneTasks.length}</span>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add section
            </Button>
          </div>

          <div className="space-y-3">
            {doneTasks.map((task) => (
              <TaskCard
                key={task.id}
                title={task.title}
                priority="Medium"
                status="On track"
                assignee={{
                  name: task.assigned_to && task.assigned_to.length > 0 ? getUserName(task.assigned_to[0]) : "Unassigned",
                  avatar: "",
                  fallback: task.assigned_to && task.assigned_to.length > 0 ? (getUserName(task.assigned_to[0]).charAt(0) || 'U') : "U",
                  color: "bg-purple-500",
                }}
                dateRange={task.created_at ? new Date(task.created_at).toLocaleDateString() : ""}
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
    </div>
  )
}
