const request = require('supertest');
const app = require('../../src/index');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('Task Attachment Integration Tests', () => {
  let authToken;
  let testTaskId;
  let testUserId;

  beforeEach(() => {
    jest.clearAllMocks();
    testUserId = 1;
    testTaskId = 123;
    authToken = 'mock-auth-token';
  });

  describe('POST /api/tasks/:taskId/attachments - Upload Attachments', () => {
    test('should successfully upload multiple valid files', async () => {
      // Mock authentication
      const mockSession = {
        user_id: testUserId,
        role: 'staff',
        hierarchy: 1,
        division: 'Engineering'
      };

      // Mock task exists
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: testTaskId, title: 'Test Task' },
              error: null
            })
          })
        })
      });

      // Mock getting current total size
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      // Mock storage upload
      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/document.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/document.pdf' }
          })
        })
      };

      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', Buffer.from('pdf content'), 'document.pdf')
        .attach('files', Buffer.from('image content'), 'image.png');

      expect(response.status).toBe(201);
      expect(response.body.attachments).toBeDefined();
      expect(response.body.totalSize).toBeDefined();
    });

    test('should reject upload when total size exceeds 50MB', async () => {
      const mockSession = {
        user_id: testUserId,
        role: 'staff'
      };

      // Mock large file scenario
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', largeBuffer, 'large_file.pdf');

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('50MB');
    });

    test('should reject invalid file formats', async () => {
      const mockSession = {
        user_id: testUserId,
        role: 'staff'
      };

      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', Buffer.from('exe content'), 'malware.exe');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid file format');
    });

    test('should reject upload without authentication', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .attach('files', Buffer.from('pdf content'), 'document.pdf');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tasks/:taskId/attachments - List Attachments', () => {
    test('should retrieve all attachments for a task', async () => {
      const mockAttachments = [
        {
          id: 1,
          task_id: testTaskId,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: testUserId,
          uploaded_at: '2025-10-20T10:00:00Z'
        },
        {
          id: 2,
          task_id: testTaskId,
          file_name: 'image.png',
          file_type: 'image/png',
          file_size: 2097152,
          file_url: 'https://storage.example.com/attachments/123/image.png',
          uploaded_by: testUserId,
          uploaded_at: '2025-10-20T10:00:01Z'
        }
      ];

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockAttachments,
              error: null
            })
          })
        })
      });

      const response = await request(app)
        .get(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attachments).toHaveLength(2);
      expect(response.body.totalSize).toBe(7340032);
    });

    test('should return empty array when task has no attachments', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const response = await request(app)
        .get(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attachments).toEqual([]);
      expect(response.body.totalSize).toBe(0);
    });
  });

  describe('DELETE /api/tasks/:taskId/attachments/:attachmentId - Delete Attachment', () => {
    test('should successfully delete an attachment', async () => {
      const attachmentId = 1;

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: attachmentId,
                task_id: testTaskId,
                uploaded_by: testUserId,
                file_url: 'https://storage.example.com/attachments/123/document.pdf'
              },
              error: null
            })
          })
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: attachmentId },
            error: null
          })
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({
            data: {},
            error: null
          })
        })
      };

      const response = await request(app)
        .delete(`/api/tasks/${testTaskId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
    });

    test('should reject deletion when user is not the uploader', async () => {
      const attachmentId = 1;
      const differentUserId = 2;

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: attachmentId,
                task_id: testTaskId,
                uploaded_by: differentUserId
              },
              error: null
            })
          })
        })
      });

      const response = await request(app)
        .delete(`/api/tasks/${testTaskId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Unauthorized');
    });

    test('should handle attachment not found', async () => {
      const attachmentId = 999;

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found', code: 'PGRST116' }
            })
          })
        })
      });

      const response = await request(app)
        .delete(`/api/tasks/${testTaskId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/tasks/:taskId/attachments/:attachmentId/download - Download Attachment', () => {
    test('should successfully download an attachment', async () => {
      const attachmentId = 1;
      const mockFileBuffer = Buffer.from('mock file content');

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: attachmentId,
                task_id: testTaskId,
                file_name: 'document.pdf',
                file_type: 'application/pdf',
                file_url: 'https://storage.example.com/attachments/123/document.pdf'
              },
              error: null
            })
          })
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: mockFileBuffer,
            error: null
          })
        })
      };

      const response = await request(app)
        .get(`/api/tasks/${testTaskId}/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('document.pdf');
    });

    test('should handle file not found in storage', async () => {
      const attachmentId = 1;

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: attachmentId,
                task_id: testTaskId,
                file_name: 'document.pdf',
                file_url: 'https://storage.example.com/attachments/123/document.pdf'
              },
              error: null
            })
          })
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'File not found' }
          })
        })
      };

      const response = await request(app)
        .get(`/api/tasks/${testTaskId}/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Recurring Task Attachment Inheritance', () => {
    test('should copy attachments when creating recurring task', async () => {
      const originalTaskId = 123;
      const newTaskId = 456;

      const mockOriginalAttachments = [
        {
          id: 1,
          task_id: originalTaskId,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: testUserId
        }
      ];

      // Mock getting attachments from original task
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockOriginalAttachments,
              error: null
            }),
            single: jest.fn().mockResolvedValue({
              data: { id: originalTaskId, title: 'Original Task' },
              error: null
            })
          })
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 2,
                task_id: newTaskId,
                file_name: 'document.pdf',
                file_type: 'application/pdf',
                file_size: 5242880,
                file_url: 'https://storage.example.com/attachments/456/document.pdf',
                uploaded_by: testUserId
              },
              error: null
            })
          })
        })
      });

      // Mock storage copy
      supabase.storage = {
        from: jest.fn().mockReturnValue({
          copy: jest.fn().mockResolvedValue({
            data: { path: 'attachments/456/document.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/456/document.pdf' }
          })
        })
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Recurring Task',
          parent_id: originalTaskId,
          is_recurring: true,
          copy_attachments: true
        });

      expect(response.status).toBe(201);
      // Verify attachments were copied
      expect(supabase.storage.from).toHaveBeenCalled();
    });

    test('should handle attachment copy failure gracefully', async () => {
      const originalTaskId = 123;

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 1,
                  task_id: originalTaskId,
                  file_name: 'document.pdf'
                }
              ],
              error: null
            })
          })
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          copy: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Copy failed' }
          })
        })
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Recurring Task',
          parent_id: originalTaskId,
          is_recurring: true,
          copy_attachments: true
        });

      // Task should still be created even if attachment copy fails
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('File Format Validation', () => {
    const validFormats = [
      { mimetype: 'application/pdf', filename: 'document.pdf' },
      { mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: 'document.docx' },
      { mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'spreadsheet.xlsx' },
      { mimetype: 'image/png', filename: 'image.png' },
      { mimetype: 'image/jpeg', filename: 'photo.jpg' }
    ];

    validFormats.forEach(({ mimetype, filename }) => {
      test(`should accept ${filename} format`, async () => {
        supabase.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        });

        const response = await request(app)
          .post(`/api/tasks/${testTaskId}/attachments`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('files', Buffer.from('content'), filename);

        expect(response.status).not.toBe(400);
      });
    });

    const invalidFormats = [
      { filename: 'script.exe' },
      { filename: 'archive.zip' },
      { filename: 'script.sh' },
      { filename: 'video.mp4' }
    ];

    invalidFormats.forEach(({ filename }) => {
      test(`should reject ${filename} format`, async () => {
        const response = await request(app)
          .post(`/api/tasks/${testTaskId}/attachments`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('files', Buffer.from('content'), filename);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Size Limit Validation', () => {
    test('should accept files totaling 49MB', async () => {
      const file1 = Buffer.alloc(25 * 1024 * 1024); // 25MB
      const file2 = Buffer.alloc(24 * 1024 * 1024); // 24MB

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', file1, 'file1.pdf')
        .attach('files', file2, 'file2.pdf');

      expect(response.status).not.toBe(413);
    });

    test('should reject files totaling 51MB', async () => {
      const file1 = Buffer.alloc(26 * 1024 * 1024); // 26MB
      const file2 = Buffer.alloc(25 * 1024 * 1024); // 25MB

      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', file1, 'file1.pdf')
        .attach('files', file2, 'file2.pdf');

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('50MB');
    });

    test('should reject when adding to existing attachments exceeds limit', async () => {
      // Mock existing attachments totaling 40MB
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              { file_size: 40 * 1024 * 1024 }
            ],
            error: null
          })
        })
      });

      const newFile = Buffer.alloc(15 * 1024 * 1024); // 15MB (total would be 55MB)

      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', newFile, 'newfile.pdf');

      expect(response.status).toBe(413);
    });
  });
});
