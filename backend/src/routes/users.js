const express = require('express');
const router = express.Router();
const { getAllUsers, createUser } = require('../controllers/userController');

router.get('/', getAllUsers);
// Search users (for assignee search box)
router.get('/search', require('../controllers/userController').searchUsers);
router.post('/', createUser);

module.exports = router;