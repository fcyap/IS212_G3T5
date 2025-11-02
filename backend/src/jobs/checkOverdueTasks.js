/**
 * Cron Job: Check for Task Deadlines (Impending and Overdue)
 * 
 * This script checks for:
 * 1. Impending Deadlines: Tasks due within 24 hours
 * 2. Overdue Tasks: Tasks past their deadline
 * 
 * It should be scheduled to run daily (e.g., at 8:00 AM) using a cron scheduler.
 * Both checks run together to ensure timely notifications.
 * 
 * Usage:
 * - Run manually: node src/jobs/checkOverdueTasks.js
 * - Schedule with node-cron (add to your main server file):
 *   const cron = require('node-cron');
 *   const { checkTaskDeadlines } = require('./jobs/checkOverdueTasks');
 * 
 *   cron.schedule('0 8 * * *', () => {
 *     console.log('Running scheduled task deadline checks...');
 *     checkTaskDeadlines();
 *   });
 */

const notificationService = require('../services/notificationService');

/**
 * Main function to check both impending and overdue task deadlines
 */
async function checkTaskDeadlines() {
  console.log('\n' + '='.repeat(80));
  console.log('🔔 TASK DEADLINE NOTIFICATION CHECK');
  console.log('Started at:', new Date().toISOString());
  console.log('='.repeat(80) + '\n');

  const results = {
    impendingDeadlines: {
      success: false,
      notificationsSent: 0,
      tasksChecked: 0,
      error: null
    },
    overdueTask: {
      success: false,
      notificationsSent: 0,
      tasksChecked: 0,
      overdueTasksFound: 0,
      error: null
    }
  };

  // 1. Check for impending deadlines (tasks due within 24 hours)
  console.log('📅 Checking for impending deadlines (tasks due within 24 hours)...');
  try {
    const impendingResult = await notificationService.checkAndSendDeadlineNotifications();
    results.impendingDeadlines = {
      success: true,
      notificationsSent: impendingResult.notificationsSent,
      tasksChecked: impendingResult.tasksChecked,
      error: null
    };
    console.log(`✅ Impending deadline check complete:`);
    console.log(`   - Tasks checked: ${impendingResult.tasksChecked}`);
    console.log(`   - Notifications sent: ${impendingResult.notificationsSent}`);
  } catch (error) {
    console.error('❌ Error checking impending deadlines:', error.message);
    results.impendingDeadlines.error = error.message;
  }

  console.log('\n' + '-'.repeat(80) + '\n');

  // 2. Check for overdue tasks
  console.log('⚠️  Checking for overdue tasks...');
  try {
    const overdueResult = await notificationService.checkAndSendOverdueNotifications();
    results.overdueTask = {
      success: true,
      notificationsSent: overdueResult.notificationsSent,
      tasksChecked: overdueResult.tasksChecked,
      overdueTasksFound: overdueResult.overdueTasksFound,
      error: null
    };
    console.log(`✅ Overdue task check complete:`);
    console.log(`   - Tasks checked: ${overdueResult.tasksChecked}`);
    console.log(`   - Overdue tasks found: ${overdueResult.overdueTasksFound}`);
    console.log(`   - Notifications sent: ${overdueResult.notificationsSent}`);
  } catch (error) {
    console.error('❌ Error checking overdue tasks:', error.message);
    results.overdueTask.error = error.message;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total notifications sent: ${results.impendingDeadlines.notificationsSent + results.overdueTask.notificationsSent}`);
  console.log(`Total tasks checked: ${results.impendingDeadlines.tasksChecked + results.overdueTask.tasksChecked}`);
  console.log(`\nImpending Deadlines: ${results.impendingDeadlines.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`Overdue Tasks: ${results.overdueTask.success ? '✅ Success' : '❌ Failed'}`);
  console.log('\nCompleted at:', new Date().toISOString());
  console.log('='.repeat(80) + '\n');

  return results;
}

// Run the check if this script is executed directly
if (require.main === module) {
  console.log('Running task deadline checks manually...\n');
  checkTaskDeadlines()
    .then(() => {
      console.log('✅ Task deadline checks completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error during task deadline checks:', error);
      process.exit(1);
    });
}

module.exports = { checkTaskDeadlines };
