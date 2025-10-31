/**
 * Example Component: Task File Upload
 * 
 * This component demonstrates how to use the useTaskFileUpload hook
 * to upload files to Supabase and display them
 */

'use client';

import { useState, useEffect } from 'react';
import { useTaskFileUpload } from '@/hooks/useTaskFileUpload';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export function TaskFileUploadExample({ taskId }) {
  const { user } = useAuth();
  const { uploadFiles, fetchFiles, deleteFile, uploading, error, clearError } = useTaskFileUpload();
  
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load existing files when component mounts
  useEffect(() => {
    loadFiles();
  }, [taskId]);

  const loadFiles = async () => {
    setLoading(true);
    const result = await fetchFiles(taskId);
    if (result.success) {
      setFiles(result.data);
    } else {
      toast.error(`Failed to load files: ${result.error}`);
    }
    setLoading(false);
  };

  const handleFileSelect = (event) => {
    const newFiles = Array.from(event.target.files);
    setSelectedFiles(newFiles);
    clearError();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in to upload files');
      return;
    }

    const result = await uploadFiles(taskId, selectedFiles, user.id);

    if (result.success) {
      toast.success(
        `${result.uploaded.length} file(s) uploaded successfully!`
      );
      
      if (result.errors.length > 0) {
        toast.error(
          `${result.errors.length} file(s) failed to upload`
        );
      }

      // Clear selection and reload files
      setSelectedFiles([]);
      document.getElementById('file-input').value = '';
      loadFiles();
    } else {
      toast.error('Upload failed');
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    const result = await deleteFile(fileId, user.id);

    if (result.success) {
      toast.success('File deleted successfully');
      loadFiles();
    } else {
      toast.error(`Failed to delete file: ${result.error}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Task Files</h3>

      {/* Upload Section */}
      <div className="border-2 border-dashed border-gray-700 rounded-lg p-4">
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="mb-3 w-full text-sm text-gray-400"
          disabled={uploading}
        />
        
        {selectedFiles.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-gray-400 mb-2">
              Selected {selectedFiles.length} file(s):
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              {selectedFiles.map((file, index) => (
                <li key={index}>
                  {file.name} ({formatFileSize(file.size)})
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/50 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Files'}
        </Button>
      </div>

      {/* Files List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-400">
          Uploaded Files ({files.length})
        </h4>
        
        {loading ? (
          <p className="text-sm text-gray-500">Loading files...</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-500">No files uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-800/50 rounded p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">
                    {file.file_name}
                  </p>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>•</span>
                    <span>
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Download
                  </a>
                  
                  {user?.id === file.user_id && (
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Usage in your task detail page:
 * 
 * import { TaskFileUploadExample } from '@/components/TaskFileUploadExample';
 * 
 * function TaskDetailsPage({ taskId }) {
 *   return (
 *     <div>
 *       <h1>Task Details</h1>
 *       <TaskFileUploadExample taskId={taskId} />
 *     </div>
 *   );
 * }
 */
