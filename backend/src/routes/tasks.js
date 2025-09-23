const express = require('express');
const router = express.Router();
const { getAllTasks, getTasksByProject } = require('../controllers/taskController');

router.get('/', getAllTasks);
router.get('/project/:projectId', getTasksByProject);

module.exports = router;