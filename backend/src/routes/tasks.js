import { Router } from "express";
import taskController from "../controllers/taskController.js";

const router = Router();

router.get("/", (req, res) => taskController.list(req, res));
router.post("/", (req, res) => taskController.create(req, res));
router.put("/:id", (req, res) => taskController.update(req, res));

export default router;

