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
        const doc = new PDFDocument({ 
          margin: 50,
          bufferPages: true,
          autoFirstPage: true,
          compress: true
        });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve({
            format: 'pdf',
            data: pdfBuffer,
            filename: `report-${new Date().toISOString().split('T')[0]}.pdf`
          });
        });

        // Detect report type
        const isDepartmentalReport = reportData.reportType === 'departmental_performance' || reportData.departments;
        const isTaskReport = reportData.tasks;

      // Header
      const reportTitle = isDepartmentalReport ? 'Departmental Performance Report' : 'Task & Progress Report';
      doc.fontSize(24);
      doc.fillColor('#2563eb');
      doc.text(reportTitle, { align: 'center' });
      
      const generatedDate = new Date().toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.fontSize(10);
      doc.fillColor('#6b7280');
      doc.text(`Generated on: ${generatedDate}`, { align: 'center' });
        
        doc.moveDown(2);

        if (isDepartmentalReport) {
          // Export Departmental Report
          this._exportDepartmentalReportToPDF(doc, reportData);
        } else if (isTaskReport) {
          // Export Task Report (existing logic)
          this._exportTaskReportToPDF(doc, reportData);
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
   * Helper: Export task report to PDF
   */
  _exportTaskReportToPDF(doc, reportData) {
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
      
      doc.fontSize(12);
      doc.fillColor('#2563eb');
      doc.text('Total Tasks', 60, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20);
      doc.fillColor('#1f2937');
      doc.text(String(reportData.summary.totalTasks || 0), 60, summaryY + 35, { width: cardWidth - 20 });
      
      // Completed Card
      const col2X = 50 + cardWidth + cardSpacing;
      doc.rect(col2X, summaryY, cardWidth, 60)
         .fillAndStroke('#f0fdf4', '#10b981');
      
      doc.fontSize(12);
      doc.fillColor('#10b981');
      doc.text('Completed', col2X + 10, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20);
      doc.fillColor('#1f2937');
      doc.text(String(reportData.summary.byStatus?.completed || 0), col2X + 10, summaryY + 35, { width: cardWidth - 20 });
      
      // In Progress Card
      const col3X = col2X + cardWidth + cardSpacing;
      doc.rect(col3X, summaryY, cardWidth, 60)
         .fillAndStroke('#eff6ff', '#3b82f6');
      
      doc.fontSize(12);
      doc.fillColor('#3b82f6');
      doc.text('In Progress', col3X + 10, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20);
      doc.fillColor('#1f2937');
      doc.text(String(reportData.summary.byStatus?.in_progress || 0), col3X + 10, summaryY + 35, { width: cardWidth - 20 });
      
      // Pending Card
      const col4X = col3X + cardWidth + cardSpacing;
      doc.rect(col4X, summaryY, cardWidth, 60)
         .fillAndStroke('#fef3c7', '#f59e0b');
      
      doc.fontSize(12);
      doc.fillColor('#f59e0b');
      doc.text('Pending', col4X + 10, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20);
      doc.fillColor('#1f2937');
      doc.text(String(reportData.summary.byStatus?.pending || 0), col4X + 10, summaryY + 35, { width: cardWidth - 20 });
      
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

      // Table Rows
      reportData.tasks.forEach((task, index) => {
        if (currentY > 700) {
          doc.addPage();
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

        doc.fontSize(8);
        doc.fillColor('#374151');
        doc.text(`#${task.id}`, col1 + 5, currentY + 8, { width: 25, ellipsis: true });
        doc.text(task.title.substring(0, 30) + (task.title.length > 30 ? '...' : ''), col2 + 5, currentY + 8, { width: 155, ellipsis: true });
        doc.text((task.project_name || 'N/A').substring(0, 18), col3 + 5, currentY + 8, { width: 95, ellipsis: true });

        const statusColors = {
          completed: '#10b981',
          in_progress: '#3b82f6',
          pending: '#f59e0b',
          blocked: '#ef4444'
        };
        
        const statusText = (task.status || 'N/A').replace('_', ' ').toUpperCase();
        doc.fillColor(statusColors[task.status] || '#6b7280');
        doc.text(statusText, col4 + 5, currentY + 8, { width: 80, ellipsis: true });

        doc.fillColor('#374151');
        doc.text((task.priority || 'N/A').toUpperCase(), col5 + 5, currentY + 8, { width: 60, ellipsis: true });
        doc.text(task.deadline || 'N/A', col6 + 5, currentY + 8, { width: 100, ellipsis: true });

        currentY += rowHeight;
      });
    }
  }

  /**
   * Helper: Export departmental report to PDF
   */
  _exportDepartmentalReportToPDF(doc, reportData) {
    // Summary Section
    if (reportData.summary) {
      doc.fontSize(16)
         .fillColor('#1f2937')
         .text('Summary', { underline: true });
      
      doc.moveDown(0.5);
      
      const summaryY = Number(doc.y);
      const cardWidth = 120;
      const cardSpacing = 20;
      
      // Total Departments
      doc.rect(50, summaryY, cardWidth, 60)
         .fillAndStroke('#eff6ff', '#2563eb');
      
      doc.fontSize(11)
         .fillColor('#2563eb');
      doc.text('Departments', 60, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20)
         .fillColor('#1f2937');
      doc.text(String(reportData.summary.totalDepartments || 0), 60, summaryY + 35, { width: cardWidth - 20 });
      
      // Total Members
      const col2X = 50 + cardWidth + cardSpacing;
      doc.rect(col2X, summaryY, cardWidth, 60)
         .fillAndStroke('#f5f3ff', '#8b5cf6');
      
      doc.fontSize(11)
         .fillColor('#8b5cf6');
      doc.text('Total Members', col2X + 10, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20)
         .fillColor('#1f2937');
      doc.text(String(reportData.summary.totalMembers || 0), col2X + 10, summaryY + 35, { width: cardWidth - 20 });
      
      // Total Tasks
      const col3X = col2X + cardWidth + cardSpacing;
      doc.rect(col3X, summaryY, cardWidth, 60)
         .fillAndStroke('#eff6ff', '#3b82f6');
      
      doc.fontSize(11)
         .fillColor('#3b82f6');
      doc.text('Total Tasks', col3X + 10, summaryY + 15, { width: cardWidth - 20 });
      
      doc.fontSize(20)
         .fillColor('#1f2937');
      doc.text(String(reportData.summary.totalTasks || 0), col3X + 10, summaryY + 35, { width: cardWidth - 20 });
      
      // Avg Completion
      const col4X = col3X + cardWidth + cardSpacing;
      doc.rect(col4X, summaryY, cardWidth, 60)
         .fillAndStroke('#f0fdf4', '#10b981');
      
      doc.fontSize(11)
         .fillColor('#10b981');
      doc.text('Avg Completion', col4X + 10, summaryY + 15, { width: cardWidth - 20 });
      
      const avgRate = Number(reportData.summary.averageCompletionRate || 0);
      doc.fontSize(20)
         .fillColor('#1f2937');
      doc.text(`${avgRate.toFixed(1)}%`, col4X + 10, summaryY + 35, { width: cardWidth - 20 });
      
      doc.y = summaryY + 80;
      doc.moveDown(2);

      // Insights
      if (reportData.insights) {
        doc.fontSize(14)
           .fillColor('#1f2937')
           .text('Key Insights', { underline: true });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .fillColor('#374151')
           .text(`Most Productive: ${reportData.insights.mostProductiveDepartment || 'N/A'}`)
           .text(`Highest Workload: ${reportData.insights.highestWorkloadDepartment || 'N/A'}`)
           .text(`Needs Attention: ${reportData.insights.leastProductiveDepartment || 'N/A'}`);
        
        doc.moveDown(1.5);
      }
    }

    // Department Comparison Table
    if (reportData.departments && reportData.departments.length > 0) {
      doc.fontSize(16)
         .fillColor('#1f2937')
         .text('Department Comparison', { underline: true });
      
      doc.moveDown(1);

      const tableTop = doc.y;
      const col1 = 50;   // Department
      const col2 = 150;  // Members
      const col3 = 210;  // Total Tasks
      const col4 = 280;  // Completed
      const col5 = 350;  // In Progress
      const col6 = 430;  // Completion %
      const col7 = 510;  // Avg/Member
      const rowHeight = 25;

      doc.rect(col1, tableTop, 545, rowHeight)
         .fillAndStroke('#f3f4f6', '#d1d5db');

      doc.fontSize(8)
         .fillColor('#374151')
         .text('Department', col1 + 5, tableTop + 8, { width: 95 })
         .text('Members', col2 + 5, tableTop + 8, { width: 55 })
         .text('Tasks', col3 + 5, tableTop + 8, { width: 65 })
         .text('Done', col4 + 5, tableTop + 8, { width: 65 })
         .text('Progress', col5 + 5, tableTop + 8, { width: 75 })
         .text('Rate', col6 + 5, tableTop + 8, { width: 75 })
         .text('Avg/M', col7 + 5, tableTop + 8, { width: 80 });

      let currentY = tableTop + rowHeight;

      reportData.departments.forEach((dept, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          doc.rect(col1, currentY, 545, rowHeight)
             .fillAndStroke('#f3f4f6', '#d1d5db');

          doc.fontSize(8)
             .fillColor('#374151')
             .text('Department', col1 + 5, currentY + 8, { width: 95 })
             .text('Members', col2 + 5, currentY + 8, { width: 55 })
             .text('Tasks', col3 + 5, currentY + 8, { width: 65 })
             .text('Done', col4 + 5, currentY + 8, { width: 65 })
             .text('Progress', col5 + 5, currentY + 8, { width: 75 })
             .text('Rate', col6 + 5, currentY + 8, { width: 75 })
             .text('Avg/M', col7 + 5, currentY + 8, { width: 80 });

          currentY += rowHeight;
        }

        const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(col1, currentY, 545, rowHeight)
           .fillAndStroke(rowColor, '#e5e7eb');

        const deptName = (dept.department || 'N/A').substring(0, 20);
        doc.fontSize(8);
        doc.fillColor('#374151');
        doc.text(deptName, col1 + 5, currentY + 8, { width: 95, ellipsis: true });
        doc.text(String(dept.memberCount || 0), col2 + 5, currentY + 8, { width: 55 });
        doc.text(String(dept.totalTasks || 0), col3 + 5, currentY + 8, { width: 65 });
        doc.text(String(dept.statusCounts?.completed || 0), col4 + 5, currentY + 8, { width: 65 });
        doc.text(String(dept.statusCounts?.in_progress || 0), col5 + 5, currentY + 8, { width: 75 });

        const rateColor = dept.completionRate >= 70 ? '#10b981' : dept.completionRate >= 40 ? '#f59e0b' : '#ef4444';
        doc.fillColor(rateColor);
        doc.text(`${dept.completionRate || 0}%`, col6 + 5, currentY + 8, { width: 75 });

        doc.fillColor('#374151');
        doc.text(String(dept.averageTasksPerMember || 0), col7 + 5, currentY + 8, { width: 80 });

        currentY += rowHeight;
      });

      doc.moveDown(2);
    }

    // Time Series Section
    if (reportData.timeSeries && reportData.timeSeries.length > 0) {
      doc.fontSize(16)
         .fillColor('#1f2937')
         .text('Productivity Trends', { underline: true });
      
      doc.moveDown(1);

      const tableTop = doc.y;
      const col1 = 50;   // Period
      const col2 = 150;  // Total
      const col3 = 220;  // Completed
      const col4 = 290;  // In Progress
      const col5 = 370;  // Pending
      const col6 = 450;  // Rate
      const rowHeight = 25;

      doc.rect(col1, tableTop, 495, rowHeight)
         .fillAndStroke('#f3f4f6', '#d1d5db');

      doc.fontSize(8)
         .fillColor('#374151')
         .text('Period', col1 + 5, tableTop + 8, { width: 95 })
         .text('Total', col2 + 5, tableTop + 8, { width: 65 })
         .text('Completed', col3 + 5, tableTop + 8, { width: 65 })
         .text('In Progress', col4 + 5, tableTop + 8, { width: 75 })
         .text('Pending', col5 + 5, tableTop + 8, { width: 75 })
         .text('Rate', col6 + 5, tableTop + 8, { width: 90 });

      let currentY = tableTop + rowHeight;

      reportData.timeSeries.forEach((period, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(col1, currentY, 495, rowHeight)
           .fillAndStroke(rowColor, '#e5e7eb');

        doc.fontSize(8);
        doc.fillColor('#374151');
        doc.text(String(period.period || 'N/A'), col1 + 5, currentY + 8, { width: 95, ellipsis: true });
        doc.text(String(period.totalTasks || 0), col2 + 5, currentY + 8, { width: 65 });
        doc.text(String(period.statusCounts?.completed || 0), col3 + 5, currentY + 8, { width: 65 });
        doc.text(String(period.statusCounts?.in_progress || 0), col4 + 5, currentY + 8, { width: 75 });
        doc.text(String(period.statusCounts?.pending || 0), col5 + 5, currentY + 8, { width: 75 });

        const rateColor = period.completionRate >= 70 ? '#10b981' : period.completionRate >= 40 ? '#f59e0b' : '#ef4444';
        doc.fillColor(rateColor);
        doc.text(`${period.completionRate || 0}%`, col6 + 5, currentY + 8, { width: 90 });

        currentY += rowHeight;
      });
    }
  }

  /**
   * Export report to spreadsheet (XLSX or CSV)
   */
  async exportReportToSpreadsheet(reportData, format = 'xlsx') {
    try {
      // Detect report type
      const isDepartmentalReport = reportData.reportType === 'departmental_performance' || reportData.departments;
      const workbook = XLSX.utils.book_new();

      if (isDepartmentalReport) {
        // Export Departmental Report
        // Sheet 1: Summary
        if (reportData.summary) {
          const summaryData = [
            ['Metric', 'Value'],
            ['Total Departments', Number(reportData.summary.totalDepartments || 0)],
            ['Total Members', Number(reportData.summary.totalMembers || 0)],
            ['Total Tasks', Number(reportData.summary.totalTasks || 0)],
            ['Average Completion Rate', `${Number(reportData.summary.averageCompletionRate || 0).toFixed(1)}%`]
          ];

          if (reportData.insights) {
            summaryData.push([]);
            summaryData.push(['Insights', '']);
            summaryData.push(['Most Productive Department', String(reportData.insights.mostProductiveDepartment || 'N/A')]);
            summaryData.push(['Highest Workload Department', String(reportData.insights.highestWorkloadDepartment || 'N/A')]);
            summaryData.push(['Needs Attention', String(reportData.insights.leastProductiveDepartment || 'N/A')]);
          }

          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        }

        // Sheet 2: Department Comparison
        if (reportData.departments && reportData.departments.length > 0) {
          const deptData = reportData.departments.map(dept => ({
            'Department': String(dept.department || 'N/A'),
            'Members': Number(dept.memberCount || 0),
            'Total Tasks': Number(dept.totalTasks || 0),
            'Completed': Number(dept.statusCounts?.completed || 0),
            'In Progress': Number(dept.statusCounts?.in_progress || 0),
            'Pending': Number(dept.statusCounts?.pending || 0),
            'Cancelled': Number(dept.statusCounts?.cancelled || 0),
            'Completion Rate': `${Number(dept.completionRate || 0).toFixed(1)}%`,
            'Avg Tasks Per Member': Number(dept.averageTasksPerMember || 0).toFixed(2),
            'Low Priority': Number(dept.priorityCounts?.low || 0),
            'Medium Priority': Number(dept.priorityCounts?.medium || 0),
            'High Priority': Number(dept.priorityCounts?.high || 0)
          }));

          const deptSheet = XLSX.utils.json_to_sheet(deptData);
          XLSX.utils.book_append_sheet(workbook, deptSheet, 'Departments');
        }

        // Sheet 3: Time Series (if available)
        if (reportData.timeSeries && reportData.timeSeries.length > 0) {
          const timeSeriesData = reportData.timeSeries.map(period => ({
            'Period': String(period.period || 'N/A'),
            'Total Tasks': Number(period.totalTasks || 0),
            'Completed': Number(period.statusCounts?.completed || 0),
            'In Progress': Number(period.statusCounts?.in_progress || 0),
            'Pending': Number(period.statusCounts?.pending || 0),
            'Cancelled': Number(period.statusCounts?.cancelled || 0),
            'Completion Rate': `${Number(period.completionRate || 0).toFixed(1)}%`,
            'Low Priority': Number(period.priorityCounts?.low || 0),
            'Medium Priority': Number(period.priorityCounts?.medium || 0),
            'High Priority': Number(period.priorityCounts?.high || 0)
          }));

          const timeSeriesSheet = XLSX.utils.json_to_sheet(timeSeriesData);
          XLSX.utils.book_append_sheet(workbook, timeSeriesSheet, 'Trends');
        }
      } else {
        // Export Task Report (original logic)
        const tasks = reportData.tasks || [];
        
        const worksheetData = tasks.map(task => ({
          'ID': Number(task.id || 0),
          'Title': String(task.title || ''),
          'Status': String((task.status || 'N/A').replace('_', ' ').toUpperCase()),
          'Priority': String((task.priority || 'N/A').toUpperCase()),
          'Deadline': String(task.deadline || ''),
          'Created At': String(task.created_at || ''),
          'Project ID': Number(task.project_id || 0),
          'Project Name': String(task.project_name || '')
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

        // Add summary sheet
        if (reportData.summary) {
          const summaryData = [
            ['Metric', 'Count'],
            ['Total Tasks', Number(reportData.summary.totalTasks || 0)],
            ['Completed', Number(reportData.summary.byStatus?.completed || 0)],
            ['In Progress', Number(reportData.summary.byStatus?.in_progress || 0)],
            ['Pending', Number(reportData.summary.byStatus?.pending || 0)],
            ['Blocked', Number(reportData.summary.byStatus?.blocked || 0)]
          ];

          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        }
      }

      // Generate buffer with proper encoding
      const buffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: format === 'csv' ? 'csv' : 'xlsx',
        bookSST: true,
        compression: true
      });

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
   * Generate departmental performance report
   * Provides weekly/monthly summaries with inter-departmental comparisons
   * POST /api/reports/departments
   */
  async generateDepartmentalPerformanceReport(user, filters = {}) {
    // Verify user has permission (HR or Admin only)
    if (!user || (user.role !== 'hr' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only HR and Admin staff can generate departmental reports');
    }

    // Determine which departments to include
    let departmentIds = filters.departmentIds || [];
    
    if (user.role === 'admin') {
      // Admin can see all departments or filter specific ones
      if (!departmentIds || departmentIds.length === 0) {
        const { data: allDepartments } = await reportRepository.getAllDepartments();
        departmentIds = allDepartments || [];
      }
    } else {
      // HR can only see their own department hierarchy
      const { data: deptUsers } = await reportRepository.getUsersByDepartmentHierarchy(user.department);
      const hrDepartments = [...new Set(deptUsers.map(u => u.department))];
      
      // If they specified departments, filter to only accessible ones
      if (departmentIds.length > 0) {
        departmentIds = departmentIds.filter(dept => 
          hrDepartments.some(hrDept => dept === hrDept || dept.startsWith(hrDept + '.'))
        );
      } else {
        departmentIds = hrDepartments;
      }
    }

    // Get department comparison data
    const { data: departmentComparison, error: compError } = await reportRepository.getDepartmentComparison({
      departmentIds,
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectIds: filters.projectIds
    });

    if (compError) {
      throw new Error(compError.message || 'Failed to fetch department comparison data');
    }

    // Get time-series data if requested
    let timeSeriesData = null;
    if (filters.interval && (filters.interval === 'week' || filters.interval === 'month')) {
      // Get all users from selected departments
      const { data: deptUsers } = await reportRepository.getDepartmentComparison({
        departmentIds,
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      // Extract user IDs (would need to be fetched properly in production)
      const { data: timeStats, error: timeError } = await reportRepository.getWeeklyMonthlyStats({
        startDate: filters.startDate,
        endDate: filters.endDate,
        interval: filters.interval,
        projectIds: filters.projectIds
      });

      if (timeError) {
        throw new Error(timeError.message || 'Failed to fetch time-series data');
      }

      timeSeriesData = timeStats;
    }

    // Calculate overall summary statistics
    const summary = {
      totalDepartments: departmentComparison.length,
      totalTasks: departmentComparison.reduce((sum, dept) => sum + dept.totalTasks, 0),
      totalMembers: departmentComparison.reduce((sum, dept) => sum + dept.memberCount, 0),
      averageCompletionRate: departmentComparison.length > 0
        ? Math.round(departmentComparison.reduce((sum, dept) => sum + dept.completionRate, 0) / departmentComparison.length)
        : 0,
      overallStatusCounts: departmentComparison.reduce((acc, dept) => ({
        pending: (acc.pending || 0) + dept.statusCounts.pending,
        in_progress: (acc.in_progress || 0) + dept.statusCounts.in_progress,
        completed: (acc.completed || 0) + dept.statusCounts.completed,
        cancelled: (acc.cancelled || 0) + dept.statusCounts.cancelled
      }), {}),
      overallPriorityCounts: departmentComparison.reduce((acc, dept) => ({
        low: (acc.low || 0) + dept.priorityCounts.low,
        medium: (acc.medium || 0) + dept.priorityCounts.medium,
        high: (acc.high || 0) + dept.priorityCounts.high
      }), {})
    };

    // Identify productivity insights
    const insights = {
      mostProductiveDepartment: departmentComparison.length > 0
        ? departmentComparison.reduce((max, dept) => 
            dept.completionRate > (max?.completionRate || 0) ? dept : max
          , null)?.department
        : null,
      leastProductiveDepartment: departmentComparison.length > 0
        ? departmentComparison.reduce((min, dept) => 
            dept.completionRate < (min?.completionRate || 100) ? dept : min
          , null)?.department
        : null,
      highestWorkloadDepartment: departmentComparison.length > 0
        ? departmentComparison.reduce((max, dept) => 
            dept.averageTasksPerMember > (max?.averageTasksPerMember || 0) ? dept : max
          , null)?.department
        : null
    };

    return {
      summary,
      departments: departmentComparison,
      timeSeries: timeSeriesData,
      insights,
      filters: {
        departmentIds,
        startDate: filters.startDate,
        endDate: filters.endDate,
        interval: filters.interval
      },
      generatedAt: new Date().toISOString(),
      generatedBy: user.id,
      reportType: 'departmental_performance'
    };
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
