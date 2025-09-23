const taskRepository = require("../repositories/taskRepository.js");

class TaskService {
   async listWithAssignees({ archived = false } = {}) {
    const { data: tasks, error } = await taskRepository.list({ archived });
    if (error) throw error;

    const idSet = new Set();
    for (const t of tasks) {
      const ids = Array.isArray(t.assigned_to)
        ? t.assigned_to
        : t.assigned_to != null ? [t.assigned_to] : [];
      ids.map(Number).filter(Number.isFinite).forEach(n => idSet.add(n));
    }

    let usersById = {};
    if (idSet.size) {
      const { data: users, error: uerr } =
        await taskRepository.getUsersByIds(Array.from(idSet));
      if (uerr) throw uerr;
      usersById = Object.fromEntries(users.map(u => [u.id, u]));
    }

    return tasks.map(t => {
      const raw = Array.isArray(t.assigned_to)
        ? t.assigned_to
        : t.assigned_to != null ? [t.assigned_to] : [];
      const assignees = raw
        .map(Number)
        .filter((n) => usersById[n])
        .map((id) => ({ id, name: usersById[id].name }));
      return { ...t, assignees };
    });
  }

  async createTask(input) {
    const {
      title,
      description = null,
      priority,
      status,
      deadline = null,
      team_id = null,
      assigned_to,
      tags, // <— NEW
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

    // NEW: normalize tags to a text[]
    const tagsArr = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
      ? tags.split(",")
      : [];
    const normTags = Array.from(
      new Set(
        tagsArr
          .map((t) => String(t).trim())
          .filter(Boolean)
      )
    );

    const payload = {
      title,
      description,
      priority: normPriority,
      status: normStatus,
      deadline,
      team_id,
      assigned_to: assignees,
      tags: normTags, // <— NEW
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await taskRepository.insert(payload);
    if (error) throw error;
    return data;
  }

  async updateTask(id, input) {
    const patch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined)
      patch.priority = String(input.priority).toLowerCase();
    if (input.status !== undefined) patch.status = input.status;
    if (input.deadline !== undefined) patch.deadline = input.deadline || null;
    if (input.archived !== undefined) patch.archived = !!input.archived;

    // OPTIONAL: allow editing tags later
    if (input.tags !== undefined) {
      const tagsArr = Array.isArray(input.tags)
        ? input.tags
        : typeof input.tags === "string"
        ? input.tags.split(",")
        : [];
      patch.tags = Array.from(
        new Set(
          tagsArr
            .map((t) => String(t).trim())
            .filter(Boolean)
        )
      );
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await taskRepository.updateById(id, patch);
    if (error) throw error;
    return data;
  }
}

module.exports = new TaskService();
