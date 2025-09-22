const express = require('express');
const router = express.Router();

const teamMembersRoutes = require('./users');
const projectsRoutes = require('./projects');
const tasksRoutes = require('./tasks');

router.use('/users', teamMembersRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);

module.exports = router;