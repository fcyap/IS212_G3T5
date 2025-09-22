import taskRepository from "../repositories/taskRepository.js";

export class TaskService {
  // GET /tasks
  async listUnarchivedWithAssignees() {
    const { data: tasks, error } = await taskRepository.listUnarchived();
    if (error) throw error;

    // collect unique user IDs from assigned_to arrays
    const idSet = new Set();
    for (const t of tasks) {
      const ids = Array.isArray(t.assigned_to)
        ? t.assigned_to
        : t.assigned_to != null
        ? [t.assigned_to]
        : [];
      ids
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
        .forEach((n) => idSet.add(n));
    }

    let usersById = {};
    if (idSet.size) {
      const { data: users, error: uerr } = await taskRepository.getUsersByIds(
        Array.from(idSet)
      );
      if (uerr) throw uerr;
      usersById = Object.fromEntries(users.map((u) => [u.id, u]));
    }

    // attach assignees: [{id, name}]
    return tasks.map((t) => {
      const raw = Array.isArray(t.assigned_to)
        ? t.assigned_to
        : t.assigned_to != null
        ? [t.assigned_to]
        : [];
      const assignees = raw
        .map((v) => Number(v))
        .filter((n) => usersById[n])
        .map((id) => ({ id, name: usersById[id].name }));
      return { ...t, assignees };
    });
  }

  // POST /tasks
  async createTask(input) {
    const {
      title,
      description = null,
      priority,
      status,
      deadline = null,
      team_id = null,
      assigned_to,
    } = input;

    if (!title) {
      const err = new Error("title is required");
      err.status = 400;
      throw err;
    }

    const normPriority = String(priority || "low").toLowerCase();
    const allowed = new Set(["pending", "in_progress", "completed", "blocked"]);
    const requested = String(status || "pending").toLowerCase();
    const normStatus = allowed.has(requested) ? requested : "pending";
    const assignees = Array.isArray(assigned_to) ? assigned_to : [];

    const payload = {
      title,
      description,
      priority: normPriority,
      status: normStatus,
      deadline,
      team_id,
      assigned_to: assignees,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await taskRepository.insert(payload);
    if (error) throw error;
    return data;
  }

  // PUT /tasks/:id
  async updateTask(id, input) {
    const patch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined)
      patch.priority = String(input.priority).toLowerCase();
    if (input.status !== undefined) patch.status = input.status;
    if (input.deadline !== undefined) patch.deadline = input.deadline || null;
    if (input.archived !== undefined) patch.archived = !!input.archived;

    patch.updated_at = new Date().toISOString();

    const { data, error } = await taskRepository.updateById(id, patch);
    if (error) throw error;
    return data;
  }
}

export default new TaskService();
