const express = require('express');
const {
  getAllUsers,
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  updateUserPassword,
  getUserProjects,
  getUserTasks
} = require('../controllers/userController');

const router = express.Router();

// Get all users
router.get('/', getAllUsers);
// Search users (for assignee search box)
router.get('/search', require('../controllers/userController').searchUsers);

// Get user by ID
router.get('/:userId', getUserById);

// Get user by email
router.get('/email/:email', getUserByEmail);

// Create new user
router.post('/', createUser);

// Update user
router.put('/:userId', updateUser);

// Delete user
router.delete('/:userId', deleteUser);

// Update user password
router.patch('/:userId/password', updateUserPassword);

// Get user's projects
router.get('/:userId/projects', getUserProjects);

// Get user's tasks
router.get('/:userId/tasks', getUserTasks);

module.exports = router;
