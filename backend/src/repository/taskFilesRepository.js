const supabase = require('../utils/supabase');

class TaskFilesRepository {
  /**
   * Create a new task file record
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID who uploaded the file
   * @param {string} filePath - Path of the file in Supabase Storage
   * @param {string} fileName - Original filename
   * @param {string} fileUrl - Public URL of the file
   * @returns {Promise<Object>} Created task file record
   */
  async create(taskId, userId, filePath, fileName, fileUrl) {
    const { data, error } = await supabase
      .from('task_files')
      .insert({
        task_id: taskId,
        user_id: userId,
        file_path: filePath,
        file_name: fileName,
        file_url: fileUrl,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task file record: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all files for a specific task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Array of task files
   */
  async getByTaskId(taskId) {
    const { data, error } = await supabase
      .from('task_files')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch task files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a specific file by ID
   * @param {number} fileId - File ID
   * @returns {Promise<Object|null>} Task file record or null
   */
  async getById(fileId) {
    const { data, error } = await supabase
      .from('task_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch task file: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a task file record
   * @param {number} fileId - File ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteById(fileId) {
    const { error } = await supabase
      .from('task_files')
      .delete()
      .eq('id', fileId);

    if (error) {
      throw new Error(`Failed to delete task file: ${error.message}`);
    }

    return true;
  }

  /**
   * Delete all files for a specific task
   * @param {number} taskId - Task ID
   * @returns {Promise<number>} Number of deleted records
   */
  async deleteByTaskId(taskId) {
    const { data, error } = await supabase
      .from('task_files')
      .delete()
      .eq('task_id', taskId)
      .select();

    if (error) {
      throw new Error(`Failed to delete task files: ${error.message}`);
    }

    return data ? data.length : 0;
  }

  /**
   * Get files by user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of task files uploaded by user
   */
  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('task_files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Count files for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<number>} Count of files
   */
  async countByTaskId(taskId) {
    const { count, error } = await supabase
      .from('task_files')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Failed to count task files: ${error.message}`);
    }

    return count || 0;
  }
}

module.exports = new TaskFilesRepository();
