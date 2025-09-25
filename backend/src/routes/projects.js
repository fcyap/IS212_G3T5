const express = require('express');
const router = express.Router();
const {
  getAllProjects,
  getProjectById,
  getProjectMembers,
  addProjectMembers,
  removeProjectMember,
  archiveProject
} = require('../controllers/projectController');

router.get('/', getAllProjects);
router.get('/:projectId', getProjectById);
router.get('/:projectId/members', getProjectMembers);
router.post('/:projectId/members', addProjectMembers);
router.delete('/:projectId/members/:userId', removeProjectMember);
router.patch('/:projectId/archive', archiveProject);

module.exports = router;
