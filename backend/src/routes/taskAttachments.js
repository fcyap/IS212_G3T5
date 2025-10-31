const express = require('express');
const multer = require('multer');
const taskAttachmentController = require('../controllers/taskAttachmentController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
const requireAuth = authMiddleware();

// Configure multer for file uploads (memory storage)
const storage = multer.memoryStorage();

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Allowed formats: PDF, DOCX, XLSX, PNG, JPG'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file (server-side safety limit)
    files: 10 // Maximum 10 files at once
  }
});

/**
 * @route   POST /api/tasks/:taskId/attachments
 * @desc    Upload attachments to a task
 * @access  Private
 */
router.post('/', requireAuth, upload.array('files', 10), (req, res, next) => {
  // Handle multer errors
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  taskAttachmentController.uploadAttachments(req, res);
});

/**
 * @route   GET /api/tasks/:taskId/attachments
 * @desc    Get all attachments for a task
 * @access  Private
 */
router.get('/', requireAuth, taskAttachmentController.getAttachments);

/**
 * @route   DELETE /api/tasks/:taskId/attachments/:attachmentId
 * @desc    Delete an attachment
 * @access  Private (only uploader can delete)
 */
router.delete('/:attachmentId', requireAuth, taskAttachmentController.deleteAttachment);

/**
 * @route   GET /api/tasks/:taskId/attachments/:attachmentId/download
 * @desc    Download an attachment
 * @access  Private
 */
router.get('/:attachmentId/download', requireAuth, taskAttachmentController.downloadAttachment);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size too large. Maximum size is 50MB per file.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 10 files at once.' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;
