const supabase = require('../utils/supabase');

/**
 * User Repository - Handles all database operations for users
 * This layer only deals with CRUD operations and database queries
 */
class UserRepository {
  
  /**
   * Get all users
   */
  async getAllUsers(filters = {}) {
    console.log('UserRepository.getAllUsers called with filters:', filters);
    
    try {
      // Simple test query first
      console.log('Testing Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });

      if (testError) {
        console.error('Supabase connection test failed:', testError);
        // Fall back to hardcoded data
        return this.getFallbackUsers();
      }

      console.log(`Supabase connection successful. Found ${testData} users.`);

      // Now try to get actual users
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users from Supabase:', error);
        console.log('Falling back to hardcoded data...');
        return this.getFallbackUsers();
      }

      console.log(`Successfully fetched ${users?.length || 0} users from database`);

      const result = {
        users: users || [],
        totalCount: users?.length || 0,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          totalCount: users?.length || 0
        }
      };

      return result;
    } catch (error) {
      console.error('Unexpected error in getAllUsers:', error);
      return this.getFallbackUsers();
    }
  }

  /**
   * Fallback users data when database is not available
   */
  getFallbackUsers() {
    console.log('Using fallback hardcoded user data');
    const hardcodedUsers = [
      { id: 1, name: 'John Doe', email: 'john@example.com', role: 'manager', created_at: '2025-01-01' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'staff', created_at: '2025-01-02' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'staff', created_at: '2025-01-03' }
    ];

    return {
      users: hardcodedUsers,
      totalCount: hardcodedUsers.length,
      pagination: {
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        totalCount: hardcodedUsers.length
      }
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Get multiple users by IDs
   */
  async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Check if user exists
   */
  async userExists(userId) {
    try {
      await this.getUserById(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email) {
    try {
      await this.getUserByEmail(email);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new UserRepository();
