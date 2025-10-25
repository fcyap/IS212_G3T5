const reportService = require('./src/services/reportService');
const fs = require('fs');
const path = require('path');

async function testExportFormatting() {
  console.log('Testing Export Formatting Fixes...\n');

  // Mock departmental report data
  const mockDepartmentalData = {
    reportType: 'departmental_performance',
    summary: {
      totalDepartments: 3,
      totalMembers: 25,
      totalTasks: 150,
      averageCompletionRate: 72.5
    },
    insights: {
      mostProductiveDepartment: 'Engineering',
      highestWorkloadDepartment: 'Product Management',
      leastProductiveDepartment: 'Marketing'
    },
    departments: [
      {
        department: 'Engineering',
        memberCount: 12,
        totalTasks: 80,
        statusCounts: { completed: 60, in_progress: 15, pending: 5, cancelled: 0 },
        completionRate: 75,
        averageTasksPerMember: 6.67,
        priorityCounts: { low: 20, medium: 40, high: 20 }
      },
      {
        department: 'Product Management',
        memberCount: 8,
        totalTasks: 50,
        statusCounts: { completed: 35, in_progress: 10, pending: 5, cancelled: 0 },
        completionRate: 70,
        averageTasksPerMember: 6.25,
        priorityCounts: { low: 15, medium: 25, high: 10 }
      }
    ],
    timeSeries: [
      {
        period: '2025-W42',
        totalTasks: 40,
        statusCounts: { completed: 30, in_progress: 8, pending: 2, cancelled: 0 },
        completionRate: 75,
        priorityCounts: { low: 10, medium: 20, high: 10 }
      }
    ]
  };

  // Mock task report data
  const mockTaskData = {
    reportType: 'task',
    summary: {
      totalTasks: 25,
      byStatus: { completed: 15, in_progress: 7, pending: 3, blocked: 0 }
    },
    tasks: [
      {
        id: 1,
        title: 'Implement authentication system with OAuth2',
        status: 'completed',
        priority: 'high',
        deadline: '2025-10-20',
        created_at: '2025-10-01',
        project_id: 1,
        project_name: 'Auth System'
      },
      {
        id: 2,
        title: 'Fix database connection pooling issue',
        status: 'in_progress',
        priority: 'medium',
        deadline: '2025-10-30',
        created_at: '2025-10-10',
        project_id: 2,
        project_name: 'Backend Infrastructure'
      }
    ]
  };

  try {
    // Test 1: PDF Export - Departmental Report
    console.log('1. Testing PDF Export (Departmental Report)...');
    const pdfResult = await reportService.exportReportToPDF(mockDepartmentalData);
    console.log(`   ✓ PDF generated: ${pdfResult.filename}`);
    console.log(`   ✓ Size: ${(pdfResult.data.length / 1024).toFixed(2)} KB`);
    console.log(`   ✓ Format: ${pdfResult.format}`);
    
    // Save for manual inspection
    const pdfPath = path.join(__dirname, 'test-dept-report.pdf');
    fs.writeFileSync(pdfPath, pdfResult.data);
    console.log(`   ✓ Saved to: ${pdfPath}\n`);

    // Test 2: XLSX Export - Departmental Report
    console.log('2. Testing XLSX Export (Departmental Report)...');
    const xlsxResult = await reportService.exportReportToSpreadsheet(mockDepartmentalData, 'xlsx');
    console.log(`   ✓ XLSX generated: ${xlsxResult.filename}`);
    console.log(`   ✓ Size: ${(xlsxResult.data.length / 1024).toFixed(2)} KB`);
    console.log(`   ✓ Format: ${xlsxResult.format}`);
    
    const xlsxPath = path.join(__dirname, 'test-dept-report.xlsx');
    fs.writeFileSync(xlsxPath, xlsxResult.data);
    console.log(`   ✓ Saved to: ${xlsxPath}\n`);

    // Test 3: CSV Export - Departmental Report
    console.log('3. Testing CSV Export (Departmental Report)...');
    const csvResult = await reportService.exportReportToSpreadsheet(mockDepartmentalData, 'csv');
    console.log(`   ✓ CSV generated: ${csvResult.filename}`);
    console.log(`   ✓ Size: ${(csvResult.data.length / 1024).toFixed(2)} KB`);
    console.log(`   ✓ Format: ${csvResult.format}`);
    
    const csvPath = path.join(__dirname, 'test-dept-report.csv');
    fs.writeFileSync(csvPath, csvResult.data);
    console.log(`   ✓ Saved to: ${csvPath}\n`);

    // Test 4: PDF Export - Task Report
    console.log('4. Testing PDF Export (Task Report)...');
    const taskPdfResult = await reportService.exportReportToPDF(mockTaskData);
    console.log(`   ✓ PDF generated: ${taskPdfResult.filename}`);
    console.log(`   ✓ Size: ${(taskPdfResult.data.length / 1024).toFixed(2)} KB`);
    
    const taskPdfPath = path.join(__dirname, 'test-task-report.pdf');
    fs.writeFileSync(taskPdfPath, taskPdfResult.data);
    console.log(`   ✓ Saved to: ${taskPdfPath}\n`);

    // Test 5: XLSX Export - Task Report
    console.log('5. Testing XLSX Export (Task Report)...');
    const taskXlsxResult = await reportService.exportReportToSpreadsheet(mockTaskData, 'xlsx');
    console.log(`   ✓ XLSX generated: ${taskXlsxResult.filename}`);
    console.log(`   ✓ Size: ${(taskXlsxResult.data.length / 1024).toFixed(2)} KB`);
    
    const taskXlsxPath = path.join(__dirname, 'test-task-report.xlsx');
    fs.writeFileSync(taskXlsxPath, taskXlsxResult.data);
    console.log(`   ✓ Saved to: ${taskXlsxPath}\n`);

    console.log('✅ All export tests completed successfully!');
    console.log('\nFormatting improvements applied:');
    console.log('  • Removed emoji characters from PDFs');
    console.log('  • Added proper String/Number type casting for Excel/CSV');
    console.log('  • Added ellipsis and lineBreak options for text overflow prevention');
    console.log('  • Improved date formatting');
    console.log('  • Added UTF-8 encoding and compression for spreadsheets');
    console.log('\nPlease manually inspect the generated files to verify formatting.');

  } catch (error) {
    console.error('❌ Export test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testExportFormatting();
