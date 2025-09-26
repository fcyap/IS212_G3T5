const express = require('express');
const { getUserById, getAllUsers } = require('../controllers/userController');

const router = express.Router();

// Get all users
router.get('/', getAllUsers);

// Get user by ID
router.get('/:id', getUserById);

module.exports = router;
