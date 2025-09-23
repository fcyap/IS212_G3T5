const taskServiceModule = require("../services/taskService");
const taskService = taskServiceModule.default || taskServiceModule; 

class TaskController {
  // GET /tasks
  async list(req, res) {
    try {
      const archived =
        String(req.query.archived ?? "false").toLowerCase() === "true";
      const tasks = await taskService.listWithAssignees({ archived });
      res.json(tasks);
    } catch (e) {
      console.error("[GET /tasks]", e);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  }


  // POST /tasks
  async create(req, res) {
    try {
      const task = await taskService.createTask(req.body);
      res.status(201).json(task);
    } catch (e) {
      console.error("[POST /tasks]", e);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  }

  // PUT /tasks/:id
  async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const task = await taskService.updateTask(id, req.body);
      res.json(task);
    } catch (e) {
      console.error("[PUT /tasks/:id]", e);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  }
}

module.exports = new TaskController();
// module.exports.TaskController = TaskController;
