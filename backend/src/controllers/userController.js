const userService = require('../services/userService');

/**
 * User Controller - Handles HTTP requests and responses for users
 * This layer only deals with request validation and response formatting
 */

const getAllUsers = async (req, res) => {
  try {
    // Input validation and query parameter parsing
    const filters = {
      role: req.query.role,
      email: req.query.email,
      searchTerm: req.query.search?.trim(),
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };

    // Validate page and limit
    if (filters.page < 1) {
      return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
    }

    if (filters.limit < 1 || filters.limit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    // Calculate offset for pagination
    filters.offset = (filters.page - 1) * filters.limit;

    // Call service layer
    console.log('About to call userService.getAllUsers with filters:', filters);
    const result = await userService.getAllUsers(filters);
    console.log('User service result:', result);

    // Format response - handle both new and legacy format
    const response = {
      success: true,
      users: Array.isArray(result) ? result : result.users,
      totalUsers: Array.isArray(result) ? result.length : result.totalCount,
      pagination: Array.isArray(result) ? {
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(result.length / filters.limit),
        hasNextPage: false,
        hasPrevPage: false,
        totalCount: result.length
      } : result.pagination,
      filters: {
        role: filters.role || null,
        email: filters.email || null,
        searchTerm: filters.searchTerm || null,
        isActive: filters.isActive !== undefined ? filters.isActive : null,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      }
    };
    console.log('Final response:', response);
    res.json(response);
  } catch (err) {
    console.error('Error in getAllUsers:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getUserById = async (req, res) => {
  try {
    // Input validation
    const { userId } = req.params;
    
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    // Call service layer
    const user = await userService.getUserById(parseInt(userId));
    
    // Format response
    res.json({ success: true, user });
  } catch (err) {
    console.error('Error in getUserById:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const getUserByEmail = async (req, res) => {
  try {
    // Input validation
    const { email } = req.params;
    
    if (!email || email.trim() === '') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Call service layer
    const user = await userService.getUserByEmail(email.trim().toLowerCase());
    
    // Format response
    res.json({ success: true, user });
  } catch (err) {
    console.error('Error in getUserByEmail:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    // Input validation
    const { name, email, password, role } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    // Validate role if provided
    const validRoles = ['admin', 'project_manager', 'team_member'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: `Role must be one of: ${validRoles.join(', ')}` 
      });
    }

    const userData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      role: role || 'team_member'
    };

    // Call service layer
    const user = await userService.createUser(userData);
    
    // Format response (exclude password from response)
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ success: true, user: userWithoutPassword });
  } catch (err) {
    console.error('Error in createUser:', err);
    if (err.message.includes('already exists') || err.message.includes('unique')) {
      res.status(409).json({ success: false, message: 'Email already exists' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const updateUser = async (req, res) => {
  try {
    // Input validation
    const { userId } = req.params;
    const { name, email, role, isActive } = req.body;
    const requestingUserId = req.user?.id || 1;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    const updates = {};
    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Name cannot be empty' });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (email.trim() === '') {
        return res.status(400).json({ success: false, message: 'Email cannot be empty' });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
      }
      
      updates.email = email.trim().toLowerCase();
    }

    // Validate role if provided
    if (role !== undefined) {
      const validRoles = ['admin', 'project_manager', 'team_member'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          success: false, 
          message: `Role must be one of: ${validRoles.join(', ')}` 
        });
      }
      updates.role = role;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isActive must be a boolean value' });
      }
      updates.isActive = isActive;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one field to update is required' });
    }

    // Call service layer
    const updatedUser = await userService.updateUser(parseInt(userId), updates, requestingUserId);
    
    // Format response (exclude password from response)
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (err) {
    console.error('Error in updateUser:', err);
    if (err.message.includes('permission')) {
      res.status(403).json({ success: false, message: err.message });
    } else if (err.message.includes('already exists') || err.message.includes('unique')) {
      res.status(409).json({ success: false, message: 'Email already exists' });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const deleteUser = async (req, res) => {
  try {
    // Input validation
    const { userId } = req.params;
    const requestingUserId = req.user?.id || 1;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    if (!requestingUserId) {
      return res.status(400).json({ success: false, message: 'Requesting user ID is required' });
    }

    // Call service layer
    await userService.deleteUser(parseInt(userId), requestingUserId);
    
    // Format response
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error in deleteUser:', err);
    if (err.message.includes('permission')) {
      res.status(403).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const updateUserPassword = async (req, res) => {
  try {
    // Input validation
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;
    const requestingUserId = req.user?.id || 1;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    // Call service layer
    await userService.updateUserPassword(parseInt(userId), currentPassword, newPassword, requestingUserId);
    
    // Format response
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error in updateUserPassword:', err);
    if (err.message.includes('permission')) {
      res.status(403).json({ success: false, message: err.message });
    } else if (err.message.includes('current password')) {
      res.status(400).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const getUserProjects = async (req, res) => {
  try {
    // Input validation
    const { userId } = req.params;
    const { includeCompleted } = req.query;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    const options = {
      includeCompleted: includeCompleted === 'true'
    };

    // Call service layer
    const projects = await userService.getUserProjects(parseInt(userId), options);
    
    // Format response
    res.json({
      success: true,
      userId: parseInt(userId),
      projects,
      includeCompleted: options.includeCompleted
    });
  } catch (err) {
    console.error('Error in getUserProjects:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const getUserTasks = async (req, res) => {
  try {
    // Input validation
    const { userId } = req.params;
    const { status, priority, includeCompleted } = req.query;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    const options = {
      status,
      priority,
      includeCompleted: includeCompleted === 'true'
    };

    // Call service layer
    const tasks = await userService.getUserTasks(parseInt(userId), options);
    
    // Format response
    res.json({
      success: true,
      userId: parseInt(userId),
      tasks,
      filters: {
        status: options.status || null,
        priority: options.priority || null,
        includeCompleted: options.includeCompleted
      }
    });
  } catch (err) {
    console.error('Error in getUserTasks:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  updateUserPassword,
  getUserProjects,
  getUserTasks
};
