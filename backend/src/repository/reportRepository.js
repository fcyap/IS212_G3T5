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

  /**
   * Get all departments from users table
   */
  async getAllDepartments() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('department')
        .not('department', 'is', null);

      if (error) {
        return { data: null, error };
      }

      // Extract unique departments
      const uniqueDepartments = [...new Set(data.map(u => u.department))].sort();
      
      return { data: uniqueDepartments, error: null };
    } catch (error) {
      console.error('Error in getAllDepartments:', error);
      return { data: null, error };
    }
  }

  /**
   * Get department comparison data - tasks grouped by department
   * @param {Object} filters - { departmentIds: [], startDate, endDate, projectIds: [] }
   */
  async getDepartmentComparison(filters = {}) {
    try {
      // Get users from specified departments
      let userQuery = supabase
        .from('users')
        .select('id, name, department');

      if (filters.departmentIds && filters.departmentIds.length > 0) {
        // Match department exactly or as a parent in hierarchy
        const departmentConditions = filters.departmentIds.map(dept => 
          `department.eq.${dept},department.like.${dept}.%`
        ).join(',');
        userQuery = userQuery.or(departmentConditions);
      }

      const { data: users, error: userError } = await userQuery;

      if (userError) {
        return { data: null, error: userError };
      }

      if (!users || users.length === 0) {
        return { data: [], error: null };
      }

      // Group users by top-level department
      const usersByDepartment = users.reduce((acc, user) => {
        const topLevelDept = user.department.split('.')[0];
        if (!acc[topLevelDept]) {
          acc[topLevelDept] = [];
        }
        acc[topLevelDept].push(user.id);
        return acc;
      }, {});

      // Get tasks for these users (with projectIds filter)
      const userIds = users.map(u => u.id);
      const { data: tasks, error: taskError } = await this.getTasksForReport({
        userIds,
        startDate: filters.startDate,
        endDate: filters.endDate,
        projectIds: filters.projectIds
      });

      if (taskError) {
        return { data: null, error: taskError };
      }

      // Calculate statistics per department
      const departmentStats = Object.entries(usersByDepartment).map(([department, deptUserIds]) => {
        const deptTasks = tasks.filter(task => {
          if (!task.assigned_to) return false;
          const assignedArray = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
          return assignedArray.some(userId => deptUserIds.includes(userId));
        });

        const statusCounts = {
          pending: deptTasks.filter(t => t.status === 'pending').length,
          in_progress: deptTasks.filter(t => t.status === 'in_progress').length,
          completed: deptTasks.filter(t => t.status === 'completed').length,
          cancelled: deptTasks.filter(t => t.status === 'cancelled').length
        };

        const priorityCounts = {
          low: deptTasks.filter(t => t.priority === 'low').length,
          medium: deptTasks.filter(t => t.priority === 'medium').length,
          high: deptTasks.filter(t => t.priority === 'high').length
        };

        const totalTasks = deptTasks.length;
        const completionRate = totalTasks > 0 
          ? Math.round((statusCounts.completed / totalTasks) * 100) 
          : 0;

        return {
          department,
          totalTasks,
          memberCount: deptUserIds.length,
          statusCounts,
          priorityCounts,
          completionRate,
          averageTasksPerMember: deptUserIds.length > 0 
            ? Math.round((totalTasks / deptUserIds.length) * 10) / 10 
            : 0
        };
      });

      return { data: departmentStats, error: null };
    } catch (error) {
      console.error('Error in getDepartmentComparison:', error);
      return { data: null, error };
    }
  }

  /**
   * Get weekly or monthly statistics for tasks
   * @param {Object} filters - { userIds: [], projectIds: [], startDate, endDate, interval: 'week'|'month' }
   */
  async getWeeklyMonthlyStats(filters = {}) {
    try {
      const { data: tasks, error } = await this.getTasksForReport({
        userIds: filters.userIds,
        projectIds: filters.projectIds,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      if (error) {
        return { data: null, error };
      }

      const interval = filters.interval || 'week';
      
      // Group tasks by time period
      const groupedByPeriod = tasks.reduce((acc, task) => {
        const date = new Date(task.created_at);
        let periodKey;

        if (interval === 'month') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          // Week: use ISO week number
          const startOfYear = new Date(date.getFullYear(), 0, 1);
          const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
          periodKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        }

        if (!acc[periodKey]) {
          acc[periodKey] = [];
        }
        acc[periodKey].push(task);
        return acc;
      }, {});

      // Calculate stats for each period
      const periodStats = Object.entries(groupedByPeriod)
        .map(([period, periodTasks]) => {
          const statusCounts = {
            pending: periodTasks.filter(t => t.status === 'pending').length,
            in_progress: periodTasks.filter(t => t.status === 'in_progress').length,
            completed: periodTasks.filter(t => t.status === 'completed').length,
            cancelled: periodTasks.filter(t => t.status === 'cancelled').length
          };

          const priorityCounts = {
            low: periodTasks.filter(t => t.priority === 'low').length,
            medium: periodTasks.filter(t => t.priority === 'medium').length,
            high: periodTasks.filter(t => t.priority === 'high').length
          };

          return {
            period,
            totalTasks: periodTasks.length,
            statusCounts,
            priorityCounts,
            completionRate: periodTasks.length > 0
              ? Math.round((statusCounts.completed / periodTasks.length) * 100)
              : 0
          };
        })
        .sort((a, b) => a.period.localeCompare(b.period));

      return { data: periodStats, error: null };
    } catch (error) {
      console.error('Error in getWeeklyMonthlyStats:', error);
      return { data: null, error };
    }
  }
}

module.exports = new ReportRepository();
