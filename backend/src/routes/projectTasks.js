const express = require('express');
const router = express.Router();
const projectTasksController = require('../controllers/projectTasksController');

// GET /projects/:projectId/tasks - Get all tasks for a specific project
router.get('/:projectId/tasks', projectTasksController.getProjectTasks);

// GET /projects/:projectId/tasks/stats - Get project task statistics
router.get('/:projectId/tasks/stats', projectTasksController.getTaskStats);

// GET /projects/:projectId/tasks/:taskId - Get a specific task
router.get('/:projectId/tasks/:taskId', projectTasksController.getTaskById);

// GET /tasks - Get all tasks
router.get('/tasks', projectTasksController.getAllTasks);

// POST /projects/:projectId/tasks - Create a new task for a specific project
router.post('/:projectId/tasks', projectTasksController.createTask);

// PUT /tasks/:taskId - Update a task
router.put('/tasks/:taskId', projectTasksController.updateTask);

// DELETE /tasks/:taskId - Delete a task
router.delete('/tasks/:taskId', projectTasksController.deleteTask);

module.exports = router;