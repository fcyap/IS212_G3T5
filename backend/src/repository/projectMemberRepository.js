const supabase = require('../utils/supabase');

class ProjectMemberRepository {
  async getProjectIdsForUser(userId) {
    if (!Number.isFinite(Number(userId))) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', Number(userId));

      if (error) {
        console.error('[ProjectMemberRepository] Failed to fetch memberships:', error);
        return [];
      }

      return Array.isArray(data) ? data.map((row) => Number(row.project_id)).filter(Number.isFinite) : [];
    } catch (err) {
      console.error('[ProjectMemberRepository] Unexpected error:', err);
      return [];
    }
  }
}

module.exports = new ProjectMemberRepository();
