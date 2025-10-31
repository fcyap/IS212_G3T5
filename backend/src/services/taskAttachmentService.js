const taskAttachmentRepository = require('../repository/taskAttachmentRepository');
const taskRepository = require('../repository/taskRepository');
const supabase = require('../utils/supabase');
const crypto = require('crypto');

/**
 * Task Attachment Service - Contains business logic for task attachment operations
 * This layer orchestrates data from repositories and applies business rules
 */

// Maximum total file size per task (50MB in bytes)
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed file types with their MIME types
const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg']
};

class TaskAttachmentService {
  /**
   * Validate file format
   * @param {string} mimeType - The file MIME type
   * @returns {boolean} True if valid
   */
  _isValidFileType(mimeType) {
    return Object.keys(ALLOWED_FILE_TYPES).includes(mimeType);
  }

  /**
   * Validate file size limits
   * @param {Array} files - Array of file objects
   * @param {number} currentTotalSize - Current total size of attachments
   * @throws {Error} If size limit exceeded
   */
  _validateSizeLimit(files, currentTotalSize) {
    const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSize = currentTotalSize + newFilesSize;

    if (totalSize > MAX_TOTAL_SIZE) {
      const error = new Error('Total file size cannot exceed 50MB');
      error.status = 413;
      error.currentSize = currentTotalSize;
      error.attemptedSize = totalSize;
      throw error;
    }
  }

  /**
   * Generate a unique file name to prevent collisions
   * @param {string} originalName - Original file name
   * @returns {string} Unique file name
   */
  _generateUniqueFileName(originalName) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    return `${baseName}_${timestamp}_${randomString}${extension}`;
  }

  /**
   * Upload files to storage
   * @param {number} taskId - The task ID
   * @param {Object} file - File object from multer
   * @returns {Promise<string>} The file URL
   */
  async _uploadToStorage(taskId, file) {
    const uniqueFileName = this._generateUniqueFileName(file.originalname);
    const filePath = `attachments/${taskId}/${uniqueFileName}`;

    const { data, error } = await supabase.storage
      .from('task-attachments')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('task-attachments')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  /**
   * Delete file from storage
   * @param {string} fileUrl - The file URL
   */
  async _deleteFromStorage(fileUrl) {
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/task-attachments/');
      if (urlParts.length < 2) {
        console.warn('Invalid file URL format:', fileUrl);
        return;
      }
      
      const filePath = urlParts[1];

      const { error } = await supabase.storage
        .from('task-attachments')
        .remove([filePath]);

      if (error) {
        throw new Error(`Storage deletion failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting from storage:', error);
      throw error;
    }
  }

  /**
   * Copy file in storage
   * @param {string} sourceUrl - Source file URL
   * @param {number} destinationTaskId - Destination task ID
   * @returns {Promise<string>} New file URL
   */
  async _copyInStorage(sourceUrl, destinationTaskId) {
    try {
      // Extract source file path
      const urlParts = sourceUrl.split('/task-attachments/');
      if (urlParts.length < 2) {
        throw new Error('Invalid source file URL');
      }
      
      const sourcePath = urlParts[1];
      const fileName = sourcePath.split('/').pop();
      const uniqueFileName = this._generateUniqueFileName(fileName);
      const destinationPath = `attachments/${destinationTaskId}/${uniqueFileName}`;

      // Download the source file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('task-attachments')
        .download(sourcePath);

      if (downloadError) {
        throw new Error(`Failed to download source file: ${downloadError.message}`);
      }

      // Upload to new location
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(destinationPath, fileData, {
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload copied file: ${uploadError.message}`);
      }

      // Get public URL for the new file
      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(destinationPath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error copying file in storage:', error);
      throw error;
    }
  }

  /**
   * Upload attachments for a task
   * @param {number} taskId - The task ID
   * @param {Array} files - Array of file objects from multer
   * @param {number} userId - The user ID uploading the files
   * @returns {Promise<Object>} Object with attachments array and totalSize
   */
  async uploadAttachments(taskId, files, userId) {
    try {
      // Validate task exists
      const task = await taskRepository.getById(taskId);
      if (!task) {
        const error = new Error('Task not found');
        error.status = 404;
        throw error;
      }

      // Validate file types
      for (const file of files) {
        if (!this._isValidFileType(file.mimetype)) {
          const error = new Error('Invalid file format. Allowed formats: PDF, DOCX, XLSX, PNG, JPG');
          error.status = 400;
          throw error;
        }
      }

      // Check current total size and validate new files won't exceed limit
      const currentTotalSize = await taskAttachmentRepository.getTotalSize(taskId);
      this._validateSizeLimit(files, currentTotalSize);

      // Upload files and create attachment records
      const attachments = [];
      let totalSize = 0;

      for (const file of files) {
        try {
          // Upload to storage
          const fileUrl = await this._uploadToStorage(taskId, file);

          // Create database record
          const attachmentData = {
            task_id: taskId,
            file_name: file.originalname,
            file_type: file.mimetype,
            file_size: file.size,
            file_url: fileUrl,
            uploaded_by: userId
          };

          const attachment = await taskAttachmentRepository.create(attachmentData);
          attachments.push(attachment);
          totalSize += file.size;
        } catch (uploadError) {
          // If upload fails for one file, clean up already uploaded files
          console.error('Error uploading file:', uploadError);
          
          // Clean up previously uploaded files
          for (const uploadedAttachment of attachments) {
            try {
              await this._deleteFromStorage(uploadedAttachment.file_url);
              await taskAttachmentRepository.deleteById(uploadedAttachment.id);
            } catch (cleanupError) {
              console.error('Error cleaning up after failed upload:', cleanupError);
            }
          }
          
          throw uploadError;
        }
      }

      return {
        attachments,
        totalSize
      };
    } catch (error) {
      console.error('Error in uploadAttachments:', error);
      throw error;
    }
  }

  /**
   * Get all attachments for a task
   * @param {number} taskId - The task ID
   * @returns {Promise<Object>} Object with attachments array and totalSize
   */
  async getAttachments(taskId) {
    try {
      const attachments = await taskAttachmentRepository.getByTaskId(taskId);
      const totalSize = attachments.reduce((sum, att) => sum + (att.file_size || 0), 0);

      return {
        attachments,
        totalSize
      };
    } catch (error) {
      console.error('Error in getAttachments:', error);
      throw error;
    }
  }

  /**
   * Delete an attachment
   * @param {number} taskId - The task ID
   * @param {number} attachmentId - The attachment ID
   * @param {number} userId - The user ID requesting deletion
   * @returns {Promise<Object>} Success message
   */
  async deleteAttachment(taskId, attachmentId, userId) {
    try {
      // Get attachment
      const attachment = await taskAttachmentRepository.getById(attachmentId);
      
      if (!attachment) {
        const error = new Error('Attachment not found');
        error.status = 404;
        throw error;
      }

      // Check if user is authorized to delete (must be the uploader)
      if (attachment.uploaded_by !== userId) {
        const error = new Error('Unauthorized to delete this attachment');
        error.status = 403;
        throw error;
      }

      // Delete from storage
      await this._deleteFromStorage(attachment.file_url);

      // Delete from database
      await taskAttachmentRepository.deleteById(attachmentId);

      return {
        message: 'Attachment deleted successfully'
      };
    } catch (error) {
      console.error('Error in deleteAttachment:', error);
      throw error;
    }
  }

  /**
   * Delete all attachments for a task
   * @param {number} taskId - The task ID
   * @returns {Promise<boolean>} True if successful
   */
  async deleteByTaskId(taskId) {
    try {
      // Get all attachments
      const attachments = await taskAttachmentRepository.getByTaskId(taskId);

      // Delete from storage
      for (const attachment of attachments) {
        try {
          await this._deleteFromStorage(attachment.file_url);
        } catch (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // Continue with other deletions
        }
      }

      // Delete from database
      await taskAttachmentRepository.deleteByTaskId(taskId);

      return true;
    } catch (error) {
      console.error('Error in deleteByTaskId:', error);
      throw error;
    }
  }

  /**
   * Copy attachments from one task to another (for recurring tasks)
   * @param {number} sourceTaskId - Source task ID
   * @param {number} destinationTaskId - Destination task ID
   * @param {number} userId - User ID performing the copy
   * @returns {Promise<Object>} Object with copied attachments and totalSize
   */
  async copyAttachmentsToTask(sourceTaskId, destinationTaskId, userId) {
    try {
      // Get source attachments
      const sourceAttachments = await taskAttachmentRepository.getByTaskId(sourceTaskId);

      if (sourceAttachments.length === 0) {
        return {
          attachments: [],
          totalSize: 0
        };
      }

      // Calculate total size
      const totalSize = sourceAttachments.reduce((sum, att) => sum + (att.file_size || 0), 0);

      // Check if destination task can accommodate these attachments
      const currentDestinationSize = await taskAttachmentRepository.getTotalSize(destinationTaskId);
      
      if (currentDestinationSize + totalSize > MAX_TOTAL_SIZE) {
        const error = new Error('Total file size cannot exceed 50MB');
        error.status = 413;
        throw error;
      }

      // Copy each attachment
      const copiedAttachments = [];

      for (const sourceAttachment of sourceAttachments) {
        try {
          // Copy file in storage
          const newFileUrl = await this._copyInStorage(sourceAttachment.file_url, destinationTaskId);

          // Create new database record
          const newAttachmentData = {
            task_id: destinationTaskId,
            file_name: sourceAttachment.file_name,
            file_type: sourceAttachment.file_type,
            file_size: sourceAttachment.file_size,
            file_url: newFileUrl,
            uploaded_by: userId
          };

          const newAttachment = await taskAttachmentRepository.create(newAttachmentData);
          copiedAttachments.push(newAttachment);
        } catch (copyError) {
          console.error('Error copying attachment:', copyError);
          // Continue with other attachments
        }
      }

      return {
        attachments: copiedAttachments,
        totalSize
      };
    } catch (error) {
      console.error('Error in copyAttachmentsToTask:', error);
      throw error;
    }
  }

  /**
   * Download an attachment
   * @param {number} taskId - The task ID
   * @param {number} attachmentId - The attachment ID
   * @returns {Promise<Object>} Object with buffer, fileName, and mimeType
   */
  async downloadAttachment(taskId, attachmentId) {
    try {
      // Get attachment
      const attachment = await taskAttachmentRepository.getById(attachmentId);
      
      if (!attachment) {
        const error = new Error('Attachment not found');
        error.status = 404;
        throw error;
      }

      // Extract file path from URL
      const urlParts = attachment.file_url.split('/task-attachments/');
      if (urlParts.length < 2) {
        throw new Error('Invalid file URL');
      }
      
      const filePath = urlParts[1];

      // Download from storage
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(filePath);

      if (error) {
        const downloadError = new Error('File not found in storage');
        downloadError.status = 404;
        throw downloadError;
      }

      return {
        buffer: data,
        fileName: attachment.file_name,
        mimeType: attachment.file_type
      };
    } catch (error) {
      console.error('Error in downloadAttachment:', error);
      throw error;
    }
  }
}

module.exports = new TaskAttachmentService();
