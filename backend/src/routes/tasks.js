<<<<<<< HEAD
const express = require('express');
const router = express.Router();
const { getAllTasks, getTasksByProject } = require('../controllers/taskController');

router.get('/', getAllTasks);
router.get('/project/:projectId', getTasksByProject);
=======
const express = require("express");
const taskController = require("../controllers/taskController.js");

const router = express.Router();

router.get("/", taskController.list);
router.post("/", taskController.create);
router.put("/:id", taskController.update);
>>>>>>> origin/michelle

module.exports = router;