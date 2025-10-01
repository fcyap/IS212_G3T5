const express = require('express');
const router = express.Router();
const { sql } = require('../db');
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
router.get('/', filterVisibleProjects(sql), getAllProjects);
router.get('/:projectId', getProjectById);
router.put('/:projectId', requireProjectEdit(sql), updateProject);
router.delete('/:projectId', requireProjectEdit(sql), deleteProject);
router.get('/:projectId/members', getProjectMembers);
router.post('/:projectId/members', requireAddProjectMembers(sql), addProjectMembers);
router.delete('/:projectId/members/:userId', requireProjectEdit(sql), removeProjectMember);
router.patch('/:projectId/archive', requireProjectEdit(sql), archiveProject);

module.exports = router;
