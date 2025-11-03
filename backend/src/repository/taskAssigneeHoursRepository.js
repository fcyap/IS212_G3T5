const supabase = require('../utils/supabase');

class TaskAssigneeHoursRepository {
  async upsert({ taskId, userId, hours }) {
    const payload = {
      task_id: taskId,
      user_id: userId,
      hours,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('task_assignee_hours')
      .upsert(payload, { onConflict: 'task_id,user_id' })
      .select('task_id, user_id, hours')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async findByTask(taskId) {
    const { data, error } = await supabase
      .from('task_assignee_hours')
      .select('task_id, user_id, hours')
      .eq('task_id', taskId);

    if (error) {
      throw new Error(error.message);
    }

    console.log('[taskAssigneeHoursRepository] findByTask', taskId, data);
    return data || [];
  }

  async deleteByTaskAndUsers(taskId, userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { deletedCount: 0 };
    }

    const { data, error } = await supabase
      .from('task_assignee_hours')
      .delete()
      .eq('task_id', taskId)
      .in('user_id', userIds)
      .select('user_id');

    if (error) {
      throw new Error(error.message);
    }

    console.log('[taskAssigneeHoursRepository] deleted hours for users', userIds, 'from task', taskId);
    return { deletedCount: data ? data.length : 0, deletedUserIds: data ? data.map(row => row.user_id) : [] };
  }
}

module.exports = new TaskAssigneeHoursRepository();
