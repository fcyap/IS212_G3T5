"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { fetchWithCsrf } from "@/lib/csrf"
import { Plus } from "lucide-react"
import { useKanban } from "@/components/kanban-context"
import { useAuth } from "@/hooks/useAuth"
import { projectService, userService } from "@/lib/api"
import { extractUserHours, normalizeTimeSummary } from "@/lib/time-tracking"
import { TaskSidePanel } from "./kanban/task-side-panel"
import { EditableTaskCard } from "./kanban/editable-task-card"

const API = process.env.NEXT_PUBLIC_API_URL
const cap = (s) => (s ? s.toString().charAt(0).toUpperCase() + s.toString().slice(1).toLowerCase() : "")

function rowToCard(r) {
  const workflow = String(r.status || 'pending').toLowerCase();
  const normalizedAssignees =
    Array.isArray(r.assignees) ? r.assignees
      : Array.isArray(r.assigned_to) ? r.assigned_to.map(id => ({ id }))
        : [];

  const recurrence =
    r.recurrence_freq
      ? { freq: r.recurrence_freq, interval: r.recurrence_interval || 1 }
      : null;
  const timeTracking = r.time_tracking ?? r.timeTracking ?? null;

  return {
    id: r.id,
    title: r.title ?? '',
    description: r.description || '',
    priority: cap(r.priority) || 'Low',
    workflow,
    deadline: r.deadline || null,
    assignees: normalizedAssignees,  // <-- use this
    tags: Array.isArray(r.tags) ? r.tags : [],
    recurrence,
    projectId: r.project_id ?? null,
    timeTracking,
  };
}

export function KanbanBoard({ projectId = null }) {
  const boardProjectId = projectId != null ? Number(projectId) : null;
  const { user: currentUser } = useAuth()
  const [activeProjects, setActiveProjects] = useState([]);
  const [projectLookup, setProjectLookup] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [usersById, setUsersById] = useState({});

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const allProjects = await projectService.getAllProjects();
        if (!mounted) return;
        const normalizedProjects = Array.isArray(allProjects) ? allProjects : [];
        const active = normalizedProjects.filter((project) => String(project.status || '').toLowerCase() === 'active');
        const lookupEntries = normalizedProjects
          .map((project) => {
            const id = Number(project.id);
            return Number.isFinite(id) ? [id, project] : null;
          })
          .filter(Boolean);
        const lookup = Object.fromEntries(lookupEntries);
        setActiveProjects(active);
        setProjectLookup(lookup);
      } catch (err) {
        if (!mounted) return;
        console.error('[KanbanBoard] Failed to load projects:', err);
        setProjectsError(err);
        setActiveProjects([]);
        setProjectLookup({});
      } finally {
        if (mounted) setProjectsLoading(false);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const ensureProjectLookup = useCallback(async (projectId) => {
    const numericId = Number(projectId);
    if (!Number.isFinite(numericId)) {
      return null;
    }

    if (projectLookup[numericId]) {
      return projectLookup[numericId];
    }

    try {
      const data = await projectService.getProjectById(numericId);

      const projectPayload = data?.project ?? (data?.success === true ? data.project : null);
      const project =
        projectPayload && Number.isFinite(projectPayload?.id)
          ? projectPayload
          : (data && Number.isFinite(data?.id) ? data : null);

      if (project && Number.isFinite(project.id)) {
        setProjectLookup((prev) => ({
          ...prev,
          [project.id]: project
        }));
        return project;
      }
    } catch (err) {
      console.error('[KanbanBoard] Failed to fetch project for lookup:', err);
    }
    return null;
  }, [projectLookup]);
  useEffect(() => {
    if (!currentUser?.id) {
      setUsersById({});
      return;
    }

    const roleLabel = typeof currentUser?.role === 'string'
      ? currentUser.role.toLowerCase()
      : typeof currentUser?.role?.label === 'string'
        ? currentUser.role.label.toLowerCase()
        : '';

    // Only managers need the user directory to evaluate subordinate access
    if (roleLabel !== 'manager') {
      setUsersById({});
      return;
    }

    let active = true;
    (async () => {
      try {
        const response = await userService.getAllUsers();
        if (!active) return;
        const list = Array.isArray(response)
          ? response
          : Array.isArray(response?.users)
            ? response.users
            : [];
        const map = list.reduce((acc, user) => {
          if (user?.id != null) {
            acc[user.id] = user;
          }
          return acc;
        }, {});
        setUsersById(map);
      } catch (err) {
        if (!active) return;
        console.error('[KanbanBoard] Failed to load users for RBAC filtering:', err);
        setUsersById({});
      }
    })();
    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role]);
  async function handleSaveNewTask({ title, description, dueDate, priority, tags, assignees, recurrence, projectId: selectedProjectId, attachments }) {
    if (!currentUser?.id) {
      console.error('[KanbanBoard] Cannot create task without an authenticated user')
      return
    }
    console.log('[KanbanBoard] handleSaveNewTask called', {
      title,
      description,
      dueDate,
      priority,
      tags,
      assignees,
      recurrence,
      selectedProjectId,
      boardProjectId,
      lane: editorLane,
      attachments: attachments?.length || 0
    });
    try {
      const resolvedProjectIdRaw =
        selectedProjectId != null
          ? selectedProjectId
          : boardProjectId;
      const resolvedProjectId =
        resolvedProjectIdRaw != null && Number.isFinite(Number(resolvedProjectIdRaw))
          ? Number(resolvedProjectIdRaw)
          : null;
      console.log('[KanbanBoard] Resolved project id:', { resolvedProjectIdRaw, resolvedProjectId });
      if (resolvedProjectId == null) {
        alert('Please select an active project before creating a task.');
        return;
      }
      const payload = {
        title,
        description: description || null,
        priority: (priority || "Low").toLowerCase(),
        status: editorLane,
        deadline: dueDate || null,
        project_id: resolvedProjectId,
        assigned_to: Array.isArray(assignees) && assignees.length > 0 ? assignees.map(a => a.id) : [currentUser.id],
        tags,
        recurrence: recurrence ?? null,
      };
      console.log('[KanbanBoard] POST /tasks payload:', payload);
      const res = await fetchWithCsrf(`${API}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      console.log('[KanbanBoard] POST /tasks status:', res.status);
      if (res.status === 401) {
        alert('Your session has expired. Please sign in again and retry.');
        return;
      }
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || `POST /tasks ${res.status}`)
      }
      const row = await res.json()
      console.log('[KanbanBoard] Created task response:', row);
      
      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        try {
          const formData = new FormData()
          attachments.forEach(file => {
            formData.append('files', file)
          })
          
          const uploadResponse = await fetchWithCsrf(`${API}/api/tasks/${row.id}/files`, {
            method: 'POST',
            body: formData
          })
          
          if (!uploadResponse.ok) {
            console.warn('Failed to upload some attachments')
          } else {
            const uploadResult = await uploadResponse.json()
            if (uploadResult.data?.errors && uploadResult.data.errors.length > 0) {
              console.warn('Some files failed:', uploadResult.data.errors)
            }
          }
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError)
        }
      }
      
      const card = rowToCard(row)

      setRawTasks(prev =>
        editorPosition === "top" ? [card, ...prev] : [...prev, card]
      )
      setBanner("Task Successfully Created")
      cancelAddTask()
    } catch (err) {
      console.error("[save task]", err)
      alert(err.message || 'Failed to create task.');
    }
  }
  const [panelTask, setPanelTask] = useState(null)
  const openPanel = (task) => setPanelTask(task)
  const closePanel = () => setPanelTask(null)
  const [rawTasks, setRawTasks] = useState([])
  const [banner, setBanner] = useState("")

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(""), 2500)
    return () => clearTimeout(t)
  }, [banner])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/tasks?archived=false&parent_id=null`, {
          credentials: 'include',
        })
        console.log('[KanbanBoard] GET /tasks status:', res.status);
        if (!res.ok) throw new Error(`GET /tasks ${res.status}`)
        const rows = await res.json()
        console.log('[KanbanBoard] Loaded tasks:', Array.isArray(rows) ? rows.length : 'unknown');
        setRawTasks(rows.map(rowToCard))
      } catch (err) {
        console.error("[load tasks]", err)
      }
    }
    load()
  }, [])

  const currentUserId = currentUser?.id != null ? Number(currentUser.id) : null;
  const rawRoleValue = currentUser?.role;
  const normalizedRole = typeof rawRoleValue === 'string'
    ? rawRoleValue.toLowerCase()
    : typeof rawRoleValue?.label === 'string'
      ? rawRoleValue.label.toLowerCase()
      : '';
  const normalizedDepartment = typeof currentUser?.department === 'string'
    ? currentUser.department.trim().toLowerCase()
    : '';
  const managerDivision = currentUser?.division ? String(currentUser.division).toLowerCase() : null;
  const managerHierarchySource =
    currentUser?.hierarchy ??
    currentUser?.level ??
    currentUser?.hierarchy_level ??
    currentUser?.role_level ??
    null;
  const hierarchyAsNumber = Number(managerHierarchySource);
  const managerHierarchy = Number.isFinite(hierarchyAsNumber) ? hierarchyAsNumber : null;
  const hasUserDirectory = usersById && Object.keys(usersById).length > 0;
  const accessibleProjectIds = useMemo(
    () =>
      Object.keys(projectLookup || {})
        .map((key) => Number(key))
        .filter(Number.isFinite),
    [projectLookup]
  );

  const visibleTasks = useMemo(() => {
    if (!Array.isArray(rawTasks)) {
      return [];
    }
    if (!currentUserId || !normalizedRole) {
      return rawTasks;
    }
    if (normalizedDepartment === 'hr team') {
      return rawTasks;
    }

    const extractAssigneeIds = (task) => {
      if (Array.isArray(task?.assignees) && task.assignees.length) {
        return task.assignees
          .map((assignee) => Number(
            typeof assignee === 'object' ? assignee?.id ?? assignee?.user_id : assignee
          ))
          .filter(Number.isFinite)
          .map((value) => Math.trunc(value));
      }

      const raw = Array.isArray(task?.assigned_to)
        ? task.assigned_to
        : task?.assigned_to != null
          ? [task.assigned_to]
          : [];

      return raw
        .map((value) => Number(value))
        .filter(Number.isFinite)
        .map((value) => Math.trunc(value));
    };

    if (normalizedRole === 'manager') {
      return rawTasks.filter((task) => {
        const assigneeIds = extractAssigneeIds(task);
        if (!assigneeIds.length) {
          return false;
        }

        if (assigneeIds.includes(currentUserId)) {
          return true;
        }

        if (!hasUserDirectory || !managerDivision) {
          return false;
        }

        return assigneeIds.some((assigneeId) => {
          const assignee = usersById[assigneeId];
          if (!assignee) return false;

          const subordinateDivision = assignee?.division ? String(assignee.division).toLowerCase() : null;
          if (!subordinateDivision || subordinateDivision !== managerDivision) {
            return false;
          }

          const subordinateHierarchySource =
            assignee?.hierarchy ??
            assignee?.level ??
            assignee?.hierarchy_level ??
            assignee?.role_level ??
            null;
          const subordinateHierarchy = Number(subordinateHierarchySource);
          const comparable =
            managerHierarchy != null &&
            Number.isFinite(managerHierarchy) &&
            Number.isFinite(subordinateHierarchy);

          return comparable ? subordinateHierarchy < managerHierarchy : true;
        });
      });
    }

    // Staff: show tasks they are assigned to or within accessible projects
    return rawTasks.filter((task) => {
      const assigneeIds = extractAssigneeIds(task);
      if (assigneeIds.includes(currentUserId)) {
        return true;
      }

      const projectId = Number(task.projectId ?? task.project_id);
      if (
        Number.isFinite(projectId) &&
        accessibleProjectIds.includes(projectId)
      ) {
        return true;
      }

      return false;
    });
  }, [rawTasks, currentUserId, normalizedRole, normalizedDepartment, usersById, hasUserDirectory, managerDivision, managerHierarchy, accessibleProjectIds]);

  useEffect(() => {
    if (!panelTask) return;
    const isVisible = visibleTasks.some((task) => task.id === panelTask.id);
    if (!isVisible) {
      setPanelTask(null);
    }
  }, [panelTask, visibleTasks]);

  const { isAdding, editorPosition, startAddTask, cancelAddTask, editorLane } = useKanban()
  const todo = visibleTasks.filter(t => t.workflow === "pending")
  const doing = visibleTasks.filter(t => t.workflow === "in_progress")
  const done = visibleTasks.filter(t => t.workflow === "completed")
  const blocked = visibleTasks.filter(t => t.workflow === "blocked")

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      {banner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-md bg-emerald-600 px-4 py-2 text-white shadow-lg ring-1 ring-black/10">
            {banner}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex gap-6 w-max flex-nowrap">

          {/* To do Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-medium">To do</h2>
                <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                  {todo.length + (isAdding && editorLane === "pending" ? 1 : 0)}
                </span>

              </div>
            </div>

            <div className="space-y-3">
              {isAdding && editorLane === "pending" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {todo.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "pending" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {!isAdding && (
                <Button
                  onClick={() => startAddTask("bottom", "pending")}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              )}
            </div>
          </div>

          {/* Doing Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Doing</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                {doing.length + (isAdding && editorLane === "in_progress" ? 1 : 0)}
              </span>

            </div>
            <div className="space-y-3">
              {isAdding && editorLane === "in_progress" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {doing.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "in_progress" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {!isAdding && (
                <Button
                  onClick={() => startAddTask("bottom", "in_progress")}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              )}

            </div>
          </div>

          {/* Done Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Done</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                {done.length + (isAdding && editorLane === "completed" ? 1 : 0)}
              </span>
            </div>
            <div className="space-y-3">
              {isAdding && editorLane === "completed" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}
              {done.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}
              {isAdding && editorLane === "completed" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {!isAdding && (
                <Button
                  onClick={() => startAddTask("bottom", "completed")}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              )}

            </div>
          </div>
          {/* Blocked Column */}
          <div className="w-[360px] flex-none space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Blocked</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                {blocked.length + (isAdding && editorLane === "blocked" ? 1 : 0)}
              </span>
            </div>

            <div className="space-y-3">
              {isAdding && editorLane === "blocked" && editorPosition === "top" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {blocked.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  taskId={t.id}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  status={t.workflow}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "blocked" && editorPosition === "bottom" && (
                <EditableTaskCard
                  onCancel={cancelAddTask}
                  onSave={handleSaveNewTask}
                  defaultProjectId={boardProjectId}
                  projects={activeProjects}
                  projectsLoading={projectsLoading}
                  projectsError={projectsError}
                />
              )}

              {/* {!isAdding && (
      <Button
        onClick={() => startAddTask("bottom", "blocked")}
        variant="ghost"
        className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add task
      </Button>
    )} */}
            </div>
          </div>

        </div></div>
      {panelTask && (
        <TaskSidePanel
          task={panelTask}
          projectLookup={projectLookup}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          ensureProject={ensureProjectLookup}
          toCard={rowToCard}
          onClose={closePanel}
          onSave={async (patch) => {
            try {
              // Prefer the richer assignee payload when available, but fall back to assigned_to arrays
              const rawAssigneeInputs =
                Array.isArray(patch.assignees) && patch.assignees.length
                  ? patch.assignees
                  : Array.isArray(patch.assigned_to)
                    ? patch.assigned_to
                    : [];
              const assigned_to = Array.from(
                new Set(
                  rawAssigneeInputs
                    .map((entry) => {
                      if (entry == null) return null;
                      const raw =
                        typeof entry === 'object'
                          ? entry.id ?? entry.user_id ?? entry.userId ?? null
                          : entry;
                      const numeric = Number(raw);
                      return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
                    })
                    .filter((value) => value !== null)
                )
              );
              const payload = {
                title: patch.title,
                description: patch.description || null,
                priority: patch.priority,
                status: patch.status,
                deadline: patch.deadline || null,
                tags: patch.tags || [],
                assigned_to,
                recurrence: patch.recurrence ?? null,
              };
              if (patch.hours !== undefined) {
                payload.hours = patch.hours;
              }
              console.log('[KanbanBoard] Sending payload to backend:', payload);
              const res = await fetchWithCsrf(`${API}/tasks/${panelTask.id}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              })
              if (!res.ok) {
                const { error } = await res.json().catch(() => ({}))
                throw new Error(error || `PUT /tasks/${panelTask.id} ${res.status}`)
              }
              const row = await res.json()
              console.log("[kanban board]", row);
              const updated = rowToCard(row)
              setRawTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
              closePanel()
              return row
            } catch (e) {
              console.error("[update task]", e)
              alert(e.message)
            }
          }}
          onDeleted={(id) => {
            setRawTasks((prev) => prev.filter((t) => t.id !== id))
            closePanel()
          }}
        />
      )}
    </div>
  )
}
