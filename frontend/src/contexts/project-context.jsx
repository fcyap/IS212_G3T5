"use client"

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { projectService, projectTasksService } from '@/lib/api';
import { useSession } from '@/components/session-provider';

// Project context for state management
const ProjectContext = createContext();

// Project actions
const PROJECT_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_PROJECTS: 'SET_PROJECTS',
  ADD_PROJECT: 'ADD_PROJECT',
  UPDATE_PROJECT: 'UPDATE_PROJECT',
  DELETE_PROJECT: 'DELETE_PROJECT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_SELECTED_PROJECT: 'SET_SELECTED_PROJECT',
  SET_TASKS_LOADING: 'SET_TASKS_LOADING',
  SET_PROJECT_TASKS: 'SET_PROJECT_TASKS',
  CLEAR_PROJECT_TASKS: 'CLEAR_PROJECT_TASKS',
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  SET_TASK_STATS: 'SET_TASK_STATS',
};

// Project reducer
function projectReducer(state, action) {
  switch (action.type) {
    case PROJECT_ACTIONS.SET_SELECTED_PROJECT:
      return { ...state, selectedProject: action.payload };
    case PROJECT_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case PROJECT_ACTIONS.SET_PROJECTS:
      return { ...state, projects: action.payload, loading: false };
    case PROJECT_ACTIONS.ADD_PROJECT:
      return { ...state, projects: [...state.projects, action.payload] };
    case PROJECT_ACTIONS.UPDATE_PROJECT:
      return {
        ...state,
        projects: state.projects.map(p => 
          p.id === action.payload.id ? action.payload : p
        ),
        // Update selected project if it's the one being updated
        selectedProject: state.selectedProject?.id === action.payload.id ? action.payload : state.selectedProject
      };
    case PROJECT_ACTIONS.DELETE_PROJECT:
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        // Clear selected project if it's the one being deleted
        selectedProject: state.selectedProject?.id === action.payload ? null : state.selectedProject
      };
    case PROJECT_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case PROJECT_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
    case PROJECT_ACTIONS.SET_TASKS_LOADING:
      return { ...state, tasksLoading: action.payload };
    case PROJECT_ACTIONS.SET_PROJECT_TASKS:
      return { ...state, projectTasks: action.payload, tasksLoading: false };
    case PROJECT_ACTIONS.CLEAR_PROJECT_TASKS:
      return { ...state, projectTasks: [], tasksLoading: false, taskStats: null };
    case PROJECT_ACTIONS.ADD_TASK:
      return { ...state, projectTasks: [...(state.projectTasks || []), action.payload] };
    case PROJECT_ACTIONS.UPDATE_TASK:
      return {
        ...state,
        projectTasks: (state.projectTasks || []).map(task =>
          task.id === action.payload.id ? action.payload : task
        )
      };
    case PROJECT_ACTIONS.DELETE_TASK:
      return {
        ...state,
        projectTasks: (state.projectTasks || []).filter(task => task.id !== action.payload)
      };
    case PROJECT_ACTIONS.SET_TASK_STATS:
      return { ...state, taskStats: action.payload };
    default:
      return state;
  }
}

// Initial state
const initialState = {
  projects: [],
  loading: false,
  error: null,
  selectedProject: null,
  projectTasks: [],
  tasksLoading: false,
  taskStats: null,
};

// Project provider component
export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const { user } = useSession();

  const loadProjects = useCallback(async () => {
    try {
      dispatch({ type: PROJECT_ACTIONS.SET_LOADING, payload: true });
      const projects = await projectService.getAllProjects();
      dispatch({ type: PROJECT_ACTIONS.SET_PROJECTS, payload: projects });
    } catch (error) {
      // Only show error if it's not an auth error (user just logged in)
      if (!error.message.includes('Unauthorized') && !error.message.includes('401')) {
        dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      } else {
        // Silently fail for auth errors during initial load
        dispatch({ type: PROJECT_ACTIONS.SET_LOADING, payload: false });
      }
    }
  }, []);

  // Load all projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload projects when user logs in
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user, loadProjects]);

  const createProject = async (projectData) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      const newProject = await projectService.createProject(projectData);
      dispatch({ type: PROJECT_ACTIONS.ADD_PROJECT, payload: newProject });
      return newProject;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const updateProject = async (id, projectData) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      const updatedProject = await projectService.updateProject(id, projectData);
      dispatch({ type: PROJECT_ACTIONS.UPDATE_PROJECT, payload: updatedProject });
      return updatedProject;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const deleteProject = async (id) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      await projectService.deleteProject(id);
      dispatch({ type: PROJECT_ACTIONS.DELETE_PROJECT, payload: id });
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const addUserToProject = async (projectId, userId) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      const updatedProject = await projectService.addUserToProject(projectId, userId);
      dispatch({ type: PROJECT_ACTIONS.UPDATE_PROJECT, payload: updatedProject });
      return updatedProject;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const removeUserFromProject = async (projectId, userId) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      const updatedProject = await projectService.removeUserFromProject(projectId, userId);
      dispatch({ type: PROJECT_ACTIONS.UPDATE_PROJECT, payload: updatedProject });
      return updatedProject;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const selectProject = (projectId) => {
    const project = state.projects.find(p => p.id === projectId) || null;
    // Clear tasks when switching projects to prevent stale data
    dispatch({ type: PROJECT_ACTIONS.CLEAR_PROJECT_TASKS });
    dispatch({ type: PROJECT_ACTIONS.SET_SELECTED_PROJECT, payload: project });
  };

  // Task-related functions
  const loadProjectTasks = useCallback(async (projectId, options = {}) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.SET_TASKS_LOADING, payload: true });
      const tasks = await projectTasksService.getProjectTasks(projectId, options);
      dispatch({ type: PROJECT_ACTIONS.SET_PROJECT_TASKS, payload: tasks });
      return tasks;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  }, []);

  const createTask = async (projectId, taskData) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      const newTask = await projectTasksService.createTask(projectId, taskData);
      dispatch({ type: PROJECT_ACTIONS.ADD_TASK, payload: newTask });
      return newTask;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const updateTask = async (taskId, taskData) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      const updatedTask = await projectTasksService.updateTask(taskId, taskData);
      dispatch({ type: PROJECT_ACTIONS.UPDATE_TASK, payload: updatedTask });
      return updatedTask;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const deleteTask = async (taskId) => {
    try {
      dispatch({ type: PROJECT_ACTIONS.CLEAR_ERROR });
      await projectTasksService.deleteTask(taskId);
      dispatch({ type: PROJECT_ACTIONS.DELETE_TASK, payload: taskId });
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const loadTaskStats = async (projectId) => {
    try {
      const stats = await projectTasksService.getTaskStats(projectId);
      dispatch({ type: PROJECT_ACTIONS.SET_TASK_STATS, payload: stats });
      return stats;
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  const value = {
    ...state,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    addUserToProject,
    removeUserFromProject,
    selectProject,
    loadProjectTasks,
    createTask,
    updateTask,
    deleteTask,
    loadTaskStats,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook to use the project context
export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
