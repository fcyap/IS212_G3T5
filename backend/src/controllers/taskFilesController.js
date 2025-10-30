const taskFilesService = require('../services/taskFilesService');

class TaskFilesController {
  /**
   * Upload files for a task
   * POST /api/tasks/:taskId/files
   */
  async uploadFiles(req, res) {
    try {
      const taskId = parseInt(req.params.taskId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      const result = await taskFilesService.uploadFiles(taskId, userId, req.files);

      res.status(201).json({
        success: true,
        message: 'Files uploaded successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload files',
      });
    }
  }

  /**
   * Get all files for a task
   * GET /api/tasks/:taskId/files
   */
  async getTaskFiles(req, res) {
    try {
      const taskId = parseInt(req.params.taskId);
      console.log('📎 Getting files for task:', taskId);

      const files = await taskFilesService.getTaskFiles(taskId);
      console.log('📎 Files found:', files.length, files);

      res.status(200).json({
        success: true,
        data: files,
      });
    } catch (error) {
      console.error('Error fetching task files:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch task files',
      });
    }
  }

  /**
   * Delete a file
   * DELETE /api/tasks/files/:fileId
   */
  async deleteFile(req, res) {
    try {
      const fileId = parseInt(req.params.fileId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      await taskFilesService.deleteFile(fileId, userId);

      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      
      if (error.message.includes('Permission denied')) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete file',
      });
    }
  }
}

module.exports = new TaskFilesController();
