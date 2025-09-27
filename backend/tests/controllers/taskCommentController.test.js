const CJS_PATH = '../../src/services/tasks/taskCommentService';
const ESM_PATH = '../../src/services/tasks/taskCommentService.js';

describe('taskCommentController', () => {
    // Helper to force a fresh controller instance (and reset internal _servicePromise)
    const freshController = async () => {
        jest.resetModules();
        return require('../../src/controllers/tasks/taskCommentController.js');
    };

    describe('CJS: instance export (taskCommentService)', () => {
        it('delegates to service methods with correct args', async () => {
            jest.resetModules();

            // NOTE: prefix with "mock" so Jest allows referencing them in factory
            const mockListThread = jest.fn().mockResolvedValue([{ id: 1 }]);
            const mockAddComment = jest.fn().mockResolvedValue({ id: 2 });
            const mockEditComment = jest.fn().mockResolvedValue({ id: 3 });

            jest.mock(CJS_PATH, () => ({
                taskCommentService: {
                    listThread: mockListThread,
                    addComment: mockAddComment,
                    editComment: mockEditComment
                }
            }), { virtual: true });

            const ctrl = await freshController();

            // listForTask
            const listRes = await ctrl.listForTask(42);
            expect(mockListThread).toHaveBeenCalledWith(42);
            expect(listRes).toEqual([{ id: 1 }]);

            // createForTask (default parentId -> null)
            const createBody = { content: 'Hi', userId: 7 };
            const createRes = await ctrl.createForTask(42, createBody);
            expect(mockAddComment).toHaveBeenCalledWith({ taskId: 42, content: 'Hi', userId: 7, parentId: null });
            expect(createRes).toEqual({ id: 2 });

            // createForTask (explicit parentId)
            const createBody2 = { content: 'Reply', userId: 7, parentId: 99 };
            await ctrl.createForTask(42, createBody2);
            expect(mockAddComment).toHaveBeenCalledWith({ taskId: 42, content: 'Reply', userId: 7, parentId: 99 });

            // updateComment
            const updateBody = { content: 'Edit', userId: 7 };
            const updRes = await ctrl.updateComment(13, updateBody);
            expect(mockEditComment).toHaveBeenCalledWith({ id: 13, content: 'Edit', userId: 7 });
            expect(updRes).toEqual({ id: 3 });
        });
    });

    describe('CJS: class export (TaskCommentService)', () => {
        it('constructs service instance and delegates', async () => {
            jest.resetModules();

            const mockListThread = jest.fn().mockResolvedValue(['ok']);
            const mockAddComment = jest.fn().mockResolvedValue('created');
            const mockEditComment = jest.fn().mockResolvedValue('updated');

            // rename so it starts with 'mock' (Jest allows this in factories)
            class mockTaskCommentService {
                listThread = mockListThread;
                addComment = mockAddComment;
                editComment = mockEditComment;
            }

            jest.mock(CJS_PATH, () => ({ TaskCommentService: mockTaskCommentService }), { virtual: true });

            const ctrl = await freshController();

            await ctrl.listForTask(5);
            expect(mockListThread).toHaveBeenCalledWith(5);

            await ctrl.createForTask(9, { content: 'c', userId: 1 });
            expect(mockAddComment).toHaveBeenCalledWith({ taskId: 9, content: 'c', userId: 1, parentId: null });

            await ctrl.updateComment(77, { content: 'x', userId: 2 });
            expect(mockEditComment).toHaveBeenCalledWith({ id: 77, content: 'x', userId: 2 });
        });
    });

    describe('ESM fallback: require throws ERR_REQUIRE_ESM, dynamic import used', () => {
    it('imports ESM module and delegates to its instance', async () => {
      jest.resetModules();

      // Make CJS require throw ERR_REQUIRE_ESM
      jest.mock(CJS_PATH, () => {
        const err = new Error('ESM only');
        err.code = 'ERR_REQUIRE_ESM';
        throw err;
      }, { virtual: true });

      const mockListThread  = jest.fn().mockResolvedValue(['esm']);
      const mockAddComment  = jest.fn().mockResolvedValue('esm-created');
      const mockEditComment = jest.fn().mockResolvedValue('esm-updated');

      const ctrl = await freshController();

      // <-- stub the controller's importer so we don't need VM modules
      ctrl.__setImporter(async (path) => {
        return {
          taskCommentService: {
            listThread: mockListThread,
            addComment: mockAddComment,
            editComment: mockEditComment,
          }
        };
      });

      await ctrl.listForTask(101);
      expect(mockListThread).toHaveBeenCalledWith(101);

      await ctrl.createForTask(202, { content: 'E', userId: 11 });
      expect(mockAddComment).toHaveBeenCalledWith({ taskId: 202, content: 'E', userId: 11, parentId: null });

      await ctrl.updateComment(303, { content: 'F', userId: 12 });
      expect(mockEditComment).toHaveBeenCalledWith({ id: 303, content: 'F', userId: 12 });
    });

    it('imports ESM module that exports a class', async () => {
      jest.resetModules();

      jest.mock(CJS_PATH, () => {
        const err = new Error('ESM only');
        err.code = 'ERR_REQUIRE_ESM';
        throw err;
      }, { virtual: true });

      const mockListThread  = jest.fn().mockResolvedValue(['esm-class']);
      const mockAddComment  = jest.fn().mockResolvedValue('esm-class-created');
      const mockEditComment = jest.fn().mockResolvedValue('esm-class-updated');

      class mockTaskCommentService {
        listThread = mockListThread;
        addComment = mockAddComment;
        editComment = mockEditComment;
      }

      const ctrl = await freshController();

      ctrl.__setImporter(async (path) => {
        return { TaskCommentService: mockTaskCommentService };
      });

      await ctrl.listForTask(1);
      expect(mockListThread).toHaveBeenCalledWith(1);

      await ctrl.createForTask(2, { content: 'Z', userId: 3 });
      expect(mockAddComment).toHaveBeenCalledWith({ taskId: 2, content: 'Z', userId: 3, parentId: null });

      await ctrl.updateComment(4, { content: 'Y', userId: 5 });
      expect(mockEditComment).toHaveBeenCalledWith({ id: 4, content: 'Y', userId: 5 });
    });
  });
});