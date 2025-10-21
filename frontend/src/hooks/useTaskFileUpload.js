/**
 * React Hook for Supabase File Upload
 * 
 * This hook provides an easy-to-use interface for uploading files
 * to Supabase Storage within React components
 */

import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  uploadTaskFile,
  uploadMultipleTaskFiles,
  getTaskFiles,
  deleteTaskFile,
} from '@/lib/supabaseFileUpload';

/**
 * Hook to manage task file uploads with Supabase
 * 
 * @returns {Object} File upload utilities and state
 */
export function useTaskFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  /**
   * Upload a single file
   */
  const uploadFile = useCallback(async (taskId, file, userId) => {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await uploadTaskFile(taskId, file, userId, supabase);
      
      if (result.success) {
        setUploadProgress(100);
        return result;
      } else {
        setError(result.error);
        return result;
      }
    } catch (err) {
      const errorMsg = err.message || 'Upload failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setUploading(false);
    }
  }, [supabase]);

  /**
   * Upload multiple files
   */
  const uploadFiles = useCallback(async (taskId, files, userId) => {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await uploadMultipleTaskFiles(taskId, files, userId, supabase);
      
      if (result.success) {
        setUploadProgress(100);
        if (result.errors.length > 0) {
          setError(`Some files failed: ${result.errors.map(e => e.fileName).join(', ')}`);
        }
        return result;
      } else {
        setError('All files failed to upload');
        return result;
      }
    } catch (err) {
      const errorMsg = err.message || 'Upload failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setUploading(false);
    }
  }, [supabase]);

  /**
   * Fetch files for a task
   */
  const fetchFiles = useCallback(async (taskId) => {
    setError(null);
    const result = await getTaskFiles(taskId, supabase);
    
    if (!result.success) {
      setError(result.error);
    }
    
    return result;
  }, [supabase]);

  /**
   * Delete a file
   */
  const deleteFile = useCallback(async (fileId, userId) => {
    setError(null);
    const result = await deleteTaskFile(fileId, userId, supabase);
    
    if (!result.success) {
      setError(result.error);
    }
    
    return result;
  }, [supabase]);

  /**
   * Reset error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    uploading,
    uploadProgress,
    error,
    
    // Methods
    uploadFile,
    uploadFiles,
    fetchFiles,
    deleteFile,
    clearError,
  };
}

/**
 * Example Usage:
 * 
 * function MyComponent() {
 *   const { uploadFile, uploading, error } = useTaskFileUpload();
 *   
 *   const handleFileUpload = async (event) => {
 *     const file = event.target.files[0];
 *     const result = await uploadFile(taskId, file, userId);
 *     
 *     if (result.success) {
 *       console.log('File uploaded:', result.data);
 *     } else {
 *       console.error('Upload failed:', result.error);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <input type="file" onChange={handleFileUpload} disabled={uploading} />
 *       {uploading && <p>Uploading...</p>}
 *       {error && <p>Error: {error}</p>}
 *     </div>
 *   );
 * }
 */
