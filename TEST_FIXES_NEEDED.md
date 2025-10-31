# Test Suite Fixes Needed

**Date:** 2025-10-27
**Overall Status:** 12/19 test suites passing (63%), 387/452 tests passing (85.6%)

## Executive Summary

The test suite is mostly functional but requires fixes in 7 test suites. The main issues are:
1. Missing authentication middleware mocking in route tests
2. Incomplete Supabase mock implementations in repository tests
3. Test timeout issues due to improper Promise handling

---

## ✅ Passing Test Suites (12/19)

These suites are working correctly:
- `tests/sample.test.js` - 3/3 tests passing
- `tests/controllers/userController.test.js` - 24/24 tests passing
- `tests/services/userService.test.js` - 22/22 tests passing
- `tests/services/projectService.test.js` - 19/19 tests passing
- `tests/controllers/taskCommentController.test.js` - 4/4 tests passing
- `tests/controllers/projectTasksController.test.js` - passing
- `tests/services/projectTasksService.test.js` - passing
- `tests/controllers/taskController.test.js` - passing
- `tests/controllers/projectController.test.js` - passing
- `tests/services/notificationService.test.js` - passing
- `tests/services/taskService.test.js` - passing
- `tests/services/reportService.test.js` - passing

---

## ❌ Failing Test Suites (7/19)

### 🔴 PRIORITY 1: Route Tests - Authentication Middleware Missing

#### Affected Files:
- `backend/tests/routes/projectTasks.test.js`
- `backend/tests/routes/reports.test.js`

#### Error Pattern:
```
expected 200 "OK", got 401 "Unauthorized"
```

All 32 tests in `projectTasks.test.js` are failing because requests are being rejected by authentication middleware.

#### Fix Required:

**Location:** `backend/tests/routes/projectTasks.test.js:24-28`

**Current Code:**
```javascript
beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/projects', projectTasksRoutes);

  // Set environment variables for testing
  process.env.SUPABASE_URL_LT = 'http://localhost:54321';
  process.env.SUPABASE_SECRET_KEY_LT = 'test-key';
});
```

**Fixed Code:**
```javascript
beforeEach(() => {
  app = express();
  app.use(express.json());

  // Mock authentication middleware - ADD THIS SECTION
  app.use((req, res, next) => {
    req.user = {
      id: 1,
      role: 'admin',
      email: 'test@test.com',
      department: 'Engineering'
    };
    next();
  });

  app.use('/projects', projectTasksRoutes);

  // Set environment variables for testing
  process.env.SUPABASE_URL_LT = 'http://localhost:54321';
  process.env.SUPABASE_SECRET_KEY_LT = 'test-key';
});
```

**Apply same fix to:** `backend/tests/routes/reports.test.js`

---

### 🔴 PRIORITY 2: ReportRepository - Incomplete Supabase Mocking

#### Affected File:
- `backend/tests/repository/reportRepository.test.js`

#### Errors:
1. **11 tests failing total**
2. **7 tests timing out** (exceeded 5000ms timeout)
   - `getTasksForReport › should retrieve all task fields needed for report`
   - `getUsersByDepartment › should retrieve users in a specific department`
   - `getUsersByDepartment › should retrieve users in department hierarchy`
   - `getProjectsByDepartment › should retrieve projects filtered by department users`
   - `getTaskStatisticsByStatus › should aggregate tasks by status`
   - `getTaskStatisticsByPriority › should aggregate tasks by priority`
   - `getTaskStatisticsByUser › should aggregate tasks by assigned user`
   - `getDepartmentComparison › should return department statistics` (2 tests)

3. **2 tests with mock implementation errors:**
   - Error: `TypeError: supabase.from(...).select(...).not is not a function`
   - Error: `expect(received).toEqual(expected)` - receiving `null` instead of data

#### Root Cause:
The Supabase mock is incomplete and doesn't include all the chaining methods used in the repository.

#### Fix Required:

**Location:** Top of `backend/tests/repository/reportRepository.test.js`

**Current Mock (Incomplete):**
```javascript
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 1 },
            error: null
          })
        }))
      }))
    }))
  }))
}));
```

**Fixed Mock (Complete):**
```javascript
// Create a complete chainable mock for Supabase
const createMockSupabaseClient = (mockData = [], mockError = null) => {
  const mockChain = {
    select: jest.fn(() => mockChain),
    from: jest.fn(() => mockChain),
    eq: jest.fn(() => mockChain),
    neq: jest.fn(() => mockChain),
    in: jest.fn(() => mockChain),
    contains: jest.fn(() => mockChain),
    containedBy: jest.fn(() => mockChain),
    gt: jest.fn(() => mockChain),
    gte: jest.fn(() => mockChain),
    lt: jest.fn(() => mockChain),
    lte: jest.fn(() => mockChain),
    like: jest.fn(() => mockChain),
    ilike: jest.fn(() => mockChain),
    is: jest.fn(() => mockChain),
    not: jest.fn(() => mockChain),
    or: jest.fn(() => mockChain),
    filter: jest.fn(() => mockChain),
    match: jest.fn(() => mockChain),
    order: jest.fn(() => mockChain),
    limit: jest.fn(() => mockChain),
    range: jest.fn(() => mockChain),
    single: jest.fn(() => Promise.resolve({ data: mockData[0] || null, error: mockError })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: mockData[0] || null, error: mockError })),
    then: jest.fn((resolve) => Promise.resolve({ data: mockData, error: mockError }).then(resolve)),
  };

  return {
    from: jest.fn(() => mockChain),
  };
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => createMockSupabaseClient()),
}));
```

**Additional Changes Needed:**

For each test that's timing out, ensure the mock returns proper resolved Promises. Example:

**Before:**
```javascript
test('should retrieve all task fields needed for report', async () => {
  const mockTasks = [{ id: 1, title: 'Task 1', /* ... */ }];
  // Mock setup missing proper resolution
});
```

**After:**
```javascript
test('should retrieve all task fields needed for report', async () => {
  const mockTasks = [{ id: 1, title: 'Task 1', /* ... */ }];

  // Recreate the mock for this specific test
  const supabase = require('@supabase/supabase-js').createClient();
  supabase.from.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        then: jest.fn((resolve) =>
          Promise.resolve({ data: mockTasks, error: null }).then(resolve)
        )
      })
    })
  });

  const result = await reportRepository.getTasksForReport(1);
  expect(result.data).toHaveLength(mockTasks.length);
});
```

**Or increase timeout temporarily while fixing:**
```javascript
test('should retrieve all task fields needed for report', async () => {
  // ... test code
}, 10000); // Increase timeout to 10 seconds
```

---

### 🔴 PRIORITY 3: ProjectRepository Tests

#### Affected File:
- `backend/tests/repository/projectRepository.test.js`

#### Issue:
Similar Supabase mocking issues as reportRepository.

#### Fix Required:
Apply the same complete Supabase mock pattern from the reportRepository fix above.

---

### 🟡 PRIORITY 4: Integration Tests

#### Affected File:
- `backend/tests/integration/api.test.js`

#### Likely Issues:
1. May need authentication mocking similar to route tests
2. May need complete Supabase mocking
3. May need environment variables set

#### Investigation Needed:
Run this test individually to see specific errors:
```bash
npm test -- tests/integration/api.test.js
```

Then apply appropriate fixes from the patterns above.

---

### 🟡 PRIORITY 5: RBAC Middleware Tests

#### Affected File:
- `backend/tests/middleware/rbac-reports.test.js`

#### Likely Issues:
RBAC middleware configuration or mocking issues.

#### Investigation Needed:
Run this test individually:
```bash
npm test -- tests/middleware/rbac-reports.test.js
```

---

### 🟡 PRIORITY 6: Report Controller Tests

#### Affected File:
- `backend/tests/controllers/reportController.test.js`

#### Likely Issues:
May depend on reportRepository fixes. Address after fixing reportRepository.

#### Investigation Needed:
Run after fixing reportRepository:
```bash
npm test -- tests/controllers/reportController.test.js
```

---

## ⚠️ Non-Breaking Warnings

### 1. Supabase Mock Warnings in projectService Tests

**Location:** `backend/src/services/projectService.js:389`

**Warning:**
```
Error creating project invitation notification:
TypeError: supabase.from(...).insert is not a function
```

**Impact:** Tests still pass, but console output is noisy.

**Fix:** Update Supabase mock to include `.insert()` method:
```javascript
const mockChain = {
  // ... existing methods
  insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  update: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  delete: jest.fn(() => Promise.resolve({ data: {}, error: null })),
};
```

### 2. Console Logging Pollution

**Issue:** Multiple `console.log` and `console.error` statements in source code pollute test output.

**Recommendation:**
Option A - Mock console in test setup:
```javascript
// In backend/tests/setup.js
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn for debugging test failures
  error: console.error,
  warn: console.warn,
};
```

Option B - Replace with proper logger (winston, pino) in production code.

---

## 🔧 Optional Improvements

### 1. Centralize Supabase Mocking

Instead of mocking Supabase in each test file, create a centralized mock:

**Create:** `backend/tests/__mocks__/@supabase/supabase-js.js`

```javascript
const createMockSupabaseClient = () => {
  const mockChain = {
    select: jest.fn(() => mockChain),
    from: jest.fn(() => mockChain),
    eq: jest.fn(() => mockChain),
    neq: jest.fn(() => mockChain),
    in: jest.fn(() => mockChain),
    not: jest.fn(() => mockChain),
    is: jest.fn(() => mockChain),
    order: jest.fn(() => mockChain),
    limit: jest.fn(() => mockChain),
    range: jest.fn(() => mockChain),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    update: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    delete: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    then: jest.fn((resolve) => Promise.resolve({ data: [], error: null }).then(resolve)),
  };

  return {
    from: jest.fn(() => mockChain),
  };
};

module.exports = {
  createClient: jest.fn(() => createMockSupabaseClient()),
};
```

Then in test files, just use:
```javascript
jest.mock('@supabase/supabase-js');
```

### 2. Create Test Utilities

**Create:** `backend/tests/utils/testHelpers.js`

```javascript
/**
 * Creates a mock Express request with authenticated user
 */
function createMockRequest(overrides = {}) {
  return {
    user: {
      id: 1,
      role: 'admin',
      email: 'test@test.com',
      department: 'Engineering',
      ...overrides.user,
    },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

/**
 * Creates a mock Express response
 */
function createMockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Creates a mock Express app with auth middleware
 */
function createMockAuthApp(router) {
  const express = require('express');
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.user = {
      id: 1,
      role: 'admin',
      email: 'test@test.com',
      department: 'Engineering'
    };
    next();
  });

  app.use(router);
  return app;
}

module.exports = {
  createMockRequest,
  createMockResponse,
  createMockAuthApp,
};
```

---

## 📋 Fix Checklist

Use this checklist to track progress:

- [ ] **PRIORITY 1:** Fix authentication mocking in `tests/routes/projectTasks.test.js`
- [ ] **PRIORITY 1:** Fix authentication mocking in `tests/routes/reports.test.js`
- [ ] **PRIORITY 2:** Fix Supabase mocking in `tests/repository/reportRepository.test.js`
- [ ] **PRIORITY 2:** Fix timeout issues in `tests/repository/reportRepository.test.js` (7 tests)
- [ ] **PRIORITY 3:** Fix Supabase mocking in `tests/repository/projectRepository.test.js`
- [ ] **PRIORITY 4:** Investigate and fix `tests/integration/api.test.js`
- [ ] **PRIORITY 5:** Investigate and fix `tests/middleware/rbac-reports.test.js`
- [ ] **PRIORITY 6:** Investigate and fix `tests/controllers/reportController.test.js`
- [ ] **Optional:** Create centralized Supabase mock at `tests/__mocks__/@supabase/supabase-js.js`
- [ ] **Optional:** Create test utilities at `tests/utils/testHelpers.js`
- [ ] **Optional:** Mock console methods in `tests/setup.js` to reduce noise
- [ ] **Optional:** Replace console.log with proper logger in production code

---

## 🚀 Commands to Run

**Run all tests:**
```bash
cd backend && npm test
```

**Run specific test suite:**
```bash
npm test -- tests/routes/projectTasks.test.js
npm test -- tests/repository/reportRepository.test.js
npm test -- tests/integration/api.test.js
```

**Run with verbose output:**
```bash
npm test -- --verbose
```

**Run with coverage:**
```bash
npm test -- --coverage
```

---

## 📊 Expected Outcome After Fixes

After completing all fixes:
- Test Suites: **19/19 passing (100%)**
- Tests: **~450+/452 passing (99%+)**
- All route tests should pass with proper auth mocking
- All repository tests should pass with complete Supabase mocks
- Clean console output without warnings

---

## 🆘 Getting Help

If you encounter issues while fixing:

1. Check if Supabase mock chain is complete (has all methods used)
2. Verify authentication middleware is applied before routes
3. Ensure all Promises in mocks properly resolve
4. Check test timeouts - increase if needed for investigation
5. Run individual test files to isolate issues

Good luck! 🎯
