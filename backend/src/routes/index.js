const express = require('express');
const router = express.Router();

const teamMembersRoutes = require('./users');
const projectsRoutes = require('./projects');
const tasksRoutes = require('./tasks');
const taskCommentRoutes = require('./tasks/taskCommentRoute');

router.use('/users', teamMembersRoutes);
router.use('/projects', projectsRoutes);
console.log("task upd received in routes>index.js")
router.use('/tasks', tasksRoutes);
router.use('/api/tasks', taskCommentRoutes);

module.exports = router;