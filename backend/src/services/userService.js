const userRepository = require('../repository/userRepository');

/**
 * User Service - Contains business logic for user operations
 * This layer orchestrates data from repositories and applies business rules
 */
class UserService {

  /**
   * Get all users
   */
  async getAllUsers(filters = {}) {
    // Support both new format (with filters) and simple format (jiaxin branch compatibility)
    if (filters && Object.keys(filters).length > 0) {
      return await userRepository.getAllUsers(filters);
    } else {
      // For jiaxin branch compatibility - return simple array
      const result = await userRepository.getAllUsers();
      return Array.isArray(result) ? result : result.users;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      // Try the comprehensive method first
      return await userRepository.getUserById(userId);
    } catch (error) {
      // Fallback to jiaxin branch method
      try {
        return await userRepository.findById(userId);
      } catch (fallbackError) {
        throw error; // Throw original error
      }
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    return await userRepository.getUserByEmail(email);
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    // Validate required fields
    if (!userData.email || !userData.name || !userData.password) {
      throw new Error('Email, name, and password are required');
    }

    // Check if email already exists
    const emailExists = await userRepository.emailExists(userData.email);
    if (emailExists) {
      throw new Error('User with this email already exists');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Set default role if not provided
    const newUserData = {
      ...userData,
      role: userData.role || 'staff',
      created_at: new Date(),
      updated_at: new Date()
    };

    // In production, hash the password here
    // newUserData.password = await bcrypt.hash(userData.password, 10);

    return await userRepository.createUser(newUserData);
  }

  /**
   * Update user
   */
  async updateUser(userId, updates, requestingUserId) {
    // Get current user
    const currentUser = await userRepository.getUserById(userId);
    
    // Check permissions - users can update their own profile, managers can update anyone
    const requestingUser = await userRepository.getUserById(requestingUserId);
    const canUpdate = userId === requestingUserId || requestingUser.role === 'manager';
    
    if (!canUpdate) {
      throw new Error('You do not have permission to update this user');
    }

    // If updating email, check it doesn't already exist
    if (updates.email && updates.email !== currentUser.email) {
      const emailExists = await userRepository.emailExists(updates.email);
      if (emailExists) {
        throw new Error('User with this email already exists');
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        throw new Error('Invalid email format');
      }
    }

    // Only managers can update roles
    if (updates.role && requestingUser.role !== 'manager') {
      throw new Error('Only managers can update user roles');
    }

    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    // Hash password if updating
    if (updateData.password) {
      // In production, hash the password here
      // updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    return await userRepository.updateUser(userId, updateData);
  }

  /**
   * Delete user
   */
  async deleteUser(userId, requestingUserId) {
    // Only managers can delete users
    const requestingUser = await userRepository.getUserById(requestingUserId);
    if (requestingUser.role !== 'manager') {
      throw new Error('Only managers can delete users');
    }

    // Don't allow deleting yourself
    if (userId === requestingUserId) {
      throw new Error('You cannot delete your own account');
    }

    return await userRepository.deleteUser(userId);
  }

  /**
   * Get multiple users by IDs
   */
  async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    return await userRepository.getUsersByIds(userIds);
  }

  /**
   * Check if user exists
   */
  async userExists(userId) {
    return await userRepository.userExists(userId);
  }

  /**
   * Validate user credentials (for login)
   */
  async validateCredentials(email, password) {
    try {
      const user = await userRepository.getUserByEmail(email);
      
      // In production, compare hashed password
      // const isValid = await bcrypt.compare(password, user.password);
      const isValid = password === user.password; // Temporary for demo
      
      if (!isValid) {
        throw new Error('Invalid credentials');
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new Error('Invalid credentials');
    }
  }
  
    /**
   * Search users by name or email
   */
  async searchUsers(query, limit = 8) {
    return await userRepository.searchUsers(query, limit);
  }
  
}

module.exports = new UserService();
