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
    const { userIds, projectIds } = await this._getScopedFilters(user, filters);

    const reportFilters = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      userIds: userIds.length > 0 ? userIds : undefined
    };

    const { data: tasks, error: taskError } = await reportRepository.getTasksForReport(reportFilters);

    if (taskError) {
      throw new Error(taskError.message || 'Failed to fetch tasks');
    }

    const tasksWithProjectName = (tasks || []).map(task => ({
      ...task,
      project_name: task.projects?.name || null
    }));

    return {
      summary: this._calculateTaskSummary(tasksWithProjectName),
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
    this._verifyReportPermission(user);

    const { data: departmentUsers, error: userError } = await reportRepository.getUsersByDepartmentHierarchy(user.department);

    if (userError) {
      throw new Error(userError.message || 'Failed to fetch department users');
    }

    const targetUsers = filters.userIds?.length > 0
      ? departmentUsers.filter(u => filters.userIds.includes(u.id))
      : departmentUsers;

    const { data: tasks, error: taskError } = await reportRepository.getTasksForReport({
      userIds: targetUsers.map(u => u.id),
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    if (taskError) {
      throw new Error(taskError.message || 'Failed to fetch tasks');
    }

    const userStats = targetUsers.map(targetUser => this._calculateUserStats(targetUser, tasks));

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
    this._verifyReportPermission(user);

    const { userIds, projectIds } = await this._getScopedFilters(user, filters);

    const { data: departmentProjects, error: projectError } = await reportRepository.getProjectsByDepartment(userIds);

    if (projectError) {
      throw new Error(projectError.message || 'Failed to fetch department projects');
    }

    const targetProjects = projectIds.length > 0
      ? departmentProjects.filter(project => projectIds.includes(Number(project.id)))
      : departmentProjects;

    const { data: tasks, error: taskError } = await reportRepository.getTasksForReport({
      projectIds: targetProjects.map(p => p.id),
      startDate: filters.startDate,
      endDate: filters.endDate
    });

    if (taskError) {
      throw new Error(taskError.message || 'Failed to fetch tasks');
    }

    const projectStats = targetProjects.map(project => this._calculateProjectStats(project, tasks));

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
   * Generate manual time report
   */
  async generateManualTimeReport(user, filters = {}) {
    this._verifyReportPermission(user);

    const view = filters.view === 'department' ? 'department' : 'project';
    const { scopedProjectIds, scopedDepartments, hrProjectSet, hrDepartmentSet } =
      await this._getScopedManualTimeFilters(user, filters);

    // Early return if HR has no accessible resources
    if (user.role === 'hr' && scopedProjectIds.length === 0 && scopedDepartments.length === 0) {
      return this._buildManualTimeReportPayload({
        user,
        filters: { projectIds: [], departments: [], startDate: filters.startDate, endDate: filters.endDate, view },
        entries: [],
        summary: this._summarizeManualTime([]),
        view
      });
    }

    const { data: manualEntries, error } = await reportRepository.getManualTimeLogs({
      projectIds: scopedProjectIds.length > 0 ? scopedProjectIds : undefined,
      departments: scopedDepartments.length > 0 ? scopedDepartments : undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
      groupBy: view === 'department' ? 'department' : 'project'
    });

    if (error) {
      throw new Error(error.message || 'Failed to fetch manual time logs');
    }

    const sanitizedEntries = this._sanitizeManualTimeEntries(manualEntries || []);
    const filteredEntries = this._filterManualTimeEntries(sanitizedEntries, {
      projectIds: scopedProjectIds,
      departments: scopedDepartments,
      hrProjectSet,
      hrDepartmentSet,
      isHR: user.role === 'hr'
    });

    return this._buildManualTimeReportPayload({
      user,
      filters: {
        projectIds: scopedProjectIds.length > 0 ? scopedProjectIds : undefined,
        departments: scopedDepartments.length > 0 ? scopedDepartments : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        view
      },
      entries: filteredEntries,
      summary: this._summarizeManualTime(filteredEntries),
      view
    });
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
        let generatedFilename = `report-${new Date().toISOString().split('T')[0]}.pdf`;

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve({
            format: 'pdf',
            data: pdfBuffer,
            filename: generatedFilename
          });
        });

        // Detect report type
        const isDepartmentalReport = reportData.reportType === 'departmental_performance' || reportData.departments;
        const isManualTimeReport = reportData.reportType === 'manual_time' || reportData.entries;
        const isTaskReport = reportData.tasks;

        console.log('[PDF Export] Report Type Detection:', {
          reportType: reportData.reportType,
          isDepartmentalReport,
          isManualTimeReport,
          isTaskReport,
          hasDepartments: !!reportData.departments,
          hasEntries: !!reportData.entries,
          hasTasks: !!reportData.tasks
        });

      // Header
      const reportTitle = isDepartmentalReport
        ? 'Departmental Performance Report'
        : isManualTimeReport
          ? 'Logged Time Report'
          : 'Task & Progress Report';

      // Generate filename based on report type
      const dateStr = new Date().toISOString().split('T')[0];
      generatedFilename = isDepartmentalReport
        ? `departmental-performance-${dateStr}.pdf`
        : isManualTimeReport
          ? `logged-time-report-${dateStr}.pdf`
          : `task-report-${dateStr}.pdf`;

        console.log('[PDF Export] Generated filename:', generatedFilename);

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
        } else if (isManualTimeReport) {
          this._exportManualTimeReportToPDF(doc, reportData);
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
         .fillColor('#374151');
      doc.text('ID', col1 + 5, tableTop + 8, { width: 25, align: 'left' });
      doc.text('Title', col2 + 5, tableTop + 8, { width: 155, align: 'left' });
      doc.text('Project', col3 + 5, tableTop + 8, { width: 95, align: 'left' });
      doc.text('Status', col4 + 5, tableTop + 8, { width: 80, align: 'center' });
      doc.text('Priority', col5 + 5, tableTop + 8, { width: 60, align: 'center' });
      doc.text('Deadline', col6 + 5, tableTop + 8, { width: 100, align: 'center' });

      let currentY = tableTop + rowHeight;

      // Table Rows
      reportData.tasks.forEach((task, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          doc.rect(col1, currentY, 545, rowHeight)
             .fillAndStroke('#f3f4f6', '#d1d5db');

          doc.fontSize(9)
             .fillColor('#374151');
          doc.text('ID', col1 + 5, currentY + 8, { width: 25, align: 'left' });
          doc.text('Title', col2 + 5, currentY + 8, { width: 155, align: 'left' });
          doc.text('Project', col3 + 5, currentY + 8, { width: 95, align: 'left' });
          doc.text('Status', col4 + 5, currentY + 8, { width: 80, align: 'center' });
          doc.text('Priority', col5 + 5, currentY + 8, { width: 60, align: 'center' });
          doc.text('Deadline', col6 + 5, currentY + 8, { width: 100, align: 'center' });

          currentY += rowHeight;
        }

        const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(col1, currentY, 545, rowHeight)
           .fillAndStroke(rowColor, '#e5e7eb');

        doc.fontSize(8);
        doc.fillColor('#374151');
        doc.text(`#${task.id}`, col1 + 5, currentY + 8, { width: 25, ellipsis: true, align: 'left' });
        doc.text(task.title.substring(0, 30) + (task.title.length > 30 ? '...' : ''), col2 + 5, currentY + 8, { width: 155, ellipsis: true, align: 'left' });
        doc.text((task.project_name || 'N/A').substring(0, 18), col3 + 5, currentY + 8, { width: 95, ellipsis: true, align: 'left' });

        const statusColors = {
          completed: '#10b981',
          in_progress: '#3b82f6',
          pending: '#f59e0b',
          blocked: '#ef4444'
        };

        const statusText = String(task.status || 'N/A').replace('_', ' ').toUpperCase();
        doc.fillColor(statusColors[task.status] || '#6b7280');
        doc.text(statusText, col4 + 5, currentY + 8, { width: 80, ellipsis: true, align: 'center' });

        doc.fillColor('#374151');
        doc.text(String(task.priority || 'N/A').toUpperCase(), col5 + 5, currentY + 8, { width: 60, ellipsis: true, align: 'center' });
        doc.text(String(task.deadline || 'N/A'), col6 + 5, currentY + 8, { width: 100, ellipsis: true, align: 'center' });

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

      doc.fontSize(9)
         .fillColor('#374151');
      doc.text('Department', col1 + 5, tableTop + 8, { width: 95, align: 'left' });
      doc.text('Members', col2 + 5, tableTop + 8, { width: 55, align: 'center' });
      doc.text('Tasks', col3 + 5, tableTop + 8, { width: 65, align: 'center' });
      doc.text('Done', col4 + 5, tableTop + 8, { width: 65, align: 'center' });
      doc.text('Progress', col5 + 5, tableTop + 8, { width: 75, align: 'center' });
      doc.text('Rate', col6 + 5, tableTop + 8, { width: 75, align: 'center' });
      doc.text('Avg/M', col7 + 5, tableTop + 8, { width: 80, align: 'center' });

      let currentY = tableTop + rowHeight;

      reportData.departments.forEach((dept, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          doc.rect(col1, currentY, 545, rowHeight)
             .fillAndStroke('#f3f4f6', '#d1d5db');

          doc.fontSize(9)
             .fillColor('#374151');
          doc.text('Department', col1 + 5, currentY + 8, { width: 95, align: 'left' });
          doc.text('Members', col2 + 5, currentY + 8, { width: 55, align: 'center' });
          doc.text('Tasks', col3 + 5, currentY + 8, { width: 65, align: 'center' });
          doc.text('Done', col4 + 5, currentY + 8, { width: 65, align: 'center' });
          doc.text('Progress', col5 + 5, currentY + 8, { width: 75, align: 'center' });
          doc.text('Rate', col6 + 5, currentY + 8, { width: 75, align: 'center' });
          doc.text('Avg/M', col7 + 5, currentY + 8, { width: 80, align: 'center' });

          currentY += rowHeight;
        }

        const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(col1, currentY, 545, rowHeight)
           .fillAndStroke(rowColor, '#e5e7eb');

        const deptName = (dept.department || 'N/A').substring(0, 20);
        doc.fontSize(8);
        doc.fillColor('#374151');
        doc.text(deptName, col1 + 5, currentY + 8, { width: 95, ellipsis: true, align: 'left' });
        doc.text(String(dept.memberCount || 0), col2 + 5, currentY + 8, { width: 55, align: 'center' });
        doc.text(String(dept.totalTasks || 0), col3 + 5, currentY + 8, { width: 65, align: 'center' });
        doc.text(String(dept.statusCounts?.completed || 0), col4 + 5, currentY + 8, { width: 65, align: 'center' });
        doc.text(String(dept.statusCounts?.in_progress || 0), col5 + 5, currentY + 8, { width: 75, align: 'center' });

        const rateColor = dept.completionRate >= 70 ? '#10b981' : dept.completionRate >= 40 ? '#f59e0b' : '#ef4444';
        doc.fillColor(rateColor);
        doc.text(`${dept.completionRate || 0}%`, col6 + 5, currentY + 8, { width: 75, align: 'center' });

        doc.fillColor('#374151');
        doc.text(String(dept.averageTasksPerMember || 0), col7 + 5, currentY + 8, { width: 80, align: 'center' });

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
   * Helper: Export manual time report to PDF
   */
  _exportManualTimeReportToPDF(doc, reportData) {
    const summary = reportData.summary || {};
    const entries = Array.isArray(reportData.entries) ? reportData.entries : [];
    const filters = reportData.filters || {};
    const view = filters.view === 'department' ? 'department' : 'project';
    const aggregated = view === 'department'
      ? summary.byDepartment || []
      : summary.byProject || [];

    const formatHours = (value) => this._roundToTwo(value || 0).toFixed(2);
    const formatDate = (value) => {
      if (!value) return 'N/A';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toISOString().split('T')[0];
    };

    // Summary Section
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text('Summary', { underline: true });

    doc.moveDown(0.5);

    const summaryY = doc.y;
    const cardWidth = 150;
    const cardHeight = 60;
    const cardSpacing = 20;

    // Total Hours Card
    doc.rect(50, summaryY, cardWidth, cardHeight)
       .fillAndStroke('#ecfeff', '#0891b2');
    doc.fontSize(12)
       .fillColor('#0e7490')
       .text('Total Manual Hours', 60, summaryY + 15, { width: cardWidth - 20 });
    doc.fontSize(20)
       .fillColor('#1f2937')
       .text(formatHours(summary.totalHours), 60, summaryY + 35, { width: cardWidth - 20 });

    // Groups Selected Card
    const col2X = 50 + cardWidth + cardSpacing;
    doc.rect(col2X, summaryY, cardWidth, cardHeight)
       .fillAndStroke('#f0fdf4', '#10b981');
    doc.fontSize(12)
       .fillColor('#047857')
       .text(view === 'department' ? 'Departments Selected' : 'Projects Selected', col2X + 10, summaryY + 15, { width: cardWidth - 20 });
    doc.fontSize(20)
       .fillColor('#1f2937')
       .text(String(aggregated.length), col2X + 10, summaryY + 35, { width: cardWidth - 20 });

    // Entries Logged Card
    const col3X = col2X + cardWidth + cardSpacing;
    doc.rect(col3X, summaryY, cardWidth, cardHeight)
       .fillAndStroke('#eef2ff', '#6366f1');
    doc.fontSize(12)
       .fillColor('#4f46e5')
       .text('Entries Logged', col3X + 10, summaryY + 15, { width: cardWidth - 20 });
    doc.fontSize(20)
       .fillColor('#1f2937')
       .text(String(entries.length), col3X + 10, summaryY + 35, { width: cardWidth - 20 });

    doc.y = summaryY + cardHeight + 20;
    doc.moveDown(0.5);

    if (filters.startDate || filters.endDate) {
      doc.fontSize(10)
         .fillColor('#4b5563')
         .text(`Date Range: ${filters.startDate || 'Any'} → ${filters.endDate || 'Any'}`);
      doc.moveDown(0.5);
    }

    // Aggregated Table
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text(view === 'department' ? 'Hours by Department' : 'Hours by Project', { underline: true });

    doc.moveDown(0.5);

    const aggTableTop = doc.y;
    const aggColKey = 50;
    const aggColHours = 300;
    const aggColUsers = 390;
    const aggColAvg = 460;
    const aggTableWidth = 545;
    const rowHeight = 25;

    if (aggregated.length === 0) {
      doc.fontSize(12)
         .fillColor('#6b7280')
         .text(`No ${view === 'department' ? 'departments' : 'projects'} matched the selected filters.`);
      doc.moveDown(1.5);
    } else {
      const drawAggHeader = (y) => {
        doc.rect(aggColKey, y, aggTableWidth, rowHeight)
           .fillAndStroke('#f3f4f6', '#d1d5db');
        doc.fontSize(9)
           .fillColor('#374151');
        doc.text(view === 'department' ? 'Department' : 'Project', aggColKey + 5, y + 8, { width: 230, align: 'left' });
        doc.text('Total Hours', aggColHours + 5, y + 8, { width: 80, align: 'right' });
        doc.text('Users', aggColUsers + 5, y + 8, { width: 60, align: 'right' });
        doc.text('Avg/User', aggColAvg + 5, y + 8, { width: 130, align: 'right' });
      };

      drawAggHeader(aggTableTop);
      let currentY = aggTableTop + rowHeight;

      aggregated.forEach((item, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          drawAggHeader(currentY);
          currentY += rowHeight;
        }

        const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
        doc.rect(aggColKey, currentY, aggTableWidth, rowHeight)
           .fillAndStroke(rowColor, '#e5e7eb');

        const label = view === 'department'
          ? (item.department || 'N/A')
          : (item.projectName || 'N/A');

        doc.fontSize(8)
           .fillColor('#374151');
        doc.text(label, aggColKey + 5, currentY + 8, { width: 230, ellipsis: true, align: 'left' });
        doc.text(`${formatHours(item.totalHours)} hrs`, aggColHours + 5, currentY + 8, { width: 80, align: 'right' });
        doc.text(String(item.userCount || 0), aggColUsers + 5, currentY + 8, { width: 60, align: 'right' });
        doc.text(`${formatHours(item.avgHoursPerUser || 0)} hrs`, aggColAvg + 5, currentY + 8, { width: 130, align: 'right' });

        currentY += rowHeight;
      });

      doc.y = currentY + 20;
    }

    // Detailed Entries
    doc.fontSize(16)
       .fillColor('#1f2937')
       .text('Logged Entries', { underline: true });

    doc.moveDown(0.5);

    if (entries.length === 0) {
      doc.fontSize(12)
         .fillColor('#6b7280')
         .text('No manual time entries recorded for the selected filters.');
      return;
    }

    const entryColumns = [
      { label: 'Date', width: 0.1, minWidth: 50, getValue: entry => formatDate(entry.loggedAt) },
      { label: 'Task ID', width: 0.07, minWidth: 40, getValue: entry => entry.taskId != null ? String(entry.taskId) : '—' },
      { label: 'Title', width: 0.18, minWidth: 90, getValue: entry => entry.taskTitle || 'Untitled task' },
      { label: 'Project', width: 0.16, minWidth: 75, getValue: entry => entry.projectName || 'N/A' },
      { label: 'Status', width: 0.1, minWidth: 55, getValue: entry => entry.taskStatus ? String(entry.taskStatus).replace(/_/g, ' ') : 'N/A' },
      { label: 'Priority', width: 0.07, minWidth: 40, getValue: entry => entry.taskPriority ? String(entry.taskPriority) : 'N/A' },
      { label: 'Department', width: 0.14, minWidth: 60, getValue: entry => entry.department || 'N/A' },
      { label: 'User', width: 0.1, minWidth: 60, getValue: entry => entry.userName || (entry.userId ? `User ${entry.userId}` : 'N/A') },
      { label: 'Hours', width: 0.08, minWidth: 40, align: 'right', getValue: entry => formatHours(entry.hours) }
    ];

    const computeEntryColumnLayout = () => {
      const leftMargin = 50;
      const rightMargin = 50;
      const availableWidth = doc.page.width - leftMargin - rightMargin;
      const computed = [];
      let currentX = leftMargin;
      let remainingWidth = availableWidth;

      entryColumns.forEach((column, index) => {
        const remainingColumns = entryColumns.slice(index + 1);
        const minRemaining = remainingColumns.reduce((sum, col) => sum + (col.minWidth || 0), 0);

        let colWidth = Math.round(availableWidth * column.width);
        if (column.minWidth) {
          colWidth = Math.max(colWidth, column.minWidth);
        }

        if (colWidth > remainingWidth - minRemaining) {
          colWidth = Math.max(remainingWidth - minRemaining, column.minWidth || 0);
        }

        if (index === entryColumns.length - 1) {
          colWidth = remainingWidth;
        }

        computed.push({
          ...column,
          x: currentX,
          width: colWidth
        });

        currentX += colWidth;
        remainingWidth -= colWidth;
      });

      return {
        columns: computed,
        left: leftMargin,
        width: availableWidth
      };
    };

    let entryLayout = computeEntryColumnLayout();

    const drawEntryHeader = (y) => {
      entryLayout = computeEntryColumnLayout();
      doc.rect(entryLayout.left, y, entryLayout.width, rowHeight)
         .fillAndStroke('#f3f4f6', '#d1d5db');

      doc.fontSize(9).fillColor('#374151');
      entryLayout.columns.forEach((column) => {
        const textOptions = {
          width: Math.max(column.width - 10, 10),
          ellipsis: true
        };
        if (column.align === 'right') {
          textOptions.align = 'right';
        }
        doc.text(column.label, column.x + 5, y + 8, textOptions);
      });
    };

    let tableTop = doc.y;
    drawEntryHeader(tableTop);
    let currentY = tableTop + rowHeight;

    entries.forEach((entry, index) => {
      if (currentY > 700) {
        doc.addPage();
        tableTop = 50;
        drawEntryHeader(tableTop);
        currentY = tableTop + rowHeight;
      }

      const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      doc.rect(entryLayout.left, currentY, entryLayout.width, rowHeight)
         .fillAndStroke(rowColor, '#e5e7eb');

      doc.fontSize(8).fillColor('#374151');
      entryLayout.columns.forEach((column) => {
        const value = column.getValue(entry);
        const textOptions = {
          width: Math.max(column.width - 10, 10),
          ellipsis: true
        };
        if (column.align === 'right') {
          textOptions.align = 'right';
        }
        doc.text(value, column.x + 5, currentY + 8, textOptions);
      });

      currentY += rowHeight;
    });
  }

  /**
   * Export report to spreadsheet (XLSX or CSV)
   */
  async exportReportToSpreadsheet(reportData, format = 'xlsx') {
    try {
      // Detect report type
      const isDepartmentalReport = reportData.reportType === 'departmental_performance' || reportData.departments;
      const isManualTimeReport = reportData.reportType === 'manual_time' || reportData.entries;
      const isTaskReport = reportData.tasks;

      // Generate filename based on report type
      const dateStr = new Date().toISOString().split('T')[0];
      const extension = format === 'csv' ? 'csv' : 'xlsx';
      const filename = isDepartmentalReport
        ? `departmental-performance-${dateStr}.${extension}`
        : isManualTimeReport
          ? `logged-time-report-${dateStr}.${extension}`
          : `task-report-${dateStr}.${extension}`;

      const workbook = XLSX.utils.book_new();

      if (isDepartmentalReport) {
        // Export Departmental Report
        if (format === 'csv') {
          // For CSV, combine all data into a single sheet
          const combinedRows = [];

          // Summary section
          if (reportData.summary) {
            combinedRows.push(['Summary']);
            combinedRows.push(['Metric', 'Value']);
            combinedRows.push(['Total Departments', Number(reportData.summary.totalDepartments || 0)]);
            combinedRows.push(['Total Members', Number(reportData.summary.totalMembers || 0)]);
            combinedRows.push(['Total Tasks', Number(reportData.summary.totalTasks || 0)]);
            combinedRows.push(['Average Completion Rate', `${Number(reportData.summary.averageCompletionRate || 0).toFixed(1)}%`]);

            if (reportData.insights) {
              combinedRows.push([]);
              combinedRows.push(['Insights', '']);
              combinedRows.push(['Most Productive Department', String(reportData.insights.mostProductiveDepartment || 'N/A')]);
              combinedRows.push(['Highest Workload Department', String(reportData.insights.highestWorkloadDepartment || 'N/A')]);
              combinedRows.push(['Needs Attention', String(reportData.insights.leastProductiveDepartment || 'N/A')]);
            }
            combinedRows.push([]);
          }

          // Department Comparison section
          if (reportData.departments && reportData.departments.length > 0) {
            combinedRows.push(['Department Comparison']);
            combinedRows.push(['Department', 'Members', 'Tasks', 'Done', 'Progress', 'Rate', 'Avg/M']);
            reportData.departments.forEach(dept => {
              combinedRows.push([
                String(dept.department || 'N/A'),
                Number(dept.memberCount || 0),
                Number(dept.totalTasks || 0),
                Number(dept.statusCounts?.completed || 0),
                Number(dept.statusCounts?.in_progress || 0),
                `${Number(dept.completionRate || 0).toFixed(1)}%`,
                Number(dept.averageTasksPerMember || 0).toFixed(2)
              ]);
            });
            combinedRows.push([]);
          }

          // Time Series section (if available)
          if (reportData.timeSeries && reportData.timeSeries.length > 0) {
            combinedRows.push(['Trends']);
            combinedRows.push(['Period', 'Total Tasks', 'Completed', 'In Progress', 'Pending', 'Cancelled', 'Completion Rate', 'Low Priority', 'Medium Priority', 'High Priority']);
            reportData.timeSeries.forEach(period => {
              combinedRows.push([
                String(period.period || 'N/A'),
                Number(period.totalTasks || 0),
                Number(period.statusCounts?.completed || 0),
                Number(period.statusCounts?.in_progress || 0),
                Number(period.statusCounts?.pending || 0),
                Number(period.statusCounts?.cancelled || 0),
                `${Number(period.completionRate || 0).toFixed(1)}%`,
                Number(period.priorityCounts?.low || 0),
                Number(period.priorityCounts?.medium || 0),
                Number(period.priorityCounts?.high || 0)
              ]);
            });
          }

          const csvSheet = XLSX.utils.aoa_to_sheet(combinedRows);
          XLSX.utils.book_append_sheet(workbook, csvSheet, 'Report');
        } else {
          // For XLSX, create separate sheets
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
            'Tasks': Number(dept.totalTasks || 0),
            'Done': Number(dept.statusCounts?.completed || 0),
            'Progress': Number(dept.statusCounts?.in_progress || 0),
            'Rate': `${Number(dept.completionRate || 0).toFixed(1)}%`,
            'Avg/M': Number(dept.averageTasksPerMember || 0).toFixed(2)
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
        }
      } else if (isManualTimeReport) {
        const summary = reportData.summary || {};
        const filters = reportData.filters || {};
        const entries = Array.isArray(reportData.entries) ? reportData.entries : [];
        const view = filters.view === 'department' ? 'department' : 'project';
        const aggregated = view === 'department'
          ? summary.byDepartment || []
          : summary.byProject || [];
        const serializeDate = (value) => {
          if (!value) return 'N/A';
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
        };

        const summaryRows = [
          ['Metric', 'Value'],
          ['Total Manual Hours', this._roundToTwo(summary.totalHours || 0)],
          ['Entries Logged', entries.length],
          ['Grouping', view === 'department' ? 'Department' : 'Project']
        ];
        if (filters.startDate || filters.endDate) {
          summaryRows.push(['Date Range', `${filters.startDate || 'Any'} → ${filters.endDate || 'Any'}`]);
        }
        if (Array.isArray(filters.projectIds)) {
          summaryRows.push(['Selected Projects', filters.projectIds.length > 0 ? filters.projectIds.join(', ') : 'All']);
        }
        if (Array.isArray(filters.departments)) {
          summaryRows.push(['Selected Departments', filters.departments.length > 0 ? filters.departments.join(', ') : 'All']);
        }

        if (format === 'csv') {
          const combinedRows = [
            ['Summary'],
            ...summaryRows,
            [],
            [view === 'department' ? 'Hours by Department' : 'Hours by Project'],
            [view === 'department' ? 'Department' : 'Project', 'Total Hours', 'Users', 'Avg Hours/User'],
            ...(aggregated.length > 0
              ? aggregated.map(item => [
                  view === 'department' ? (item.department || 'N/A') : (item.projectName || 'N/A'),
                  this._roundToTwo(item.totalHours || 0),
                  item.userCount || 0,
                  this._roundToTwo(item.avgHoursPerUser || 0)
                ])
              : [['None', 0, 0, 0]]),
            [],
            ['Entries'],
            ['Date', 'Task ID', 'Title', 'Status', 'Priority', 'Project', 'Department', 'User', 'Hours'],
            ...(entries.length > 0
              ? entries.map(entry => [
                  serializeDate(entry.loggedAt),
                  entry.taskId != null ? entry.taskId : '',
                  entry.taskTitle || 'Untitled task',
                  (entry.taskStatus || 'N/A').toString().replace(/_/g, ' '),
                  (entry.taskPriority || 'N/A').toString(),
                  entry.projectName || 'N/A',
                  entry.department || 'N/A',
                  entry.userName || (entry.userId ? `User ${entry.userId}` : 'N/A'),
                  this._roundToTwo(entry.hours || 0)
                ])
              : [['None', '', 'Untitled task', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 0]])
          ];

          const csvSheet = XLSX.utils.aoa_to_sheet(combinedRows);
          XLSX.utils.book_append_sheet(workbook, csvSheet, 'Report');
        } else {
          // Summary sheet
          const manualSummarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
          XLSX.utils.book_append_sheet(workbook, manualSummarySheet, 'Summary');

          // Aggregated sheet (always include header, even if no data)
          const aggSheetData = (aggregated.length > 0
            ? aggregated
            : [{
                [view === 'department' ? 'Department' : 'Project']: 'None',
                totalHours: 0,
                userCount: 0,
                avgHoursPerUser: 0
              }]).map(item => ({
            [view === 'department' ? 'Department' : 'Project']: view === 'department'
              ? item.department || 'N/A'
              : item.projectName || 'N/A',
            'Total Hours': this._roundToTwo(item.totalHours || 0),
            'Users': item.userCount || 0,
            'Avg Hours/User': this._roundToTwo(item.avgHoursPerUser || 0)
          }));
          const aggSheetName = view === 'department' ? 'By Department' : 'By Project';
          const aggSheet = XLSX.utils.json_to_sheet(aggSheetData);
          XLSX.utils.book_append_sheet(workbook, aggSheet, aggSheetName);

          // Entries sheet (include headers even when empty)
          const entrySheetData = (entries.length > 0
            ? entries
            : [{
                loggedAt: 'N/A',
                taskId: null,
                taskTitle: 'Untitled task',
                taskStatus: 'N/A',
                taskPriority: 'N/A',
                projectName: 'N/A',
                department: 'N/A',
                userName: 'N/A',
                userId: null,
                hours: 0
              }]).map(entry => ({
            Date: serializeDate(entry.loggedAt),
            'Task ID': entry.taskId != null ? entry.taskId : '',
            Title: entry.taskTitle || 'Untitled task',
            Status: (entry.taskStatus || 'N/A').toString().replace(/_/g, ' '),
            Priority: (entry.taskPriority || 'N/A').toString(),
            Project: entry.projectName || 'N/A',
            Department: entry.department || 'N/A',
            User: entry.userName || (entry.userId ? `User ${entry.userId}` : 'N/A'),
            Hours: this._roundToTwo(entry.hours || 0)
          }));
          const entriesSheet = XLSX.utils.json_to_sheet(entrySheetData);
          XLSX.utils.book_append_sheet(workbook, entriesSheet, 'Entries');
        }
      } else {
        // Export Task Report (original logic)
        const tasks = reportData.tasks || [];
        
        const worksheetData = tasks.map(task => ({
          'ID': Number(task.id || 0),
          'Title': String(task.title || ''),
          'Status': String(task.status || 'N/A').replace('_', ' ').toUpperCase(),
          'Priority': String(task.priority || 'N/A').toUpperCase(),
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
        filename: filename
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
   * Helper: Verify user has report generation permission
   */
  _verifyReportPermission(user) {
    if (!user || (user.role !== 'hr' && user.role !== 'admin')) {
      throw new Error('Unauthorized: Only HR and Admin staff can generate reports');
    }
  }

  /**
   * Helper: Calculate statistics for a single user
   */
  _calculateUserStats(targetUser, tasks) {
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
  }

  /**
   * Helper: Calculate statistics for a single project
   */
  _calculateProjectStats(project, tasks) {
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
  }

  /**
   * Helper: Get scoped filters for manual time reports
   */
  async _getScopedManualTimeFilters(user, filters) {
    const normalizedProjectIds = this._normalizeIdArray(filters.projectIds);
    const normalizedDepartments = Array.isArray(filters.departments)
      ? filters.departments.filter(dep => typeof dep === 'string' && dep.trim().length > 0)
      : [];

    if (user.role === 'admin') {
      return {
        scopedProjectIds: normalizedProjectIds,
        scopedDepartments: normalizedDepartments,
        hrProjectSet: null,
        hrDepartmentSet: null
      };
    }

    // HR role - scope to department hierarchy
    const { data: departmentUsers, error: userError } = await reportRepository.getUsersByDepartmentHierarchy(user.department);

    if (userError) {
      throw new Error(userError.message || 'Failed to fetch department users');
    }

    const departmentUserIds = (departmentUsers || []).map(u => u.id);
    const allowedDepartments = Array.from(new Set(
      (departmentUsers || [])
        .map(u => u.department)
        .filter(dep => typeof dep === 'string' && dep.length > 0)
    ));

    const { data: departmentProjects, error: projectError } = await reportRepository.getProjectsByDepartment(departmentUserIds);

    if (projectError) {
      throw new Error(projectError.message || 'Failed to fetch department projects');
    }

    const allowedProjectIds = (departmentProjects || [])
      .map(project => Number(project.id))
      .filter(id => Number.isFinite(id));

    const scopedProjectIds = normalizedProjectIds.length > 0
      ? normalizedProjectIds.filter(id => allowedProjectIds.includes(id))
      : allowedProjectIds;

    const scopedDepartments = normalizedDepartments.length > 0
      ? normalizedDepartments.filter(dep => allowedDepartments.includes(dep))
      : allowedDepartments;

    return {
      scopedProjectIds,
      scopedDepartments,
      hrProjectSet: new Set(scopedProjectIds),
      hrDepartmentSet: new Set(scopedDepartments)
    };
  }

  /**
   * Helper: Filter manual time entries based on permissions
   */
  _filterManualTimeEntries(entries, { projectIds, departments, hrProjectSet, hrDepartmentSet, isHR }) {
    const matchesProject = entry => {
      if (!projectIds || projectIds.length === 0) return true;
      if (entry.projectId === null || entry.projectId === undefined) return false;
      return projectIds.includes(entry.projectId);
    };

    const matchesDepartment = entry => {
      if (!departments || departments.length === 0) return true;
      if (!entry.department) return false;
      return departments.includes(entry.department);
    };

    let filtered = entries.filter(entry => matchesProject(entry) && matchesDepartment(entry));

    if (isHR) {
      filtered = filtered.filter(entry => {
        const projectOk = hrProjectSet && hrProjectSet.size > 0
          ? (entry.projectId === null || hrProjectSet.has(entry.projectId))
          : true;
        const departmentOk = hrDepartmentSet && hrDepartmentSet.size > 0
          ? (entry.department ? hrDepartmentSet.has(entry.department) : true)
          : true;
        return projectOk && departmentOk;
      });
    }

    return filtered;
  }

  /**
   * Helper: Get scoped user and project IDs based on user role
   */
  async _getScopedFilters(user, filters = {}) {
    const normalizedUserFilters = this._normalizeIdArray(filters.userIds);
    const normalizedProjectFilters = this._normalizeIdArray(filters.projectIds);

    if (user.role === 'admin') {
      return {
        userIds: normalizedUserFilters,
        projectIds: normalizedProjectFilters
      };
    }

    // HR sees only their department hierarchy
    const { data: departmentUsers, error: userError } = await reportRepository.getUsersByDepartmentHierarchy(user.department);

    if (userError) {
      throw new Error(userError.message || 'Failed to fetch department users');
    }

    const allDepartmentUserIds = departmentUsers
      .map(u => Number(u.id))
      .filter(Number.isFinite);

    const { data: departmentProjects, error: projectError } = await reportRepository.getProjectsByDepartment(allDepartmentUserIds);

    if (projectError) {
      throw new Error(projectError.message || 'Failed to fetch department projects');
    }

    const allDepartmentProjectIds = (departmentProjects || [])
      .map(p => Number(p.id))
      .filter(Number.isFinite);

    return {
      userIds: normalizedUserFilters.length > 0
        ? normalizedUserFilters.filter(id => allDepartmentUserIds.includes(id))
        : allDepartmentUserIds,
      projectIds: normalizedProjectFilters.length > 0
        ? normalizedProjectFilters.filter(id => allDepartmentProjectIds.includes(id))
        : allDepartmentProjectIds
    };
  }

  /**
   * Helper: Normalize array of IDs into integers
   */
  _normalizeIdArray(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map(value => Number(value))
      .filter(number => Number.isFinite(number) && number > 0)
      .map(number => Math.trunc(number));
  }

  /**
   * Helper: Round numeric value to two decimal places
   */
  _roundToTwo(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.round(numeric * 100) / 100;
  }

  /**
   * Helper: Sanitize manual time entries
   */
  _sanitizeManualTimeEntries(entries = []) {
    return entries.map(entry => {
      const projectId = entry.project_id ?? entry.projectId ?? null;
      return {
        taskId: entry.task_id ?? entry.taskId ?? null,
        projectId: Number.isFinite(Number(projectId)) ? Math.trunc(Number(projectId)) : null,
        projectName: entry.project_name ?? entry.projectName ?? null,
        userId: entry.user_id ?? entry.userId ?? null,
        userName: entry.user_name ?? entry.userName ?? null,
        taskStatus: entry.task_status ?? entry.taskStatus ?? null,
        taskPriority: entry.task_priority ?? entry.taskPriority ?? null,
        taskTitle: entry.task_title ?? entry.taskTitle ?? null,
        department: entry.department ?? null,
        hours: this._roundToTwo(entry.hours),
        loggedAt: entry.logged_at ?? entry.loggedAt ?? null,
        isManual: entry.is_manual === undefined ? true : Boolean(entry.is_manual)
      };
    });
  }

  /**
   * Helper: Summarize manual time entries by project and department
   */
  _summarizeManualTime(entries = []) {
    let totalHours = 0;
    const byProjectMap = new Map();
    const byDepartmentMap = new Map();
    const userSet = new Set();

    entries.forEach(entry => {
      const hours = Number(entry.hours) || 0;
      totalHours += hours;

      // Track unique users
      if (entry.userId) {
        userSet.add(entry.userId);
      }

      if (entry.projectId !== null && entry.projectId !== undefined) {
        const existing = byProjectMap.get(entry.projectId) || {
          projectId: entry.projectId,
          projectName: entry.projectName || 'Unknown Project',
          totalHours: 0,
          userHours: new Map() // Track hours per user for this project
        };
        existing.totalHours += hours;
        existing.projectName = entry.projectName || existing.projectName;

        // Track user hours for this project
        if (entry.userId) {
          const currentUserHours = existing.userHours.get(entry.userId) || 0;
          existing.userHours.set(entry.userId, currentUserHours + hours);
        }

        byProjectMap.set(entry.projectId, existing);
      }

      if (entry.department) {
        const existing = byDepartmentMap.get(entry.department) || {
          department: entry.department,
          totalHours: 0,
          userHours: new Map() // Track hours per user for this department
        };
        existing.totalHours += hours;

        // Track user hours for this department
        if (entry.userId) {
          const currentUserHours = existing.userHours.get(entry.userId) || 0;
          existing.userHours.set(entry.userId, currentUserHours + hours);
        }

        byDepartmentMap.set(entry.department, existing);
      }
    });

    const byProject = Array.from(byProjectMap.values())
      .map(item => {
        const userCount = item.userHours.size;
        const avgHoursPerUser = userCount > 0 ? item.totalHours / userCount : 0;

        return {
          projectId: item.projectId,
          projectName: item.projectName,
          totalHours: this._roundToTwo(item.totalHours),
          userCount: userCount,
          avgHoursPerUser: this._roundToTwo(avgHoursPerUser)
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);

    const byDepartment = Array.from(byDepartmentMap.values())
      .map(item => {
        const userCount = item.userHours.size;
        const avgHoursPerUser = userCount > 0 ? item.totalHours / userCount : 0;

        return {
          department: item.department,
          totalHours: this._roundToTwo(item.totalHours),
          userCount: userCount,
          avgHoursPerUser: this._roundToTwo(avgHoursPerUser)
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);

    return {
      totalHours: this._roundToTwo(totalHours),
      totalUsers: userSet.size,
      byProject,
      byDepartment
    };
  }

  /**
   * Helper: Build manual time report payload
   */
  _buildManualTimeReportPayload({ user, filters, entries, summary, view }) {
    const generatedAt = new Date().toISOString();
    const filename = `manual-time-report-${generatedAt.split('T')[0]}.xlsx`;

    return {
      summary,
      entries,
      filters: {
        ...filters,
        view
      },
      generatedAt,
      generatedBy: user.id,
      reportType: 'manual_time',
      download: {
        ready: true,
        format: 'spreadsheet',
        filename
      }
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

      // Count by priority (numeric 1-10 mapped to low/medium/high)
      const priorityValue = Number(task.priority) || 5;
      if (priorityValue >= 1 && priorityValue <= 3) {
        byPriority.low++;
      } else if (priorityValue >= 4 && priorityValue <= 6) {
        byPriority.medium++;
      } else if (priorityValue >= 7 && priorityValue <= 10) {
        byPriority.high++;
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
