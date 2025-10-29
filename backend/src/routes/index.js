const express = require('express');
const router = express.Router();

const teamMembersRoutes = require('./users');
const projectsRoutes = require('./projects');
const tasksRoutes = require('./tasks');
const taskCommentRoutes = require('./tasks/taskCommentRoute');
const notificationsRoutes = require('./notifications');
// const taskAttachmentsRoutes = require('./taskAttachmentsRoute');
// const taskFilesRoutes = require('./taskFiles');
// const taskFilesDeleteRoutes = require('./taskFilesDelete');

router.use('/users', teamMembersRoutes);
router.use('/projects', projectsRoutes);
console.log("task upd received in routes>index.js")
router.use('/tasks', tasksRoutes);
router.use('/api/tasks', taskCommentRoutes);
// router.use('/tasks/:taskId/attachments', taskAttachmentsRoutes);
// router.use('/tasks/:taskId/files', taskFilesRoutes); // New Supabase file routes
// router.use('/tasks/:taskId/files', taskFilesDeleteRoutes); // Delete file route
router.use('/notifications', notificationsRoutes);

module.exports = router;