const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController.js');
const { sql } = require('../db');
const {
  requireTaskCreation,
  requireTaskModification
} = require('../middleware/rbac');

// Debug middleware: log every request to /tasks
router.use((req, res, next) => {
	console.log(`[tasks.js] Route hit:`, req.method, req.originalUrl);
	next();
});

router.get('/', taskController.list);
router.post('/', requireTaskCreation(sql), taskController.create);
router.put('/:id', requireTaskModification(sql), taskController.update);

// Original routes for project-specific functionality
router.get('/project/:projectId', taskController.getTasksByProject || taskController.list);

module.exports = router;