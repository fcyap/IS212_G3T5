const UserRepository = require('../repository/userRepository');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Object} User object
   */
  async getUserById(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      console.error('Service error getting user:', error);
      throw error;
    }
  }

  /**
   * Get all users
   * @returns {Array} Array of users
   */
  async getAllUsers() {
    try {
      return await this.userRepository.findAll();
    } catch (error) {
      console.error('Service error getting users:', error);
      throw error;
    }
  }
}

module.exports = UserService;
