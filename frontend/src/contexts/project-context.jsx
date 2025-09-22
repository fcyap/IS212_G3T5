"use client"

import { createContext, useContext, useReducer, useEffect } from 'react';
import { projectService } from '@/lib/api';

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
};

// Project provider component
export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Load all projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      dispatch({ type: PROJECT_ACTIONS.SET_LOADING, payload: true });
      const projects = await projectService.getAllProjects();
      dispatch({ type: PROJECT_ACTIONS.SET_PROJECTS, payload: projects });
    } catch (error) {
      dispatch({ type: PROJECT_ACTIONS.SET_ERROR, payload: error.message });
    }
  };

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
    dispatch({ type: PROJECT_ACTIONS.SET_SELECTED_PROJECT, payload: project });
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
