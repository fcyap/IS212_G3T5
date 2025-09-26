const supabase = require('../utils/supabase');

class UserRepository {
  /**
   * Find user by ID
   * @param {number} userId - User ID
   * @returns {Object} User object
   */
  async findById(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Repository error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find all users
   * @returns {Array} Array of users
   */
  async findAll() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Repository error finding all users:', error);
      throw error;
    }
  }
}

module.exports = UserRepository;
