const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController.js');
// RBAC middleware now uses Supabase directly
const {
  requireTaskCreation,
  requireTaskModification
} = require('../middleware/rbac');

// Import authentication middleware
const { authMiddleware } = require('../middleware/auth');

// Debug middleware: log every request to /tasks
router.use((req, res, next) => {
	// Sanitize URL to prevent log injection
	const sanitizedUrl = req.originalUrl.replace(/[\n\r]/g, '');
	console.log(`[tasks.js] Route hit:`, req.method, sanitizedUrl);
	next();
});

router.get('/', authMiddleware(), taskController.list);
router.get('/:id', authMiddleware(), taskController.getTaskById);
router.post('/', authMiddleware(), requireTaskCreation(), taskController.create);
router.put('/:id', authMiddleware(), requireTaskModification(), taskController.update);

// Subtasks route - must come before /:id to avoid conflicts
router.get('/:taskId/subtasks', authMiddleware(), taskController.getSubtasks);

// Original routes for project-specific functionality
router.get('/project/:projectId', authMiddleware(), taskController.getTasksByProject || taskController.list);

module.exports = router;
