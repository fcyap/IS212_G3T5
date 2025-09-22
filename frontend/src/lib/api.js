// API service for communicating with the backend
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
    
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
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
    const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update project ${id}: ${response.statusText}`);
    }
    return response.json();
  }

  async deleteProject(id) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete project ${id}: ${response.statusText}`);
    }
    return response.json();
  }

  async addUserToProject(projectId, userId) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add user ${userId} to project ${projectId}: ${response.statusText}`);
    }
    return response.json();
  }

  async removeUserFromProject(projectId, userId) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/users/${userId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to remove user ${userId} from project ${projectId}: ${response.statusText}`);
    }
    return response.json();
  }
}

export const projectService = new ProjectService();
