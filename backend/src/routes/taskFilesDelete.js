const express = require('express');
const router = express.Router();
const taskFilesController = require('../controllers/taskFilesController');
const { authMiddleware } = require('../middleware/auth');

const requireAuth = authMiddleware();

// Delete a specific file
router.delete('/:fileId', requireAuth, taskFilesController.deleteFile);

module.exports = router;
