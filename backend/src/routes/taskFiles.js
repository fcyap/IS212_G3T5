const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const taskFilesController = require('../controllers/taskFilesController');
const { authMiddleware } = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10, // Max 10 files per request
  },
});

// Use authMiddleware for authentication
const requireAuth = authMiddleware();

// Routes
router.post('/', requireAuth, upload.array('files', 10), taskFilesController.uploadFiles);
router.get('/', requireAuth, taskFilesController.getTaskFiles);

module.exports = router;
