// API service for communicating with the backend
import { fetchWithCsrf } from './csrf';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ProjectService {
  async getAllProjects() {
    const response = await fetch(`${API_BASE_URL}/api/projects`);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch projects');
    }
    return data.projects; // Return just the projects array
  }

  async getProjectById(id) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch project ${id}: ${response.statusText}`);
    }
    return response.json();
  }

  async createProject(projectData) {
    // Transform the data to match backend expectations
    const backendData = {
      name: projectData.project_name,
      description: projectData.description,
      user_ids: projectData.user_ids,
      creator_id: projectData.creator_id
    };

    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create project: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to create project');
    }
    return data.project; // Return just the project object
  }

  async updateProject(id, projectData) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Failed to update project ${id}: ${response.statusText}`);
    }
    return response.json();
  }

  async deleteProject(id) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project ${id}: ${response.statusText}`);
    }
    return response.json();
  }

  async getProjectMembers(projectId) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/members`);
    if (!response.ok) {
      throw new Error(`Failed to fetch members for project ${projectId}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch project members');
    }
    return data.members;
  }

  async archiveProject(projectId) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects/${projectId}/archive`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      throw new Error(`Failed to archive project ${projectId}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to archive project');
    }
    return data.project;
  }

  async addUserToProject(projectId, userId) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIds: [userId] }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add user ${userId} to project ${projectId}: ${response.statusText}`);
    }
    return response.json();
  }

  async removeUserFromProject(projectId, userId) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to remove user ${userId} from project ${projectId}: ${response.statusText}`);
    }
    return response.json();
  }
}

class ProjectTasksService {
  async getProjectTasks(projectId, options = {}) {
    const queryParams = new URLSearchParams();

    // Add filters
    if (options.filters) {
      if (options.filters.status) queryParams.append('status', options.filters.status);
      if (options.filters.assignedTo) queryParams.append('assignedTo', options.filters.assignedTo);
      if (options.filters.priority) queryParams.append('priority', options.filters.priority);
    }

    // Add pagination
    if (options.pagination) {
      if (options.pagination.page) queryParams.append('page', options.pagination.page);
      if (options.pagination.limit) queryParams.append('limit', options.pagination.limit);
    }

    // Add sorting
    if (options.sorting) {
      if (options.sorting.sortBy) queryParams.append('sortBy', options.sorting.sortBy);
      if (options.sorting.sortOrder) queryParams.append('sortOrder', options.sorting.sortOrder);
    }

    const url = `${API_BASE_URL}/api/projects/${projectId}/tasks${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks for project ${projectId}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch project tasks');
    }
    return data.tasks; // Return just the tasks array
  }

  async getTaskById(projectId, taskId) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task ${taskId}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch task');
    }
    return data.task;
  }

  async createTask(projectId, taskData) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to create task: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to create task');
    }
    return data.task;
  }

  async updateTask(taskId, taskData) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to update task: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update task');
    }
    return data.task;
  }

  async deleteTask(taskId) {
    const response = await fetchWithCsrf(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to delete task: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete task');
    }
    return data;
  }

  async getTaskStats(projectId) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/tasks/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task stats for project ${projectId}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch task stats');
    }
    return data.stats;
  }

  async getAllTasks(options = {}) {
    const queryParams = new URLSearchParams();

    // Add filters
    if (options.filters) {
      if (options.filters.status) queryParams.append('status', options.filters.status);
      if (options.filters.project_id) queryParams.append('project_id', options.filters.project_id);
      if (options.filters.assigned_to) queryParams.append('assigned_to', options.filters.assigned_to);
      if (options.filters.priority) queryParams.append('priority', options.filters.priority);
    }

    // Add pagination
    if (options.pagination) {
      if (options.pagination.page) queryParams.append('page', options.pagination.page);
      if (options.pagination.limit) queryParams.append('limit', options.pagination.limit);
    }

    // Add sorting
    if (options.sorting) {
      if (options.sorting.sortBy) queryParams.append('sortBy', options.sorting.sortBy);
      if (options.sorting.sortOrder) queryParams.append('sortOrder', options.sorting.sortOrder);
    }

    const url = `${API_BASE_URL}/api/tasks${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch all tasks: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch tasks');
    }
    return data.tasks;
  }
}

class UserService {
  async getUserById(id) {
    const response = await fetch(`${API_BASE_URL}/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user ${id}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch user');
    }
    return data.user;
  }

  async getAllUsers() {
    const response = await fetch(`${API_BASE_URL}/api/users`);
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch users');
    }
    return data.users;
  }
}

export const projectService = new ProjectService();
export const projectTasksService = new ProjectTasksService();
export const userService = new UserService();
