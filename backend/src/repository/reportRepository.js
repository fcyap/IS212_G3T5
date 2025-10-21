const supabase = require('../utils/supabase');

/**
 * Report Repository - Handles all database operations for reports
 * This layer only deals with CRUD operations and database queries
 */
class ReportRepository {

  /**
   * Get tasks for report with various filters
   */
  async getTasksForReport(filters = {}) {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          projects!tasks_project_id_fkey(id, name)
        `);

      // Apply filters
      if (filters.projectIds && filters.projectIds.length > 0) {
        query = query.in('project_id', filters.projectIds);
      }

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      }

      if (filters.priorities && filters.priorities.length > 0) {
        query = query.in('priority', filters.priorities);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        // Add one day to include the end date
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lte('created_at', endDate.toISOString().split('T')[0]);
      }

      if (filters.userIds && filters.userIds.length > 0) {
        // Filter by assigned users - need to check if array contains any of the userIds
        // This is a bit tricky with Supabase arrays, so we'll filter in memory
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      // Post-process filter for assigned users if needed
      let filteredData = data;
      if (filters.userIds && filters.userIds.length > 0) {
        filteredData = data.filter(task => {
          if (!task.assigned_to) return false;
          const assignedArray = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
          return assignedArray.some(userId => filters.userIds.includes(userId));
        });
      }

      return { data: filteredData, error: null };
    } catch (error) {
      console.error('Error in getTasksForReport:', error);
      return { data: null, error };
    }
  }

  /**
   * Get users by department
   */
  async getUsersByDepartment(department) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, department, role')
        .eq('department', department);

      return { data, error };
    } catch (error) {
      console.error('Error in getUsersByDepartment:', error);
      return { data: null, error };
    }
  }

  /**
   * Get users by department hierarchy (includes subdepartments)
   */
  async getUsersByDepartmentHierarchy(parentDepartment) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, department, role');

      if (error) {
        return { data: null, error };
      }

      // Filter users whose department starts with the parent department
      const filteredData = data.filter(user => {
        if (!user.department) return false;
        return user.department === parentDepartment || 
               user.department.startsWith(parentDepartment + '.');
      });

      return { data: filteredData, error: null };
    } catch (error) {
      console.error('Error in getUsersByDepartmentHierarchy:', error);
      return { data: null, error };
    }
  }

  /**
   * Get projects by department (based on creator's department)
   */
  async getProjectsByDepartment(userIds) {
    try {
      if (!userIds || userIds.length === 0) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('creator_id', userIds);

      return { data, error };
    } catch (error) {
      console.error('Error in getProjectsByDepartment:', error);
      return { data: null, error };
    }
  }

  /**
   * Get task statistics by status
   */
  async getTaskStatisticsByStatus(projectIds) {
    try {
      let query = supabase
        .from('tasks')
        .select('status');

      if (projectIds && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      // Aggregate by status
      const stats = data.reduce((acc, task) => {
        const status = task.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Convert to array format
      const result = Object.entries(stats).map(([status, count]) => ({
        status,
        count
      }));

      return { data: result, error: null };
    } catch (error) {
      console.error('Error in getTaskStatisticsByStatus:', error);
      return { data: null, error };
    }
  }

  /**
   * Get task statistics by priority
   */
  async getTaskStatisticsByPriority(projectIds) {
    try {
      let query = supabase
        .from('tasks')
        .select('priority');

      if (projectIds && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      // Aggregate by priority
      const stats = data.reduce((acc, task) => {
        const priority = task.priority || 'unknown';
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      }, {});

      // Convert to array format
      const result = Object.entries(stats).map(([priority, count]) => ({
        priority,
        count
      }));

      return { data: result, error: null };
    } catch (error) {
      console.error('Error in getTaskStatisticsByPriority:', error);
      return { data: null, error };
    }
  }

  /**
   * Get task statistics by user
   */
  async getTaskStatisticsByUser(userIds) {
    try {
      const { data, error } = await this.getTasksForReport({ userIds });

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error in getTaskStatisticsByUser:', error);
      return { data: null, error };
    }
  }
}

module.exports = new ReportRepository();
