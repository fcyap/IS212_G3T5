# Coverage Task: Services

**Branch:** `coverage/services`
**Target:** Service layer files with 55-77% coverage
**Estimated Impact:** +600 lines covered

## Files to Test

### 1. `src/services/projectTasksService.js` - 55.98% Coverage (HIGH PRIORITY)
- **Lines:** 384 lines, 45 functions
- **Current:** Only 215/384 lines covered
- **Purpose:** Business logic for project-task relationships
- **Key areas:**
  - Task assignment to projects
  - Task reordering within projects
  - Project task filtering
  - Bulk operations

### 2. `src/services/tasks/taskCommentService.js` - 60% Coverage (HIGH PRIORITY)
- **Lines:** 100 lines, 23 functions
- **Current:** 60/100 lines covered
- **Purpose:** Task comment functionality
- **Key areas:**
  - Comment creation/deletion
  - Comment threads
  - Comment permissions
  - Comment notifications

### 3. `src/services/notificationService.js` - 62.12% Coverage (LARGE FILE)
- **Lines:** 660 lines, 77 functions
- **Current:** 410/660 lines covered
- **Purpose:** Notification system
- **Key areas:**
  - Notification creation
  - Notification delivery
  - Notification types (task, project, system)
  - Bulk notifications
  - Email notifications

### 4. `src/services/projectService.js` - 66.86% Coverage
- **Lines:** 166 lines, 22 functions
- **Current:** 111/166 lines covered
- **Purpose:** Project management business logic
- **Key areas:**
  - Project validation
  - Member management
  - Project statistics
  - Project archival

### 5. `src/services/reportService.js` - 75.44% Coverage
- **Lines:** 729 lines, 118 functions (LARGEST FILE)
- **Current:** 550/729 lines covered
- **Purpose:** Report generation and analytics
- **Key areas:**
  - Report data aggregation
  - Chart data generation
  - Export formatting
  - Custom date ranges

### 6. `src/services/taskService.js` - 76.62% Coverage
- **Lines:** 599 lines, 87 functions (LARGE FILE)
- **Current:** 459/599 lines covered
- **Purpose:** Core task management logic
- **Key areas:**
  - Task lifecycle (create, update, complete, archive)
  - Task assignment
  - Task dependencies
  - Task validation

## Testing Strategy

### Approach:
1. **taskCommentService** - Smallest, quick win
2. **projectService** - Medium complexity
3. **projectTasksService** - Relationship logic
4. **notificationService** - Large but modular
5. **taskService** - Large, core logic
6. **reportService** - Largest, complex queries

### Mocking Requirements:
- Mock repository layer
- Mock notification system
- Mock email sending
- Mock date/time utilities
- Mock file system for exports

### Test Structure:

```javascript
describe('TaskCommentService', () => {
  describe('createComment', () => {
    test('should create comment with valid data', async () => {
      const commentData = {
        task_id: 1,
        user_id: 1,
        comment_text: 'Test comment'
      };

      taskCommentRepository.create.mockResolvedValue({
        comment_id: 1,
        ...commentData
      });

      const result = await taskCommentService.createComment(commentData);

      expect(result.comment_id).toBe(1);
      expect(taskCommentRepository.create).toHaveBeenCalledWith(commentData);
    });

    test('should send notification to task owner', async () => {
      // Test notification creation
    });

    test('should validate comment text length', async () => {
      // Test validation
    });
  });
});
```

## Commands

```bash
# Run tests for this area
cd backend && npm test -- tests/services/

# Run with coverage
npm test -- --coverage --collectCoverageFrom="src/services/**/*.js"

# Run specific service
npm test -- tests/services/taskCommentService.test.js --coverage

# Run all tests
npm test
```

## Success Criteria

- projectTasksService: 56% → >80% coverage
- taskCommentService: 60% → >85% coverage
- notificationService: 62% → >80% coverage
- projectService: 67% → >85% coverage
- reportService: 75% → >85% coverage
- taskService: 77% → >85% coverage
- All tests pass (100%)
- Business logic thoroughly tested
- Edge cases covered
- Ready to commit and push

## Key Testing Areas

### Task Comment Service:
- [ ] Comment CRUD operations
- [ ] Thread management
- [ ] Permission checks
- [ ] Notification triggers
- [ ] Validation

### Project Service:
- [ ] Project creation validation
- [ ] Member management logic
- [ ] Project statistics calculation
- [ ] Archival/restoration

### Project Tasks Service:
- [ ] Task-project assignment
- [ ] Task reordering
- [ ] Filtering and sorting
- [ ] Bulk operations

### Notification Service:
- [ ] Notification creation
- [ ] Notification types
- [ ] Delivery methods (in-app, email)
- [ ] Bulk notifications
- [ ] Notification preferences

### Task Service:
- [ ] Task lifecycle management
- [ ] Assignment logic
- [ ] Dependency handling
- [ ] Status transitions
- [ ] Validation rules

### Report Service:
- [ ] Data aggregation
- [ ] Chart generation
- [ ] Export formatting (CSV, PDF)
- [ ] Custom date ranges
- [ ] Performance metrics

## Commit Strategy

1. "Add comprehensive tests for taskCommentService"
2. "Expand projectService test coverage"
3. "Add tests for projectTasksService"
4. "Expand notificationService test coverage"
5. "Add missing tests for taskService"
6. "Complete reportService test coverage"

## Claude Code Quick Start

```
Continue with the coverage improvements. Focus on the files listed in COVERAGE_TASK.md.
Start with taskCommentService (smallest), then projectService, projectTasksService,
notificationService, taskService, and finally reportService (largest).
These are business logic layer tests. Work through them systematically.
Commit after completing each service. Make sure all tests pass 100%.
```
