const { checkTaskDeadlines } = require('../../src/jobs/checkOverdueTasks');
const notificationService = require('../../src/services/notificationService');

jest.mock('../../src/services/notificationService');

describe('checkOverdueTasks Job', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on console methods to verify logging
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Successful Execution', () => {
    test('should check both impending and overdue deadlines successfully', async () => {
      // Mock successful responses from notification service
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 5,
        tasksChecked: 10
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 3,
        tasksChecked: 8,
        overdueTasksFound: 3
      });

      const results = await checkTaskDeadlines();

      expect(notificationService.checkAndSendDeadlineNotifications).toHaveBeenCalled();
      expect(notificationService.checkAndSendOverdueNotifications).toHaveBeenCalled();

      expect(results.impendingDeadlines.success).toBe(true);
      expect(results.impendingDeadlines.notificationsSent).toBe(5);
      expect(results.impendingDeadlines.tasksChecked).toBe(10);
      expect(results.impendingDeadlines.error).toBeNull();

      expect(results.overdueTask.success).toBe(true);
      expect(results.overdueTask.notificationsSent).toBe(3);
      expect(results.overdueTask.tasksChecked).toBe(8);
      expect(results.overdueTask.overdueTasksFound).toBe(3);
      expect(results.overdueTask.error).toBeNull();
    });

    test('should handle zero notifications sent', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 5
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 5,
        overdueTasksFound: 0
      });

      const results = await checkTaskDeadlines();

      expect(results.impendingDeadlines.success).toBe(true);
      expect(results.impendingDeadlines.notificationsSent).toBe(0);
      expect(results.overdueTask.success).toBe(true);
      expect(results.overdueTask.notificationsSent).toBe(0);
    });

    test('should handle large numbers of tasks', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 100,
        tasksChecked: 500
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 50,
        tasksChecked: 500,
        overdueTasksFound: 50
      });

      const results = await checkTaskDeadlines();

      expect(results.impendingDeadlines.notificationsSent).toBe(100);
      expect(results.impendingDeadlines.tasksChecked).toBe(500);
      expect(results.overdueTask.notificationsSent).toBe(50);
      expect(results.overdueTask.tasksChecked).toBe(500);
    });
  });

  describe('Error Handling', () => {
    test('should handle impending deadline check failure', async () => {
      const error = new Error('Database connection failed');
      notificationService.checkAndSendDeadlineNotifications.mockRejectedValue(error);
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 2,
        tasksChecked: 5,
        overdueTasksFound: 2
      });

      const results = await checkTaskDeadlines();

      expect(results.impendingDeadlines.success).toBe(false);
      expect(results.impendingDeadlines.error).toBe('Database connection failed');
      expect(results.overdueTask.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error checking impending deadlines:',
        'Database connection failed'
      );
    });

    test('should handle overdue task check failure', async () => {
      const error = new Error('Query timeout');
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 3,
        tasksChecked: 7
      });
      notificationService.checkAndSendOverdueNotifications.mockRejectedValue(error);

      const results = await checkTaskDeadlines();

      expect(results.impendingDeadlines.success).toBe(true);
      expect(results.overdueTask.success).toBe(false);
      expect(results.overdueTask.error).toBe('Query timeout');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error checking overdue tasks:',
        'Query timeout'
      );
    });

    test('should handle both checks failing', async () => {
      const error1 = new Error('Service unavailable');
      const error2 = new Error('Network error');
      notificationService.checkAndSendDeadlineNotifications.mockRejectedValue(error1);
      notificationService.checkAndSendOverdueNotifications.mockRejectedValue(error2);

      const results = await checkTaskDeadlines();

      expect(results.impendingDeadlines.success).toBe(false);
      expect(results.impendingDeadlines.error).toBe('Service unavailable');
      expect(results.overdueTask.success).toBe(false);
      expect(results.overdueTask.error).toBe('Network error');
    });
  });

  describe('Console Output', () => {
    test('should log header with timestamp', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0,
        overdueTasksFound: 0
      });

      await checkTaskDeadlines();

      expect(consoleLogSpy).toHaveBeenCalledWith('🔔 TASK DEADLINE NOTIFICATION CHECK');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Started at:',
        expect.any(String)
      );
    });

    test('should log impending deadline check details', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 5,
        tasksChecked: 10
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0,
        overdueTasksFound: 0
      });

      await checkTaskDeadlines();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '📅 Checking for impending deadlines (tasks due within 24 hours)...'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Impending deadline check complete:');
      expect(consoleLogSpy).toHaveBeenCalledWith('   - Tasks checked: 10');
      expect(consoleLogSpy).toHaveBeenCalledWith('   - Notifications sent: 5');
    });

    test('should log overdue task check details', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 3,
        tasksChecked: 8,
        overdueTasksFound: 3
      });

      await checkTaskDeadlines();

      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️  Checking for overdue tasks...');
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Overdue task check complete:');
      expect(consoleLogSpy).toHaveBeenCalledWith('   - Tasks checked: 8');
      expect(consoleLogSpy).toHaveBeenCalledWith('   - Overdue tasks found: 3');
      expect(consoleLogSpy).toHaveBeenCalledWith('   - Notifications sent: 3');
    });

    test('should log summary with totals', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 5,
        tasksChecked: 10
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 3,
        tasksChecked: 8,
        overdueTasksFound: 3
      });

      await checkTaskDeadlines();

      expect(consoleLogSpy).toHaveBeenCalledWith('📊 SUMMARY');
      expect(consoleLogSpy).toHaveBeenCalledWith('Total notifications sent: 8');
      expect(consoleLogSpy).toHaveBeenCalledWith('Total tasks checked: 18');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nImpending Deadlines: ✅ Success');
      expect(consoleLogSpy).toHaveBeenCalledWith('Overdue Tasks: ✅ Success');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '\nCompleted at:',
        expect.any(String)
      );
    });

    test('should show failure status in summary when checks fail', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockRejectedValue(
        new Error('Test error')
      );
      notificationService.checkAndSendOverdueNotifications.mockRejectedValue(
        new Error('Test error')
      );

      await checkTaskDeadlines();

      expect(consoleLogSpy).toHaveBeenCalledWith('\nImpending Deadlines: ❌ Failed');
      expect(consoleLogSpy).toHaveBeenCalledWith('Overdue Tasks: ❌ Failed');
    });

    test('should log separators for readability', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0,
        overdueTasksFound: 0
      });

      await checkTaskDeadlines();

      // Check that separators are logged
      const logCalls = consoleLogSpy.mock.calls.map(call => call[0]);
      expect(logCalls.some(call => call && call.includes('='.repeat(80)))).toBe(true);
      expect(logCalls.some(call => call && call.includes('-'.repeat(80)))).toBe(true);
    });
  });

  describe('Return Value Structure', () => {
    test('should return correct structure with all fields', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 5,
        tasksChecked: 10
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 3,
        tasksChecked: 8,
        overdueTasksFound: 3
      });

      const results = await checkTaskDeadlines();

      expect(results).toHaveProperty('impendingDeadlines');
      expect(results).toHaveProperty('overdueTask');

      expect(results.impendingDeadlines).toHaveProperty('success');
      expect(results.impendingDeadlines).toHaveProperty('notificationsSent');
      expect(results.impendingDeadlines).toHaveProperty('tasksChecked');
      expect(results.impendingDeadlines).toHaveProperty('error');

      expect(results.overdueTask).toHaveProperty('success');
      expect(results.overdueTask).toHaveProperty('notificationsSent');
      expect(results.overdueTask).toHaveProperty('tasksChecked');
      expect(results.overdueTask).toHaveProperty('overdueTasksFound');
      expect(results.overdueTask).toHaveProperty('error');
    });

    test('should initialize with default error values', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0
      });
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 0,
        tasksChecked: 0,
        overdueTasksFound: 0
      });

      const results = await checkTaskDeadlines();

      expect(results.impendingDeadlines.error).toBeNull();
      expect(results.overdueTask.error).toBeNull();
    });
  });

  describe('Service Integration', () => {
    test('should call notification service methods in sequence', async () => {
      const callOrder = [];
      notificationService.checkAndSendDeadlineNotifications.mockImplementation(async () => {
        callOrder.push('impending');
        return { notificationsSent: 0, tasksChecked: 0 };
      });
      notificationService.checkAndSendOverdueNotifications.mockImplementation(async () => {
        callOrder.push('overdue');
        return { notificationsSent: 0, tasksChecked: 0, overdueTasksFound: 0 };
      });

      await checkTaskDeadlines();

      expect(callOrder).toEqual(['impending', 'overdue']);
    });

    test('should continue to overdue check even if impending check fails', async () => {
      notificationService.checkAndSendDeadlineNotifications.mockRejectedValue(
        new Error('Failed')
      );
      notificationService.checkAndSendOverdueNotifications.mockResolvedValue({
        notificationsSent: 1,
        tasksChecked: 2,
        overdueTasksFound: 1
      });

      const results = await checkTaskDeadlines();

      expect(notificationService.checkAndSendOverdueNotifications).toHaveBeenCalled();
      expect(results.overdueTask.success).toBe(true);
    });
  });

  describe('Module Exports', () => {
    test('should export checkTaskDeadlines function', () => {
      const exported = require('../../src/jobs/checkOverdueTasks');
      expect(exported).toHaveProperty('checkTaskDeadlines');
      expect(typeof exported.checkTaskDeadlines).toBe('function');
    });
  });

  // Note: The direct execution path (lines 105-115) that handles
  // require.main === module is not covered by these tests as it
  // involves process.exit() and is intended for CLI usage only.
  // This path would need integration tests with child processes.
});
