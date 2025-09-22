"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useProjects } from "@/contexts/project-context"
import { Plus } from "lucide-react"
import toast from "react-hot-toast"

export function CreateProjectDialog({ children, variant = "default" }) {
  const currentUserId = parseInt(process.env.NEXT_PUBLIC_USER_ID || '1')
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    project_name: "",
    description: "",
    user_ids: [currentUserId], // Include current user
    creator_id: currentUserId // Add creator ID
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { createProject, error } = useProjects()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.project_name.trim()) return

    setIsSubmitting(true)
    try {
      await createProject(formData)
      setFormData({
        project_name: "",
        description: "",
        user_ids: [currentUserId],
        creator_id: currentUserId
      })
      setIsOpen(false)
      toast.success("Project created successfully!")
    } catch (error) {
      console.error("Failed to create project:", error)
      toast.error("Failed to create project. Please try again.")
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant={variant} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#1f1f23] border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project_name" className="block text-sm font-medium mb-2">
              Project Name
            </label>
            <Input
              id="project_name"
              name="project_name"
              value={formData.project_name}
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
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter project description..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">
              Error: {error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.project_name.trim()}
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
