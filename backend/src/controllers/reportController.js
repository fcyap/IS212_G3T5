const reportService = require('../services/reportService');

/**
 * Report Controller - Handles HTTP requests and responses for reports
 * This layer only deals with request validation and response formatting
 */

/**
 * Generate task report
 * POST /api/reports/tasks
 */
const generateTaskReport = async (req, res, next) => {
  try {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate date format
    if (req.body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }

    if (req.body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // Validate date logic
    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          error: 'endDate must be after or equal to startDate'
        });
      }
    }

    const filters = {
      projectIds: req.body.projectIds,
      statuses: req.body.statuses,
      priorities: req.body.priorities,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      userIds: req.body.userIds,
      departments: req.body.departments
    };

    const report = await reportService.generateTaskReport(user, filters);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in generateTaskReport:', error);
    next(error);
  }
};

/**
 * Generate user productivity report
 * POST /api/reports/users/productivity
 */
const generateUserProductivityReport = async (req, res, next) => {
  try {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate date format
    if (req.body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }

    if (req.body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // Validate date logic
    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          error: 'endDate must be after or equal to startDate'
        });
      }
    }

    const filters = {
      userIds: req.body.userIds,
      startDate: req.body.startDate,
      endDate: req.body.endDate
    };

    const report = await reportService.generateUserProductivityReport(user, filters);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in generateUserProductivityReport:', error);
    next(error);
  }
};

/**
 * Generate project report
 * POST /api/reports/projects
 */
const generateProjectReport = async (req, res, next) => {
  try {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate date format
    if (req.body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }

    if (req.body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // Validate date logic
    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          error: 'endDate must be after or equal to startDate'
        });
      }
    }

    const filters = {
      projectIds: req.body.projectIds,
      startDate: req.body.startDate,
      endDate: req.body.endDate
    };

    const report = await reportService.generateProjectReport(user, filters);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in generateProjectReport:', error);
    next(error);
  }
};

/**
 * Export report to PDF
 * POST /api/reports/export/pdf
 */
const exportReportToPDF = async (req, res, next) => {
  try {
    const { reportData } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'reportData is required'
      });
    }

    const result = await reportService.exportReportToPDF(reportData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    console.error('Error in exportReportToPDF:', error);
    next(error);
  }
};

/**
 * Export report to spreadsheet (XLSX or CSV)
 * POST /api/reports/export/spreadsheet
 */
const exportReportToSpreadsheet = async (req, res, next) => {
  try {
    const { reportData, format } = req.body;

    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'reportData is required'
      });
    }

    const result = await reportService.exportReportToSpreadsheet(reportData, format);

    const contentType = format === 'csv' 
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    console.error('Error in exportReportToSpreadsheet:', error);
    next(error);
  }
};

/**
 * Get available projects for filtering
 * GET /api/reports/filters/projects
 */
const getAvailableProjects = async (req, res, next) => {
  try {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const projects = await reportService.getAvailableProjects(user);

    res.status(200).json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Error in getAvailableProjects:', error);
    next(error);
  }
};

/**
 * Get available users for filtering
 * GET /api/reports/filters/users
 */
const getAvailableUsers = async (req, res, next) => {
  try {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const users = await reportService.getAvailableUsers(user);

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error in getAvailableUsers:', error);
    next(error);
  }
};

/**
 * Get available departments for filtering
 * GET /api/reports/filters/departments
 */
const getAvailableDepartments = async (req, res, next) => {
  try {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const departments = await reportService.getAvailableDepartments(user);

    res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('Error in getAvailableDepartments:', error);
    next(error);
  }
};

/**
 * Generate departmental performance report
 * POST /api/reports/departments
 */
const generateDepartmentalPerformanceReport = async (req, res, next) => {
  try {
    const user = req.user;

    console.log('[generateDepartmentalPerformanceReport] User:', user);
    console.log('[generateDepartmentalPerformanceReport] Body:', req.body);

    if (!user) {
      console.log('[generateDepartmentalPerformanceReport] No user found - returning 401');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate date format
    if (req.body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }

    if (req.body.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // Validate date logic
    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (end < start) {
        return res.status(400).json({
          success: false,
          error: 'endDate must be after or equal to startDate'
        });
      }
    }

    // Validate interval if provided
    if (req.body.interval && !['week', 'month'].includes(req.body.interval)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval. Must be "week" or "month"'
      });
    }

    const filters = {
      departmentIds: req.body.departmentIds,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      interval: req.body.interval,
      projectIds: req.body.projectIds
    };

    console.log('[generateDepartmentalPerformanceReport] Filters:', filters);

    const report = await reportService.generateDepartmentalPerformanceReport(user, filters);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error in generateDepartmentalPerformanceReport:', error);
    next(error);
  }
};

module.exports = {
  generateTaskReport,
  generateUserProductivityReport,
  generateProjectReport,
  exportReportToPDF,
  exportReportToSpreadsheet,
  getAvailableProjects,
  getAvailableUsers,
  getAvailableDepartments,
  generateDepartmentalPerformanceReport
};
