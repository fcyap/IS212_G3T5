const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireRole, checkDepartmentAccess } = require('../middleware/rbac');
const { authMiddleware } = require('../middleware/auth');

// Debug middleware
router.use((req, res, next) => {
  // Sanitize user-controlled values to prevent log injection
  const sanitize = (str) => String(str || '').replace(/[\n\r]/g, '');
  console.log(`[reports.js] Route hit:`, sanitize(req.method), sanitize(req.originalUrl));
  next();
});

// All report routes require authentication and HR/Admin role
const requireHROrAdmin = requireRole(['hr', 'admin']);

// Report generation endpoints
router.post('/tasks', requireHROrAdmin, checkDepartmentAccess(), reportController.generateTaskReport);
router.post('/users/productivity', requireHROrAdmin, checkDepartmentAccess(), reportController.generateUserProductivityReport);
router.post('/projects', requireHROrAdmin, checkDepartmentAccess(), reportController.generateProjectReport);
router.post('/departments', requireHROrAdmin, checkDepartmentAccess(), reportController.generateDepartmentalPerformanceReport);
router.post('/time/manual', requireHROrAdmin, checkDepartmentAccess(), reportController.generateManualTimeReport);

// Export endpoints
router.post('/export/pdf', requireHROrAdmin, reportController.exportReportToPDF);
router.post('/export/spreadsheet', requireHROrAdmin, reportController.exportReportToSpreadsheet);

// Filter endpoints (get available filter options)
router.get('/filters/projects', requireHROrAdmin, reportController.getAvailableProjects);
router.get('/filters/users', requireHROrAdmin, reportController.getAvailableUsers);
router.get('/filters/departments', requireHROrAdmin, reportController.getAvailableDepartments);

module.exports = router;
