const express = require('express');
const router = express.Router();

// Debug middleware to log all requests
router.use((req, res, next) => {
  // Sanitize user-controlled values to prevent log injection
  const sanitize = (str) => String(str || '').replace(/[\n\r]/g, '');
  console.log(`[ProjectRouter] ${sanitize(req.method)} ${sanitize(req.path)}`);
  next();
});

// No longer need sql import - RBAC middleware now uses Supabase directly
const {
  createProject,
  getAllProjects,
  getProjectById,
  getProjectMembers,
  addProjectMembers,
  removeProjectMember,
  archiveProject
} = require('../controllers/projectController');

// Import auth middleware
const { authMiddleware } = require('../middleware/auth');

// Import RBAC middleware
const {
  requireProjectCreation,
  requireProjectEdit,
  requireAddProjectMembers,
  filterVisibleProjects
} = require('../middleware/rbac');

// We need to add updateProject and deleteProject controllers
const projectService = require('../services/projectService');

const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const updateData = req.body;

    const result = await projectService.updateProject(parseInt(projectId), updateData);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('Error in updateProject:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await projectService.deleteProject(parseInt(projectId));

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('Error in deleteProject:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/', authMiddleware(), requireProjectCreation, createProject);
router.get('/', authMiddleware(), filterVisibleProjects(), getAllProjects);
router.get('/:projectId', authMiddleware(), getProjectById);
router.put('/:projectId', authMiddleware(), requireProjectEdit(), updateProject);
router.delete('/:projectId', authMiddleware(), requireProjectEdit(), deleteProject);
router.get('/:projectId/members', authMiddleware(), getProjectMembers);
router.post('/:projectId/members', authMiddleware(), requireAddProjectMembers(), addProjectMembers);
router.delete('/:projectId/members/:userId', authMiddleware(), requireProjectEdit(), removeProjectMember);
router.patch('/:projectId/archive', authMiddleware(), requireProjectEdit(), archiveProject);

// Less specific routes come after
router.get('/:projectId', authMiddleware(), getProjectById);
router.put('/:projectId', authMiddleware(), requireProjectEdit(), updateProject);
router.delete('/:projectId', authMiddleware(), requireProjectEdit(), deleteProject);

module.exports = router;
