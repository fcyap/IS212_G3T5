const express = require("express");
const taskController = require("../controllers/taskController.js");

const router = express.Router();

router.get("/", taskController.list);
router.post("/", taskController.create);
router.put("/:id", taskController.update);

module.exports = router;