# Coverage Task: Routes & Jobs

**Branch:** `coverage/routes`
**Target:** 0% coverage route files
**Estimated Impact:** +90 lines covered

## Files to Test

### 1. `src/routes/reports.js` - 0% Coverage
- **Lines:** 23 lines, 2 functions
- **Purpose:** Report generation routes
- **Routes to test:**
  - Report listing
  - Report generation endpoints
  - Report download/export

### 2. `src/routes/taskFiles.js` - 0% Coverage
- **Lines:** 16 lines, 1 function
- **Purpose:** Task file upload/management routes
- **Routes to test:**
  - File upload
  - File listing for tasks
  - File metadata retrieval

### 3. `src/routes/taskFilesDelete.js` - 0% Coverage
- **Lines:** 7 lines
- **Purpose:** Task file deletion routes
- **Routes to test:**
  - File deletion endpoint

### 4. `src/jobs/checkOverdueTasks.js` - 0% Coverage
- **Lines:** 44 lines, 3 functions
- **Purpose:** Background job for checking overdue tasks
- **Functions to test:**
  - `checkOverdueTasks` - Main job function
  - Notification creation for overdue tasks
  - Task status updates
  - Error handling

## Testing Strategy

### Approach:
1. **Simple routes first** (taskFiles, taskFilesDelete) - Quick wins
2. **Reports routes** - More complex
3. **Background job** - Separate test suite

### Mocking Requirements:
- Mock route controllers
- Mock task/file services
- Mock notification service for jobs
- Mock Supabase queries for background job

### Test Structure:

#### Routes:
```javascript
describe('Report Routes', () => {
  test('should call report controller for GET /reports', async () => {
    await request(app).get('/reports');
    expect(reportController.getReports).toHaveBeenCalled();
  });
});
```

#### Background Job:
```javascript
describe('checkOverdueTasks Job', () => {
  test('should identify overdue tasks', async () => {
    // Mock tasks with past due dates
    // Run job
    // Verify notifications created
  });

  test('should handle no overdue tasks', async () => {
    // Mock no overdue tasks
    // Run job
    // Verify no notifications
  });
});
```

## Commands

```bash
# Run tests for this area
cd backend && npm test -- tests/routes/reports.test.js tests/routes/taskFiles.test.js tests/jobs/checkOverdueTasks.test.js

# Run with coverage
npm test -- --coverage --collectCoverageFrom="src/routes/reports.js" --collectCoverageFrom="src/routes/taskFiles*.js" --collectCoverageFrom="src/jobs/**/*.js"

# Run all tests
npm test
```

## Success Criteria

- All 4 files have >95% coverage
- All tests pass (100%)
- Route wiring verified
- Background job logic tested (overdue detection, notifications)
- Error handling covered
- Ready to commit and push

## Commit Strategy

Commit after logical groups:
1. "Add tests for taskFiles routes"
2. "Add tests for reports routes"
3. "Add tests for checkOverdueTasks job"

## Claude Code Quick Start

```
Continue with the coverage improvements. Focus on the files listed in COVERAGE_TASK.md.
Start with the simple route files (taskFiles, taskFilesDelete), then reports routes,
then the background job. Commit after completing each logical group.
Make sure all tests pass 100%.
```
