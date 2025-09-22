import { supabase } from "../utils/supabase.js";

export class TaskRepository {
  async listUnarchived() {
    return supabase
      .from("tasks")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true });
  }

  async insert(payload) {
    return supabase.from("tasks").insert(payload).select().single();
  }

  async updateById(id, patch) {
    return supabase.from("tasks").update(patch).eq("id", id).select().single();
  }

  async getUsersByIds(ids) {
    if (!ids?.length) return { data: [], error: null };
    return supabase.from("users").select("id, name").in("id", ids);
  }
}

export default new TaskRepository();
