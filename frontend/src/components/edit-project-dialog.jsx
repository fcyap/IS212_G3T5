"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjects } from "@/contexts/project-context"

export function EditProjectDialog({ project, isOpen, onClose }) {
  const { updateProject } = useProjects()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    deadline: ""
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ""
      })
    }
  }, [project])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!project) return

    setIsLoading(true)
    try {
      await updateProject(project.id, {
        name: formData.name,
        description: formData.description,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null
      })
      onClose()
    } catch (error) {
      console.error("Failed to update project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#1f1f23] border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Project Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-300">
              Project Name
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-gray-300">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="bg-gray-700 border-gray-600 text-white min-h-[100px]"
              placeholder="Enter project description..."
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="deadline" className="text-sm font-medium text-gray-300">
              Deadline
            </label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => handleChange("deadline", e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
