const projectService = require('../services/projectService');

/**
 * Project Controller - Handles HTTP requests and responses for projects
 * This layer only deals with request validation and response formatting
 */

/**
 * Create a new project
 */
const createProject = async (req, res) => {
  try {
    const { name, description, user_ids, creator_id } = req.body;

    const projectData = {
      name,
      description,
      user_ids: user_ids || [],
      creator_id
    };

    const result = await projectService.createProject(projectData);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('Error in createProject:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllProjects = async (req, res) => {
  try {
    // Get current user from session or auth middleware
    const session = res.locals.session;
    if (!session) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Get complete user information including hierarchy and division
    const { sql } = require('../db');
    const users = await sql/*sql*/`
      select id, name, email, role, hierarchy, division, department
      from public.users
      where id = ${session.user_id}
      limit 1
    `;

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentUser = users[0];
    console.log('🔍 [ProjectController] Getting projects for user:', currentUser.name);

    // Call service layer with RBAC
    const projects = await projectService.getProjectsWithRBAC(currentUser);

    // Format response
    res.json({ success: true, projects, userRole: currentUser.role });
  } catch (err) {
    console.error('Error in getAllProjects:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getProjectById = async (req, res) => {
  try {
    // Input validation
    const { projectId } = req.params;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    // Call service layer
    const project = await projectService.getProjectById(parseInt(projectId));

    // Format response
    res.json({ success: true, project });
  } catch (err) {
    console.error('Error in getProjectById:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const getProjectMembers = async (req, res) => {
  try {
    // Input validation
    const { projectId } = req.params;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    // Call service layer
    const members = await projectService.getProjectMembers(parseInt(projectId));

    // Format response
    res.json({ success: true, projectId: parseInt(projectId), members });
  } catch (err) {
    console.error('Error in getProjectMembers:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const addProjectMembers = async (req, res) => {
  try {
    // Input validation
    const { projectId } = req.params;
    const { userIds, message, role } = req.body;
    const requestingUserId = req.user?.id || 1;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array is required and cannot be empty' });
    }

    // Validate role if provided
    const memberRole = role || 'collaborator';
    const validRoles = ['creator', 'manager', 'collaborator'];
    if (!validRoles.includes(memberRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be creator, manager, or collaborator' });
    }

    // Validate all user IDs are numbers
    const validUserIds = userIds.map(id => {
      const numId = parseInt(id);
      if (isNaN(numId)) {
        throw new Error('All user IDs must be valid numbers');
      }
      return numId;
    });

    if (!requestingUserId) {
      return res.status(400).json({ success: false, message: 'Requesting user ID is required' });
    }

    // Call service layer
    const updatedProject = await projectService.addUsersToProject(
      parseInt(projectId),
      validUserIds,
      requestingUserId,
      message,
      memberRole
    );

    // Format response
    res.json({
      success: true,
      project: updatedProject,
      message: `Successfully added ${validUserIds.length} member(s) to project`
    });
  } catch (err) {
    console.error('Error in addProjectMembers:', err);
    if (err.message.includes('Only managers') || err.message.includes('Cannot remove')) {
      res.status(403).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const removeProjectMember = async (req, res) => {
  try {
    // Input validation
    const { projectId, userId } = req.params;
    const requestingUserId = req.user?.id || 1;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    if (!requestingUserId) {
      return res.status(400).json({ success: false, message: 'Requesting user ID is required' });
    }

    // Call service layer
    const updatedProject = await projectService.removeUserFromProject(
      parseInt(projectId),
      parseInt(userId),
      requestingUserId
    );

    // Format response
    res.json({
      success: true,
      project: updatedProject,
      message: 'Member successfully removed from project'
    });
  } catch (err) {
    console.error('Error in removeProjectMember:', err);
    if (err.message.includes('Only managers') || err.message.includes('Cannot remove')) {
      res.status(403).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const archiveProject = async (req, res) => {
  try {
    // Input validation
    const { projectId } = req.params;
    const requestingUserId = req.user?.id || 1;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    if (!requestingUserId) {
      return res.status(400).json({ success: false, message: 'Requesting user ID is required' });
    }

    // Call service layer
    const archivedProject = await projectService.archiveProject(
      parseInt(projectId),
      requestingUserId
    );

    // Format response
    res.json({
      success: true,
      project: archivedProject,
      message: 'Project and all its tasks have been archived successfully'
    });
  } catch (err) {
    console.error('Error in archiveProject:', err);
    if (err.message.includes('Only managers') || err.message.includes('not found')) {
      const statusCode = err.message.includes('not found') ? 404 : 403;
      res.status(statusCode).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  getProjectMembers,
  addProjectMembers,
  removeProjectMember,
  archiveProject
};
