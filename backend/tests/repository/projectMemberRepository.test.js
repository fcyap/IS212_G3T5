const projectMemberRepository = require('../../src/repository/projectMemberRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('ProjectMemberRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjectIdsForUser', () => {
    it('should return empty array for invalid userId', async () => {
      const result = await projectMemberRepository.getProjectIdsForUser('invalid');
      expect(result).toEqual([]);
    });

    it('should return empty array for null userId', async () => {
      const result = await projectMemberRepository.getProjectIdsForUser(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined userId', async () => {
      const result = await projectMemberRepository.getProjectIdsForUser(undefined);
      expect(result).toEqual([]);
    });

    it('should return project IDs for valid userId', async () => {
      const mockData = [
        { project_id: 1 },
        { project_id: 2 },
        { project_id: 3 }
      ];

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockData,
            error: null
          })
        })
      });

      const result = await projectMemberRepository.getProjectIdsForUser(123);
      expect(result).toEqual([1, 2, 3]);
      expect(supabase.from).toHaveBeenCalledWith('project_members');
    });

    it('should return empty array on supabase error', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });

      const result = await projectMemberRepository.getProjectIdsForUser(123);
      expect(result).toEqual([]);
    });

    it('should handle unexpected errors gracefully', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(new Error('Unexpected error'))
        })
      });

      const result = await projectMemberRepository.getProjectIdsForUser(123);
      expect(result).toEqual([]);
    });

    it('should filter out non-finite project IDs', async () => {
      const mockData = [
        { project_id: 1 },
        { project_id: 'invalid' },
        { project_id: 2 }
      ];

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockData,
            error: null
          })
        })
      });

      const result = await projectMemberRepository.getProjectIdsForUser(123);
      // Note: Number('invalid') becomes NaN, which is filtered out by Number.isFinite
      expect(result).toEqual([1, 2]);
    });

    it('should handle empty data array', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      const result = await projectMemberRepository.getProjectIdsForUser(123);
      expect(result).toEqual([]);
    });
  });
});
