const express = require('express');
const router = express.Router();
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

router.post('/', requireProjectCreation, createProject);
router.get('/', filterVisibleProjects(null), getAllProjects);
router.get('/:projectId', getProjectById);
router.put('/:projectId', requireProjectEdit(null), updateProject);
router.delete('/:projectId', requireProjectEdit(null), deleteProject);
router.get('/:projectId/members', getProjectMembers);
router.post('/:projectId/members', requireAddProjectMembers(null), addProjectMembers);
router.delete('/:projectId/members/:userId', requireProjectEdit(null), removeProjectMember);
router.patch('/:projectId/archive', requireProjectEdit(null), archiveProject);

module.exports = router;
