const taskAttachmentService = require('../services/taskAttachmentService');

/**
 * Task Attachment Controller - Handles HTTP requests and responses for task attachments
 * This layer only deals with request validation and response formatting
 */

/**
 * Upload attachments to a task
 */
const uploadAttachments = async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const files = req.files;
    const userId = req.user?.id || res.locals.session?.user_id;

    // Validate taskId
    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    // Validate files
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Validate user
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const result = await taskAttachmentService.uploadAttachments(taskId, files, userId);

    res.status(201).json(result);
  } catch (error) {
    console.error('[POST /tasks/:taskId/attachments]', error);
    res.status(error.status || 500).json({ 
      error: error.message || 'Server error' 
    });
  }
};

/**
 * Get all attachments for a task
 */
const getAttachments = async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const result = await taskAttachmentService.getAttachments(taskId);

    res.json(result);
  } catch (error) {
    console.error('[GET /tasks/:taskId/attachments]', error);
    res.status(error.status || 500).json({ 
      error: error.message || 'Server error' 
    });
  }
};

/**
 * Delete an attachment
 */
const deleteAttachment = async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const attachmentId = parseInt(req.params.attachmentId);
    const userId = req.user?.id || res.locals.session?.user_id;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    if (!attachmentId || isNaN(attachmentId)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const result = await taskAttachmentService.deleteAttachment(taskId, attachmentId, userId);

    res.json(result);
  } catch (error) {
    console.error('[DELETE /tasks/:taskId/attachments/:attachmentId]', error);
    res.status(error.status || 500).json({ 
      error: error.message || 'Server error' 
    });
  }
};

/**
 * Download an attachment
 */
const downloadAttachment = async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const attachmentId = parseInt(req.params.attachmentId);

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    if (!attachmentId || isNaN(attachmentId)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    const file = await taskAttachmentService.downloadAttachment(taskId, attachmentId);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`
    });

    res.send(file.buffer);
  } catch (error) {
    console.error('[GET /tasks/:taskId/attachments/:attachmentId/download]', error);
    res.status(error.status || 500).json({ 
      error: error.message || 'Server error' 
    });
  }
};

module.exports = {
  uploadAttachments,
  getAttachments,
  deleteAttachment,
  downloadAttachment
};
