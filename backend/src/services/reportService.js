const reportRepository = require('../repository/reportRepository');
const userRepository = require('../repository/userRepository');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

/**
 * Report Service - Contains business logic for report operations
 * This layer orchestrates data from repositories and applies business rules
 */
class ReportService {

  /**
   * Generate comprehensive task report
   */
  async generateTaskReport(user, filters = {}) {
    // RBAC middleware already verified permissions
    // Admin can see all data, HR can see their department hierarchy
    
    let userIds = [];
    let projectIds = [];

    if (user.role === 'admin') {
      // Admin sees all - leave filters empty for no restrictions
      // Apply user-provided filters if any
      if (filters.userIds && filters.userIds.length > 0) {
        userIds = filters.userIds;
      }
      if (filters.projectIds && filters.projectIds.length > 0) {
        projectIds = filters.projectIds;
      }
    } else {
      // HR sees only their department hierarchy
      const { data: departmentUsers, error: userError } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
      
      if (userError) {
        throw new Error(userError.message || 'Failed to fetch department users');
      }

      const allDepartmentUserIds = departmentUsers.map(u => u.id);

      // Get projects in the department
      const { data: departmentProjects, error: projectError } = await reportRepository.getProjectsByDepartment(allDepartmentUserIds);
      
      if (projectError) {
        throw new Error(projectError.message || 'Failed to fetch department projects');
      }

      const allDepartmentProjectIds = departmentProjects.map(p => p.id);

      // Apply user-provided filters within department scope
      userIds = filters.userIds && filters.userIds.length > 0 
        ? filters.userIds.filter(id => allDepartmentUserIds.includes(id))
        : allDepartmentUserIds;
      
      projectIds = filters.projectIds && filters.projectIds.length > 0
        ? filters.projectIds.filter(id => allDepartmentProjectIds.includes(id))
        : allDepartmentProjectIds;
    }

    // Build report filters
    const reportFilters = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      userIds: userIds.length > 0 ? userIds : undefined
    };

    // Get tasks based on filters
    const { data: tasks, error: taskError } = await reportRepository.getTasksForReport(reportFilters);
    
    if (taskError) {
      throw new Error(taskError.message || 'Failed to fetch tasks');
    }

    // Flatten project name for easier access
    const tasksWithProjectName = (tasks || []).map(task => ({
      ...task,
      project_name: task.projects?.name || null
    }));

    // Calculate summary statistics
    const summary = this._calculateTaskSummary(tasksWithProjectName);

    return {
      summary,
      tasks: tasksWithProjectName,
      filters: reportFilters,
      generatedAt: new Date().toISOString(),
      generatedBy: user.id,
      department: user.department
    };
  }

  /**
   * Generate user productivity report
   */
  async generateUserProductivityReport(user, filters = {}) {
    // Verify user has permission (HR or Admin only)
    if (!user || (user.role !== 'hr' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only HR and Admin staff can generate reports');
    }

    // Get users in the department hierarchy
    const { data: departmentUsers, error: userError } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
    
    if (userError) {
      throw new Error(userError.message || 'Failed to fetch department users');
    }

    // Filter to specific users if provided
    let targetUsers = departmentUsers;
    if (filters.userIds && filters.userIds.length > 0) {
      targetUsers = departmentUsers.filter(u => filters.userIds.includes(u.id));
    }

    // Get tasks for analysis
    const userIds = targetUsers.map(u => u.id);
    const { data: tasks, error: taskError } = await reportRepository.getTasksForReport({
      userIds,
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    
    if (taskError) {
      throw new Error(taskError.message || 'Failed to fetch tasks');
    }

    // Calculate per-user statistics
    const userStats = targetUsers.map(targetUser => {
      const userTasks = tasks.filter(task => {
        if (!task.assigned_to) return false;
        const assignedArray = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
        return assignedArray.includes(targetUser.id);
      });

      const completedTasks = userTasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = userTasks.filter(t => t.status === 'in_progress').length;
      const pendingTasks = userTasks.filter(t => t.status === 'pending').length;
      const totalTasks = userTasks.length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        userId: targetUser.id,
        userName: targetUser.name,
        userEmail: targetUser.email,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        completionRate
      };
    });

    return {
      users: userStats,
      summary: {
        totalUsers: userStats.length,
        averageCompletionRate: userStats.length > 0 
          ? Math.round(userStats.reduce((sum, u) => sum + u.completionRate, 0) / userStats.length)
          : 0
      },
      filters,
      generatedAt: new Date().toISOString(),
      generatedBy: user.id
    };
  }

  /**
   * Generate project report
   */
  async generateProjectReport(user, filters = {}) {
    // Verify user has permission (HR or Admin only)
    if (!user || (user.role !== 'hr' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only HR and Admin staff can generate reports');
    }

    // Get users in the department hierarchy
    const { data: departmentUsers, error: userError } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
    
    if (userError) {
      throw new Error(userError.message || 'Failed to fetch department users');
    }

    const userIds = departmentUsers.map(u => u.id);

    // Get projects in the department
    const { data: departmentProjects, error: projectError } = await reportRepository.getProjectsByDepartment(userIds);
    
    if (projectError) {
      throw new Error(projectError.message || 'Failed to fetch department projects');
    }

    // Filter to specific projects if provided
    let targetProjects = departmentProjects;
    if (filters.projectIds && filters.projectIds.length > 0) {
      targetProjects = departmentProjects.filter(p => filters.projectIds.includes(p.id));
    }

    // Get all tasks for these projects
    const projectIds = targetProjects.map(p => p.id);
    const { data: tasks, error: taskError } = await reportRepository.getTasksForReport({
      projectIds,
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    
    if (taskError) {
      throw new Error(taskError.message || 'Failed to fetch tasks');
    }

    // Calculate per-project statistics
    const projectStats = targetProjects.map(project => {
      const projectTasks = tasks.filter(t => t.project_id === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length;
      const pendingTasks = projectTasks.filter(t => t.status === 'pending').length;
      const totalTasks = projectTasks.length;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        projectId: project.id,
        projectName: project.name,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        progressPercentage
      };
    });

    return {
      projects: projectStats,
      summary: {
        totalProjects: projectStats.length,
        averageProgress: projectStats.length > 0
          ? Math.round(projectStats.reduce((sum, p) => sum + p.progressPercentage, 0) / projectStats.length)
          : 0
      },
      filters,
      generatedAt: new Date().toISOString(),
      generatedBy: user.id
    };
  }

  /**
   * Export report to PDF
   */
  async exportReportToPDF(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve({
            format: 'pdf',
            data: pdfBuffer,
            filename: `task-report-${new Date().toISOString().split('T')[0]}.pdf`
          });
        });

        // Header
        doc.fontSize(24)
           .fillColor('#2563eb')
           .text('Task & Progress Report', { align: 'center' });
        
        doc.fontSize(10)
           .fillColor('#6b7280')
           .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        
        doc.moveDown(2);

        // Summary Section
        if (reportData.summary) {
          doc.fontSize(16)
             .fillColor('#1f2937')
             .text('Summary', { underline: true });
          
          doc.moveDown(0.5);
          
          // Summary cards layout
          const summaryY = doc.y;
          const cardWidth = 120;
          const cardSpacing = 20;
          
          // Total Tasks Card
          doc.rect(50, summaryY, cardWidth, 60)
             .fillAndStroke('#eff6ff', '#2563eb');
          
          doc.fontSize(12)
             .fillColor('#2563eb')
             .text('Total Tasks', 60, summaryY + 15, { width: cardWidth - 20 });
          
          doc.fontSize(20)
             .fillColor('#1f2937')
             .text(reportData.summary.totalTasks || 0, 60, summaryY + 35, { width: cardWidth - 20 });
          
          // Completed Card
          const col2X = 50 + cardWidth + cardSpacing;
          doc.rect(col2X, summaryY, cardWidth, 60)
             .fillAndStroke('#f0fdf4', '#10b981');
          
          doc.fontSize(12)
             .fillColor('#10b981')
             .text('Completed', col2X + 10, summaryY + 15, { width: cardWidth - 20 });
          
          doc.fontSize(20)
             .fillColor('#1f2937')
             .text(reportData.summary.byStatus?.completed || 0, col2X + 10, summaryY + 35, { width: cardWidth - 20 });
          
          // In Progress Card
          const col3X = col2X + cardWidth + cardSpacing;
          doc.rect(col3X, summaryY, cardWidth, 60)
             .fillAndStroke('#eff6ff', '#3b82f6');
          
          doc.fontSize(12)
             .fillColor('#3b82f6')
             .text('In Progress', col3X + 10, summaryY + 15, { width: cardWidth - 20 });
          
          doc.fontSize(20)
             .fillColor('#1f2937')
             .text(reportData.summary.byStatus?.in_progress || 0, col3X + 10, summaryY + 35, { width: cardWidth - 20 });
          
          // Pending Card
          const col4X = col3X + cardWidth + cardSpacing;
          doc.rect(col4X, summaryY, cardWidth, 60)
             .fillAndStroke('#fef3c7', '#f59e0b');
          
          doc.fontSize(12)
             .fillColor('#f59e0b')
             .text('Pending', col4X + 10, summaryY + 15, { width: cardWidth - 20 });
          
          doc.fontSize(20)
             .fillColor('#1f2937')
             .text(reportData.summary.byStatus?.pending || 0, col4X + 10, summaryY + 35, { width: cardWidth - 20 });
          
          doc.y = summaryY + 80;
          doc.moveDown(2);
        }

        // Tasks Section
        if (reportData.tasks && reportData.tasks.length > 0) {
          doc.fontSize(16)
             .fillColor('#1f2937')
             .text('Task Details', { underline: true });
          
          doc.moveDown(1);

          // Table Header
          const tableTop = doc.y;
          const col1 = 50;   // ID
          const col2 = 80;   // Title
          const col3 = 240;  // Project
          const col4 = 340;  // Status
          const col5 = 425;  // Priority
          const col6 = 490;  // Deadline
          const rowHeight = 25;

          doc.rect(col1, tableTop, 545, rowHeight)
             .fillAndStroke('#f3f4f6', '#d1d5db');

          doc.fontSize(9)
             .fillColor('#374151')
             .text('ID', col1 + 5, tableTop + 8, { width: 25 })
             .text('Title', col2 + 5, tableTop + 8, { width: 155 })
             .text('Project', col3 + 5, tableTop + 8, { width: 95 })
             .text('Status', col4 + 5, tableTop + 8, { width: 80 })
             .text('Priority', col5 + 5, tableTop + 8, { width: 60 })
             .text('Deadline', col6 + 5, tableTop + 8, { width: 100 });

          let currentY = tableTop + rowHeight;

          // Table Rows - Show ALL tasks
          reportData.tasks.forEach((task, index) => {
            // Check if we need a new page
            if (currentY > 700) {
              doc.addPage();
              
              // Redraw table header on new page
              currentY = 50;
              doc.rect(col1, currentY, 545, rowHeight)
                 .fillAndStroke('#f3f4f6', '#d1d5db');

              doc.fontSize(9)
                 .fillColor('#374151')
                 .text('ID', col1 + 5, currentY + 8, { width: 25 })
                 .text('Title', col2 + 5, currentY + 8, { width: 155 })
                 .text('Project', col3 + 5, currentY + 8, { width: 95 })
                 .text('Status', col4 + 5, currentY + 8, { width: 80 })
                 .text('Priority', col5 + 5, currentY + 8, { width: 60 })
                 .text('Deadline', col6 + 5, currentY + 8, { width: 100 });

              currentY += rowHeight;
            }

            const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
            doc.rect(col1, currentY, 545, rowHeight)
               .fillAndStroke(rowColor, '#e5e7eb');

            doc.fontSize(8)
               .fillColor('#374151')
               .text(`#${task.id}`, col1 + 5, currentY + 8, { width: 25 })
               .text(task.title.substring(0, 25) + (task.title.length > 25 ? '...' : ''), col2 + 5, currentY + 8, { width: 155 })
               .text((task.project_name || 'N/A').substring(0, 15), col3 + 5, currentY + 8, { width: 95 });

            // Status with color
            const statusColors = {
              completed: '#10b981',
              in_progress: '#3b82f6',
              pending: '#f59e0b',
              blocked: '#ef4444'
            };
            
            doc.fillColor(statusColors[task.status] || '#6b7280')
               .text(task.status?.replace('_', ' ') || 'N/A', col4 + 5, currentY + 8, { width: 80 });

            doc.fillColor('#374151')
               .text(task.priority || 'N/A', col5 + 5, currentY + 8, { width: 60 })
               .text(task.deadline || 'N/A', col6 + 5, currentY + 8, { width: 100 });

            currentY += rowHeight;
          });
        }

        // Footer - Add page numbers
        const range = doc.bufferedPageRange();
        const pageCount = range.count;
        
        if (pageCount > 0) {
          for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(range.start + i);
            doc.fontSize(8)
               .fillColor('#9ca3af')
               .text(
                 `Page ${i + 1} of ${pageCount}`,
                 50,
                 doc.page.height - 50,
                 { align: 'center' }
               );
          }
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export report to spreadsheet (XLSX or CSV)
   */
  async exportReportToSpreadsheet(reportData, format = 'xlsx') {
    try {
      const tasks = reportData.tasks || [];
      
      // Prepare data for spreadsheet
      const worksheetData = tasks.map(task => ({
        'ID': task.id,
        'Title': task.title,
        'Status': task.status,
        'Priority': task.priority || '',
        'Deadline': task.deadline || '',
        'Created At': task.created_at || '',
        'Project ID': task.project_id || ''
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: format === 'csv' ? 'csv' : 'xlsx' });

      return {
        format: format === 'csv' ? 'csv' : 'xlsx',
        data: buffer,
        filename: `report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
      };
    } catch (error) {
      throw new Error(`Failed to generate spreadsheet: ${error.message}`);
    }
  }

  /**
   * Get available projects for filtering (based on user's department)
   */
  async getAvailableProjects(user) {
    if (user.role === 'admin') {
      // Admin sees all projects
      const supabase = require('../utils/supabase');
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');
      
      return data || [];
    }
    
    // HR sees only department hierarchy projects
    const { data: departmentUsers } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
    const userIds = departmentUsers.map(u => u.id);
    const { data: projects } = await reportRepository.getProjectsByDepartment(userIds);
    return projects || [];
  }

  /**
   * Get available users for filtering (based on user's department)
   */
  async getAvailableUsers(user) {
    if (user.role === 'admin') {
      // Admin sees all users
      const supabase = require('../utils/supabase');
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, department, role')
        .order('name');
      
      return data || [];
    }
    
    // HR sees only department hierarchy users
    const { data: users } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
    return users || [];
  }

  /**
   * Get available departments (hierarchy)
   */
  async getAvailableDepartments(user) {
    if (user.role === 'admin') {
      // Admin sees all departments
      const supabase = require('../utils/supabase');
      const { data: users, error } = await supabase
        .from('users')
        .select('department');
      
      const departments = [...new Set((users || []).map(u => u.department))];
      return departments.filter(Boolean).sort();
    }
    
    // HR sees only their department hierarchy
    const { data: users } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
    const departments = [...new Set(users.map(u => u.department))];
    return departments.filter(Boolean).sort();
  }

  /**
   * Helper: Calculate task summary statistics
   */
  _calculateTaskSummary(tasks) {
    const byStatus = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0
    };

    const byPriority = {
      low: 0,
      medium: 0,
      high: 0
    };

    tasks.forEach(task => {
      // Count by status
      const status = task.status || 'pending';
      if (byStatus.hasOwnProperty(status)) {
        byStatus[status]++;
      }

      // Count by priority
      const priority = task.priority || 'medium';
      if (byPriority.hasOwnProperty(priority)) {
        byPriority[priority]++;
      }
    });

    return {
      totalTasks: tasks.length,
      byStatus,
      byPriority
    };
  }
}

module.exports = new ReportService();
