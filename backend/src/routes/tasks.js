const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController.js');

router.get('/', taskController.list);
router.post('/', taskController.create);
router.put('/:id', taskController.update);

// Original routes for project-specific functionality
router.get('/project/:projectId', taskController.getTasksByProject || taskController.list);

module.exports = router;