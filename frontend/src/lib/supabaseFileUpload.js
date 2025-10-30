/**
 * Supabase File Upload Helper
 * 
 * This helper provides functions to upload files to Supabase Storage
 * and save metadata to the task_files table
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (you can also pass this as a parameter)
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Upload a file to Supabase Storage and save metadata to database
 * 
 * @param {number} taskId - The task ID this file belongs to
 * @param {File} file - The File object to upload
 * @param {number} userId - The ID of the user uploading the file
 * @param {Object} supabaseClient - Optional Supabase client instance
 * @returns {Promise<Object>} Result object with success status and data/error
 */
export async function uploadTaskFile(taskId, file, userId, supabaseClient = null) {
  try {
    const supabase = supabaseClient || getSupabaseClient();
    
    // Validate inputs
    if (!taskId || !file || !userId) {
      return {
        success: false,
        error: 'Missing required parameters: taskId, file, or userId',
      };
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG are allowed.',
      };
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File size exceeds 50MB limit.',
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileExt = file.name.split('.').pop();
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Sanitize
      .substring(0, 50); // Limit length
    
    const uniqueFilename = `${sanitizedName}_${timestamp}_${randomString}.${fileExt}`;
    const filePath = `tasks/${taskId}/${uniqueFilename}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('task-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return {
        success: false,
        error: `Failed to upload file: ${uploadError.message}`,
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('task-files')
      .getPublicUrl(filePath);

    if (!urlData || !urlData.publicUrl) {
      // Clean up uploaded file
      await supabase.storage.from('task-files').remove([filePath]);
      return {
        success: false,
        error: 'Failed to get public URL for uploaded file',
      };
    }

    // Save metadata to task_files table
    const { data: fileRecord, error: dbError } = await supabase
      .from('task_files')
      .insert({
        task_id: taskId,
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_size: file.size,
        file_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('task-files').remove([filePath]);
      return {
        success: false,
        error: `Failed to save file metadata: ${dbError.message}`,
      };
    }

    return {
      success: true,
      data: {
        id: fileRecord.id,
        taskId: fileRecord.task_id,
        userId: fileRecord.user_id,
        fileName: fileRecord.file_name,
        filePath: fileRecord.file_path,
        fileUrl: fileRecord.file_url,
        fileSize: fileRecord.file_size,
        fileType: fileRecord.file_type,
        createdAt: fileRecord.created_at,
      },
    };
  } catch (error) {
    console.error('Unexpected error in uploadTaskFile:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Upload multiple files to Supabase Storage
 * 
 * @param {number} taskId - The task ID
 * @param {File[]} files - Array of File objects
 * @param {number} userId - The ID of the user uploading
 * @param {Object} supabaseClient - Optional Supabase client instance
 * @returns {Promise<Object>} Result with uploaded files and any errors
 */
export async function uploadMultipleTaskFiles(taskId, files, userId, supabaseClient = null) {
  const results = {
    success: true,
    uploaded: [],
    errors: [],
  };

  for (const file of files) {
    const result = await uploadTaskFile(taskId, file, userId, supabaseClient);
    
    if (result.success) {
      results.uploaded.push(result.data);
    } else {
      results.errors.push({
        fileName: file.name,
        error: result.error,
      });
    }
  }

  // Overall success if at least one file uploaded
  results.success = results.uploaded.length > 0;

  return results;
}

/**
 * Get all files for a task
 * 
 * @param {number} taskId - The task ID
 * @param {Object} supabaseClient - Optional Supabase client instance
 * @returns {Promise<Object>} Result with files array
 */
export async function getTaskFiles(taskId, supabaseClient = null) {
  try {
    const supabase = supabaseClient || getSupabaseClient();

    const { data, error } = await supabase
      .from('task_files')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete a file from storage and database
 * 
 * @param {number} fileId - The file ID
 * @param {number} userId - The user attempting to delete (for permission check)
 * @param {Object} supabaseClient - Optional Supabase client instance
 * @returns {Promise<Object>} Result object
 */
export async function deleteTaskFile(fileId, userId, supabaseClient = null) {
  try {
    const supabase = supabaseClient || getSupabaseClient();

    // Get file record
    const { data: fileRecord, error: fetchError } = await supabase
      .from('task_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fetchError || !fileRecord) {
      return {
        success: false,
        error: 'File not found',
      };
    }

    // Check permission (only file owner can delete)
    if (fileRecord.user_id !== userId) {
      return {
        success: false,
        error: 'Permission denied: You can only delete your own files',
      };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('task-files')
      .remove([fileRecord.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue to delete DB record even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('task_files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      return {
        success: false,
        error: `Failed to delete file record: ${dbError.message}`,
      };
    }

    return {
      success: true,
      message: 'File deleted successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  uploadTaskFile,
  uploadMultipleTaskFiles,
  getTaskFiles,
  deleteTaskFile,
};
