const supabase = require('../utils/supabase');
const taskFilesRepository = require('../repository/taskFilesRepository');
const crypto = require('crypto');
const path = require('path');

class TaskFilesService {
  constructor() {
    this.BUCKET_NAME = 'task-files';
    this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    this.ALLOWED_MIME_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/csv', // .csv
      'application/csv', // .csv (alternative)
      'image/png',
      'image/jpeg',
    ];
  }

  /**
   * Upload files to Supabase Storage and save references in task_files table
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID uploading files
   * @param {Array} files - Array of file objects from multer
   * @returns {Promise<Array>} Array of uploaded file records
   */
  async uploadFiles(taskId, userId, files) {
    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    // Validate task exists
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      throw new Error('Task not found');
    }

    const uploadedFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        // Validate file
        this._validateFile(file);

        // Generate unique filename
        const uniqueFilename = this._generateUniqueFilename(file.originalname);
        const filePath = `tasks/${taskId}/${uniqueFilename}`;

        // Upload to Supabase Storage with explicit options
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(this.BUCKET_NAME)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
            duplex: 'half'
          });

        if (uploadError) {
          // Sanitize user-controlled values to prevent log injection and format string attacks
          const sanitize = (str) => String(str || '').replace(/[\n\r%]/g, '');
          const sanitizedFilename = sanitize(file.originalname);
          console.error('Upload error for file:', sanitizedFilename, uploadError);
          errors.push(sanitizedFilename + ': ' + uploadError.message);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(filePath);

        if (!urlData || !urlData.publicUrl) {
          errors.push(`${file.originalname}: Failed to get public URL`);
          // Clean up uploaded file
          await supabase.storage.from(this.BUCKET_NAME).remove([filePath]);
          continue;
        }

        // Save to database (store path, filename, and URL)
        const fileRecord = await taskFilesRepository.create(
          taskId,
          userId,
          filePath,
          file.originalname,
          urlData.publicUrl
        );

        uploadedFiles.push({
          id: fileRecord.id,
          filename: file.originalname,
          url: urlData.publicUrl,
          size: file.size,
          mimeType: file.mimetype,
          created_at: fileRecord.created_at,
        });
      } catch (error) {
        errors.push(`${file.originalname}: ${error.message}`);
      }
    }

    if (uploadedFiles.length === 0 && errors.length > 0) {
      throw new Error(`Failed to upload files: ${errors.join(', ')}`);
    }

    return {
      uploaded: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get all files for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Array of file records
   */
  async getTaskFiles(taskId) {
    const files = await taskFilesRepository.getByTaskId(taskId);
    
    return files.map(file => ({
      id: file.id,
      taskId: file.task_id,
      userId: file.user_id,
      url: file.file_url,
      filename: file.file_name,
      createdAt: file.created_at,
    }));
  }

  /**
   * Delete a file
   * @param {number} fileId - File ID
   * @param {number} userId - User ID requesting deletion
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteFile(fileId, userId) {
    const file = await taskFilesRepository.getById(fileId);

    if (!file) {
      throw new Error('File not found');
    }

    // Check if user has permission (file owner or task assignee)
    if (file.user_id !== userId) {
      const { data: task } = await supabase
        .from('tasks')
        .select('assigned_to, creator_id')
        .eq('id', file.task_id)
        .single();

      const isAssigned = task?.assigned_to?.includes(userId);
      const isCreator = task?.creator_id === userId;

      if (!isAssigned && !isCreator) {
        throw new Error('Permission denied: You can only delete your own files or files from tasks assigned to you');
      }
    }

    // Delete from Supabase Storage using file_path
    if (file.file_path) {
      const { error: storageError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([file.file_path]);

      if (storageError) {
        console.error('Failed to delete from storage:', storageError);
        // Continue to delete DB record even if storage deletion fails
      }
    }

    // Delete from database
    await taskFilesRepository.deleteById(fileId);

    return true;
  }

  /**
   * Delete all files for a task (used when deleting a task)
   * @param {number} taskId - Task ID
   * @returns {Promise<number>} Number of files deleted
   */
  async deleteTaskFiles(taskId) {
    const files = await taskFilesRepository.getByTaskId(taskId);

    // Delete from storage using file_path
    const filePaths = files
      .map(file => file.file_path)
      .filter(path => path);

    if (filePaths.length > 0) {
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove(filePaths);

      if (error) {
        console.error('Failed to delete some files from storage:', error);
      }
    }

    // Delete from database
    const deletedCount = await taskFilesRepository.deleteByTaskId(taskId);

    return deletedCount;
  }

  /**
   * Copy files from one task to another (for recurring tasks)
   * @param {number} sourceTaskId - Source task ID
   * @param {number} targetTaskId - Target task ID
   * @param {number} userId - User ID performing the copy
   * @returns {Promise<Array>} Array of copied file records
   */
  async copyTaskFiles(sourceTaskId, targetTaskId, userId) {
    const sourceFiles = await taskFilesRepository.getByTaskId(sourceTaskId);

    if (sourceFiles.length === 0) {
      return [];
    }

    const copiedFiles = [];

    for (const sourceFile of sourceFiles) {
      try {
        const sourcePath = sourceFile.file_path;
        if (!sourcePath) continue;

        // Generate new path for target task
        const filename = path.basename(sourcePath);
        const targetPath = `tasks/${targetTaskId}/${filename}`;

        // Copy file in storage
        const { data: copyData, error: copyError } = await supabase.storage
          .from(this.BUCKET_NAME)
          .copy(sourcePath, targetPath);

        if (copyError) {
          console.error(`Failed to copy file ${filename}:`, copyError);
          continue;
        }

        // Get public URL for the copied file
        const { data: urlData } = supabase.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(targetPath);

        // Create new record with file_path, file_name, and file_url
        const fileRecord = await taskFilesRepository.create(
          targetTaskId,
          userId,
          targetPath,
          sourceFile.file_name,
          urlData.publicUrl
        );

        copiedFiles.push(fileRecord);
      } catch (error) {
        console.error('Error copying file:', error);
      }
    }

    return copiedFiles;
  }

  /**
   * Validate file
   * @private
   */
  _validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File ${file.originalname} exceeds maximum size of 50MB`);
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(
        `File ${file.originalname} has invalid type. Only PDF, DOCX, XLSX, CSV, PNG, and JPG are allowed`
      );
    }
  }

  /**
   * Generate unique filename
   * @private
   */
  _generateUniqueFilename(originalName) {
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${sanitizedName}_${timestamp}_${randomString}${ext}`;
  }

  /**
   * Extract filename from URL
   * @private
   */
  _extractFilename(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return path.basename(pathname);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract storage path from public URL
   * @private
   */
  _extractStoragePath(url) {
    try {
      // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.indexOf('public') + 1;
      
      if (bucketIndex > 0 && pathParts[bucketIndex] === this.BUCKET_NAME) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

module.exports = new TaskFilesService();
