const UserService = require('../services/userService');

const userService = new UserService();

/**
 * Get user by ID
 */
async function getUserById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing user ID',
        message: 'User ID is required'
      });
    }

    const userIdNum = parseInt(id);
    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID',
        message: 'User ID must be a valid integer'
      });
    }

    const user = await userService.getUserById(userIdNum);

    res.status(200).json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Get all users
 */
async function getAllUsers(req, res) {
  try {
    const users = await userService.getAllUsers();

    res.status(200).json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

module.exports = {
  getUserById,
  getAllUsers
};
