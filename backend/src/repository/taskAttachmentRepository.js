const supabase = require('../utils/supabase');

/**
 * Task Attachment Repository - Handles all database operations for task attachments
 * This layer only deals with CRUD operations and database queries
 */
class TaskAttachmentRepository {
  /**
   * Create a new attachment record in the database
   * @param {Object} attachmentData - The attachment data
   * @returns {Promise<Object>} The created attachment
   */
  async create(attachmentData) {
    const { data, error } = await supabase
      .from('task_attachments')
      .insert(attachmentData)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Get all attachments for a specific task
   * @param {number} taskId - The task ID
   * @returns {Promise<Array>} Array of attachments
   */
  async getByTaskId(taskId) {
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('uploaded_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get a specific attachment by ID
   * @param {number} attachmentId - The attachment ID
   * @returns {Promise<Object|null>} The attachment or null if not found
   */
  async getById(attachmentId) {
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (error) {
      // Not found is not an error, return null
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete an attachment by ID
   * @param {number} attachmentId - The attachment ID
   * @returns {Promise<boolean>} True if successful
   */
  async deleteById(attachmentId) {
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Delete all attachments for a specific task
   * @param {number} taskId - The task ID
   * @returns {Promise<boolean>} True if successful
   */
  async deleteByTaskId(taskId) {
    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('task_id', taskId);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Get the total size of all attachments for a task
   * @param {number} taskId - The task ID
   * @returns {Promise<number>} Total size in bytes
   */
  async getTotalSize(taskId) {
    const { data, error } = await supabase
      .from('task_attachments')
      .select('file_size')
      .eq('task_id', taskId);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return 0;
    }

    return data.reduce((sum, attachment) => sum + (attachment.file_size || 0), 0);
  }

  /**
   * Update the file name of an attachment
   * @param {number} attachmentId - The attachment ID
   * @param {string} newFileName - The new file name
   * @returns {Promise<Object>} The updated attachment
   */
  async updateFileName(attachmentId, newFileName) {
    const { data, error } = await supabase
      .from('task_attachments')
      .update({ file_name: newFileName })
      .eq('id', attachmentId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Count the number of attachments for a task
   * @param {number} taskId - The task ID
   * @returns {Promise<number>} The count of attachments
   */
  async countByTaskId(taskId) {
    const { count, error } = await supabase
      .from('task_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }
}

module.exports = new TaskAttachmentRepository();
