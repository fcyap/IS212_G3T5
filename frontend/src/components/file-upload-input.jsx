"use client"

import { useState, useRef } from 'react'
import { Paperclip, X, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function FileUploadInput({ onFilesChange, disabled = false }) {
  const [attachments, setAttachments] = useState([])
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    
    const validFiles = files.filter(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG allowed.`)
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large. Maximum size is 50MB.`)
        return false
      }
      return true
    })

    if (validFiles.length > 0) {
      const newAttachments = [...attachments, ...validFiles]
      setAttachments(newAttachments)
      onFilesChange?.(newAttachments)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index) => {
    const newAttachments = attachments.filter((_, i) => i !== index)
    setAttachments(newAttachments)
    onFilesChange?.(newAttachments)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
        >
          <Paperclip className="w-4 h-4 mr-1" />
          Add Files
        </Button>
        <span className="text-xs text-gray-400">
          PDF, DOCX, XLSX, PNG, JPG (max 50MB each)
        </span>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded-md bg-gray-800 text-sm"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 truncate">{file.name}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="text-gray-400 hover:text-red-400 p-1 disabled:opacity-50"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
