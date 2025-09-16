const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL_LT;
const supabaseKey = process.env.SUPABASE_SECRET_KEY_LT;

let supabase = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_secret_key_here') {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase credentials not configured. Using mock data.');
}

// Mock data for when Supabase is not configured
const getMockProjects = () => [
  {
    id: 1,
    name: "Project Alpha",
    description: "First project for team collaboration",
    user_ids: [1, 2],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    creator_id: 1,
    status: "active"
  },
  {
    id: 2,
    name: "Project Beta",
    description: "Second project with tasks",
    user_ids: [2, 3, 4],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    creator_id: 1,
    status: "active"
  }
];

const getMockTasks = (projectId = null) => [
  {
    id: 1,
    title: "Design UI",
    description: "Create wireframes for the app",
    status: "in_progress",
    project_id: 1,
    assigned_to: [1],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    priority: "medium",
    updated_at: "2025-09-16T13:12:57.416204"
  },
  {
    id: 2,
    title: "Write API",
    description: "Develop backend endpoints",
    status: "pending",
    project_id: 1,
    assigned_to: [1, 2],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    priority: "medium",
    updated_at: "2025-09-16T13:12:57.416204"
  }
].filter(task => projectId ? task.project_id == projectId : true);

// GET /projects/:projectId/tasks - Get all tasks for a specific project
router.get('/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, assignedTo, priority, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    let tasks, allTasks;

    if (supabase) {
      // Use Supabase
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId);

      // Apply filters
      if (status) {
        query = query.eq('status', status.toUpperCase());
      }

      if (assignedTo) {
        query = query.eq('assignedTo', assignedTo);
      }

      if (priority) {
        query = query.eq('priority', parseInt(priority));
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data: tasksData, error } = await query;

      if (error) {
        throw error;
      }

      // Get task statistics
      const { data: allTasksData, error: statsError } = await supabase
        .from('tasks')
        .select('status')
        .eq('project_id', projectId);

      if (statsError) {
        throw statsError;
      }

      tasks = tasksData || [];
      allTasks = allTasksData || [];
    } else {
      // Use mock data
      allTasks = getMockTasks(projectId);
      tasks = [...allTasks];

      // Apply filters
      if (status) {
        tasks = tasks.filter(task => task.status === status);
      }

      if (assignedTo) {
        tasks = tasks.filter(task => task.assigned_to && task.assigned_to.includes(parseInt(assignedTo)));
      }

      if (priority) {
        tasks = tasks.filter(task => task.priority === priority);
      }

      // Apply sorting
      tasks.sort((a, b) => {
        const valueA = a[sortBy];
        const valueB = b[sortBy];

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
    }

    // Calculate statistics
    const stats = {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length
    };

    res.json({
      success: true,
      projectId: projectId,
      tasks: tasks,
      stats: stats,
      totalTasks: tasks.length,
      filters: {
        status: status || null,
        assignedTo: assignedTo || null,
        priority: priority || null,
        sortBy,
        sortOrder
      },
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching project tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve project tasks',
      message: error.message
    });
  }
});

// GET /projects/:projectId/tasks/stats - Get project task statistics
router.get('/:projectId/tasks/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    let tasks;

    if (supabase) {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('status, priority, deadline, created_at')
        .eq('project_id', projectId);

      if (error) {
        throw error;
      }

      tasks = tasksData || [];
    } else {
      // Use mock data
      tasks = getMockTasks(projectId);
    }

    // Calculate comprehensive statistics
    const now = new Date();
    const overdueTasks = tasks.filter(task =>
      task.deadline && new Date(task.deadline) < now &&
      !['completed', 'cancelled'].includes(task.status)
    );

    const stats = {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      },
      byPriority: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      },
      overdue: overdueTasks.length,
      completionRate: tasks.length > 0 ?
        (tasks.filter(t => t.status === 'completed').length / tasks.length * 100).toFixed(1) : 0
    };

    res.json({
      success: true,
      projectId: projectId,
      stats: stats,
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching task statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task statistics',
      message: error.message
    });
  }
});

// GET /projects/:projectId/tasks/:taskId - Get a specific task
router.get('/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    let task;

    if (supabase) {
      const { data: taskData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('project_id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Task not found'
          });
        }
        throw error;
      }

      task = taskData;
    } else {
      // Use mock data
      const mockTasks = getMockTasks(projectId);
      task = mockTasks.find(t => t.id == taskId);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      // Add mock subtasks and comments
      task.subtasks = [];
      task.comments = [
        {
          commentId: "comment-1",
          content: "This is a sample comment for demonstration purposes.",
          createdAt: "2024-11-10T09:00:00Z",
          updatedAt: "2024-11-10T09:00:00Z",
          isEdited: false,
          user: {
            userId: "550e8400-e29b-41d4-a716-446655440010",
            firstName: "John",
            lastName: "Doe"
          }
        }
      ];
    }

    res.json({
      success: true,
      task: task,
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task',
      message: error.message
    });
  }
});

// GET /tasks - Get all tasks
router.get('/tasks', async (req, res) => {
  try {
    const { status, project_id, assigned_to, priority, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    let tasks;

    if (supabase) {
      // Use Supabase
      let query = supabase
        .from('tasks')
        .select('*');

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (project_id) {
        query = query.eq('project_id', parseInt(project_id));
      }

      if (assigned_to) {
        query = query.contains('assigned_to', [parseInt(assigned_to)]);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data: tasksData, error } = await query;

      if (error) {
        throw error;
      }

      tasks = tasksData || [];
    } else {
      // Use mock data
      tasks = getMockTasks();

      // Apply filters
      if (status) {
        tasks = tasks.filter(task => task.status === status);
      }

      if (project_id) {
        tasks = tasks.filter(task => task.project_id == project_id);
      }

      if (assigned_to) {
        tasks = tasks.filter(task => task.assigned_to && task.assigned_to.includes(parseInt(assigned_to)));
      }

      if (priority) {
        tasks = tasks.filter(task => task.priority === priority);
      }

      // Apply sorting
      tasks.sort((a, b) => {
        const valueA = a[sortBy];
        const valueB = b[sortBy];

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
    }

    res.json({
      success: true,
      tasks: tasks,
      totalTasks: tasks.length,
      filters: {
        status: status || null,
        project_id: project_id || null,
        assigned_to: assigned_to || null,
        priority: priority || null,
        sortBy,
        sortOrder
      },
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tasks',
      message: error.message
    });
  }
});

// GET /projects - Get all projects
router.get('/projects', async (req, res) => {
  try {
    const { status, creator_id, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    let projects;

    if (supabase) {
      // Use Supabase
      let query = supabase
        .from('projects')
        .select('*');

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (creator_id) {
        query = query.eq('creator_id', parseInt(creator_id));
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data: projectsData, error } = await query;

      if (error) {
        throw error;
      }

      projects = projectsData || [];
    } else {
      // Use mock data
      projects = getMockProjects();

      // Apply filters
      if (status) {
        projects = projects.filter(project => project.status === status);
      }

      if (creator_id) {
        projects = projects.filter(project => project.creator_id == creator_id);
      }

      // Apply sorting
      projects.sort((a, b) => {
        const valueA = a[sortBy];
        const valueB = b[sortBy];

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
    }

    res.json({
      success: true,
      projects: projects,
      totalProjects: projects.length,
      filters: {
        status: status || null,
        creator_id: creator_id || null,
        sortBy,
        sortOrder
      },
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve projects',
      message: error.message
    });
  }
});

// PATCH /projects/:projectId/archive - Archive a project
router.patch('/projects/:projectId/archive', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', projectId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Project not found'
          });
        }
        throw error;
      }

      res.json({
        success: true,
        message: 'Project archived successfully',
        project: data,
        dataSource: 'supabase'
      });
    } else {
      // Mock response for when Supabase is not configured
      const mockProjects = getMockProjects();
      const project = mockProjects.find(p => p.id == projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Simulate archiving
      project.status = 'archived';

      res.json({
        success: true,
        message: 'Project archived successfully',
        project: project,
        dataSource: 'mock'
      });
    }

  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive project',
      message: error.message
    });
  }
});

module.exports = router;