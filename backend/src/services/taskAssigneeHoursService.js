const taskAssigneeHoursRepository = require('../repository/taskAssigneeHoursRepository');

class TaskAssigneeHoursService {
  static MAX_ENTRY_HOURS = 10000;

  _requirePositiveInt(value, label) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new Error(`${label} must be a positive integer`);
    }
    return numeric;
  }

  normalizeHours(hours) {
    if (hours === undefined || hours === null || hours === '') {
      return 0;
    }

    const numeric = Number(hours);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error('Hours spent must be a non-negative number');
    }

    if (numeric > TaskAssigneeHoursService.MAX_ENTRY_HOURS) {
      throw new Error(`Hours spent cannot exceed ${TaskAssigneeHoursService.MAX_ENTRY_HOURS}`);
    }

    return Math.round(numeric * 100) / 100;
  }

  async recordHours({ taskId, userId, hours }) {
    const normalizedTaskId = this._requirePositiveInt(taskId, 'taskId');
    const normalizedUserId = this._requirePositiveInt(userId, 'userId');
    const normalizedHours = this.normalizeHours(hours);

    return taskAssigneeHoursRepository.upsert({
      taskId: normalizedTaskId,
      userId: normalizedUserId,
      hours: normalizedHours
    });
  }

  async getTaskHoursSummary(taskId, assigneeIds = []) {
    const normalizedTaskId = this._requirePositiveInt(taskId, 'taskId');
    const rows = await taskAssigneeHoursRepository.findByTask(normalizedTaskId);
    console.log('[taskAssigneeHoursService] rows for task', normalizedTaskId, rows);

    const hoursByUser = new Map();

    for (const row of rows) {
      const id = Number(row.user_id);
      if (!Number.isFinite(id)) continue;
      console.log('[taskAssigneeHoursService] processing row', row);
      hoursByUser.set(id, this.normalizeHours(row.hours));
    }

    if (Array.isArray(assigneeIds)) {
      for (const rawId of assigneeIds) {
        const id = Number(rawId);
        if (Number.isFinite(id) && !hoursByUser.has(id)) {
          hoursByUser.set(id, 0);
        }
      }
    }

    const perAssignee = Array.from(hoursByUser.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([userId, hours]) => ({
        user_id: userId,
        hours: this.normalizeHours(hours)
      }));

    const total = perAssignee.reduce((sum, item) => sum + item.hours, 0);

    return {
      total_hours: Math.round(total * 100) / 100,
      per_assignee: perAssignee
    };
  }
}

module.exports = new TaskAssigneeHoursService();
