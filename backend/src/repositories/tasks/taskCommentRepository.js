// src/repositories/commentRepository.js (CommonJS)
const { supabase } = require('../../utils/supabase'); 
// ^ If your file is at src/repositories/commentRepository.js and supabase is at src/utils/supabase.js,
// this is the correct relative path. Adjust if your structure differs.

class taskCommentRepository {
  table() { return 'task_comments'; }

  // Pull comments for a task + the author's name from public.users
  async getByTask(taskId) {
    const { data, error } = await supabase
      .from(this.table())
      .select(`
        id,
        task_id,
        parent_id,
        user_id,
        content,
        created_at,
        updated_at,
        edited,
        users ( name )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getById(id) {
    const { data, error } = await supabase
      .from(this.table())
      .select(`
        id,
        task_id,
        parent_id,
        user_id,
        content,
        created_at,
        updated_at,
        edited,
        users ( name )
      `)
      .eq('id', id)
      .single();

    if (error) return null; // normalize not-found
    return data;
  }

  async create({ taskId, userId, content, parentId = null }) {
    const payload = {
      task_id: taskId,
      user_id: userId,
      content,
      parent_id: parentId,
    };

    const { data, error } = await supabase
      .from(this.table())
      .insert(payload)
      .select(`
        id,
        task_id,
        parent_id,
        user_id,
        content,
        created_at,
        updated_at,
        edited,
        users ( name )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async update({ id, content }) {
    const { data, error } = await supabase
      .from(this.table())
      .update({
        content,
        edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id,
        task_id,
        parent_id,
        user_id,
        content,
        created_at,
        updated_at,
        edited,
        users ( name )
      `)
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = { taskCommentRepository };