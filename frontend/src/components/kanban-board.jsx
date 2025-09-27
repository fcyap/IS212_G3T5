"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Trash, Check, X, Plus } from "lucide-react"
import { useKanban } from "@/components/kanban-context"
import { Badge } from "@/components/ui/badge"
import { CommentSection } from "./task-comment/task-comment-section"

const priorityChipClasses = {
  Low: "bg-teal-200 text-teal-900",
  Medium: "bg-amber-300 text-amber-950",
  High: "bg-fuchsia-300 text-fuchsia-950",
}


const API = process.env.NEXT_PUBLIC_API_URL
const cap = (s) => (s ? s.toString().charAt(0).toUpperCase() + s.toString().slice(1).toLowerCase() : "")

function rowToCard(r) {
  const workflow = String(r.status || 'pending').toLowerCase();
  const normalizedAssignees =
    Array.isArray(r.assignees) ? r.assignees
    : Array.isArray(r.assigned_to) ? r.assigned_to.map(id => ({ id }))
    : [];

  return {
    id: r.id,
    title: r.title ?? '',
    description: r.description || '',
    priority: cap(r.priority) || 'Low',
    workflow,
    deadline: r.deadline || null,
    assignees: normalizedAssignees,  // <-- use this
    tags: Array.isArray(r.tags) ? r.tags : [],
  };
}

export function KanbanBoard() {
  async function handleSaveNewTask({ title, description, dueDate, priority, tags }) {
    try {
      const res = await fetch(`${API}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          priority: (priority || "Low").toLowerCase(),
          status: editorLane,
          deadline: dueDate || null,
          team_id: 1,
          assigned_to: [],
          tags,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || `POST /tasks ${res.status}`)
      }
      const row = await res.json()
      const card = rowToCard(row)

      setTasks(prev => editorPosition === "top" ? [card, ...prev] : [...prev, card])
      setBanner("Task Successfully Created")
      cancelAddTask()
    } catch (err) {
      console.error("[save task]", err)
    }
  }
  const [panelTask, setPanelTask] = useState(null)
  const openPanel = (task) => setPanelTask(task)
  const closePanel = () => setPanelTask(null)
  const [tasks, setTasks] = useState([])
  const [banner, setBanner] = useState("")

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(""), 2500)
    return () => clearTimeout(t)
  }, [banner])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/tasks`)
        if (!res.ok) throw new Error(`GET /tasks ${res.status}`)
        const rows = await res.json()
        setTasks(rows.map(rowToCard))
      } catch (err) {
        console.error("[load tasks]", err)
      }
    }
    load()
  }, [])


  const { isAdding, editorPosition, startAddTask, cancelAddTask, editorLane } = useKanban()
  const todo = tasks.filter(t => t.workflow === "pending")
  const doing = tasks.filter(t => t.workflow === "in_progress")
  const done = tasks.filter(t => t.workflow === "completed")
  const blocked = tasks.filter(t => t.workflow === "blocked")

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
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
              )}

              {todo.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "pending" && editorPosition === "bottom" && (
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
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
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
              )}

              {doing.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "in_progress" && editorPosition === "bottom" && (
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
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
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
              )}
              {done.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  onClick={() => openPanel(t)}
                />
              ))}
              {isAdding && editorLane === "completed" && editorPosition === "bottom" && (
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
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
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
              )}

              {blocked.map((t) => (
                <TaskCard
                  key={t.id ?? `${t.title}-${t.deadline}`}
                  title={t.title}
                  description={t.description}
                  priority={t.priority}
                  assignees={t.assignees}
                  deadline={t.deadline}
                  tags={t.tags}
                  onClick={() => openPanel(t)}
                />
              ))}

              {isAdding && editorLane === "blocked" && editorPosition === "bottom" && (
                <EditableTaskCard onCancel={cancelAddTask} onSave={handleSaveNewTask} />
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
          onClose={closePanel}
          onSave={async (patch) => {
            try {
              // Convert assignees (array of user objects) to assigned_to (array of user IDs)
              const assigned_to = Array.isArray(patch.assignees)
                ? patch.assignees.map(a => a.id)
                : [];
              const payload = {
                title: patch.title,
                description: patch.description || null,
                priority: patch.priority,
                status: patch.status,
                deadline: patch.deadline || null,
                tags: patch.tags || [],
                assigned_to,
              };
              console.log('[KanbanBoard] Sending payload to backend:', payload);
              const res = await fetch(`${API}/tasks/${panelTask.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
              if (!res.ok) {
                const { error } = await res.json().catch(() => ({}))
                throw new Error(error || `PUT /tasks/${panelTask.id} ${res.status}`)
              }
              const row = await res.json()
              console.log("[kanban board]",row);
              const updated = rowToCard(row)
              setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
              closePanel()
            } catch (e) {
              console.error("[update task]", e)
              alert(e.message)
            }
          }}
          onDeleted={(id) => {
            setTasks((prev) => prev.filter((t) => t.id !== id))
            closePanel()
          }}
        />
      )}
    </div>
  )
}


function TaskSidePanel({ task, onClose, onSave, onDeleted }) {
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority || "Low");
  const [status, setStatus] = useState(task.workflow || "pending");
  const [deadline, setDeadline] = useState(task.deadline || "");
  const [tags, setTags] = useState(Array.isArray(task.tags) ? task.tags : []);
  const [tagInput, setTagInput] = useState("");
  const [assignees, setAssignees] = useState(Array.isArray(task.assignees) ? task.assignees : []);
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Fetch user suggestions from backend on each keydown
  // Debounce timer for user search
  const [userSearchDebounce, setUserSearchDebounce] = useState(null);

  function handleUserSearchInput(e) {
    const value = e.target.value;
    console.log('[AssigneeSearch] (input onChange) value:', value);
    setUserSearch(value);
    if (userSearchDebounce) clearTimeout(userSearchDebounce);
    if (!value.trim()) {
      setUserSearchResults([]);
      return;
    }
    setLoadingUsers(true);
    const timer = setTimeout(async () => {
      const apiUrl = `${API}/users/search?q=${encodeURIComponent(value)}&limit=8`;
      console.log('[AssigneeSearch] Fetching:', apiUrl);
      try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        setUserSearchResults(data.users || []);
      } catch (err) {
        console.log('[AssigneeSearch] Fetch error:', err);
        setUserSearchResults([]);
      } finally {
        setLoadingUsers(false);
      }
    }, 250);
    setUserSearchDebounce(timer);
  }

  const canSave = title.trim().length > 0 && priority;
  function addTagFromInput() {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTagAt(idx) {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  }

  function addAssignee(user) {
    if (!assignees.some((a) => a.id === user.id)) {
      setAssignees((prev) => [...prev, user]);
    }
    setUserSearch("");
    setUserSearchResults([]);
  }

  function removeAssignee(userId) {
    setAssignees((prev) => prev.filter((a) => a.id !== userId));
  }

  async function handleDelete() {
    try {
      const res = await fetch(`${API}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `PUT /tasks/${task.id} ${res.status}`);
      }
      onDeleted?.(task.id);
    } catch (e) {
      console.error("[archive task]", e);
      alert(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-[420px] bg-[#1f2023] border-l border-gray-700 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Edit task</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Priority</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {["Low", "Medium", "High"].map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[p]}`}>{p}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-400">Tags</label>

            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center rounded-md px-2 py-0.5 mb-1 text-xs font-medium bg-gray-700 text-gray-200"
                  >
                    {t}
                    <button
                      type="button"
                      className="ml-1 text-gray-300 hover:text-white"
                      onClick={() => removeTagAt(i)}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

            )}

            <input
              className="mt-1 w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addTagFromInput()
                }
                if (e.key === "Backspace" && tagInput === "" && tags.length) {
                  removeTagAt(tags.length - 1)
                }
              }}
              placeholder="Type a tag and press Enter (or comma)"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="pending">To do</SelectItem>
                <SelectItem value="in_progress">Doing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Assignees */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assignees</label>
            <div className="mb-2">
              <input
                type="text"
                className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={handleUserSearchInput}
                aria-busy={loadingUsers ? 'true' : 'false'}
                autoComplete="off"
              />
              {userSearchResults.length > 0 && (
                <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
                  {userSearchResults.map((u) => (
                    <div
                      key={u.id}
                      className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-gray-100"
                      onClick={() => addAssignee(u)}
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {assignees.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignees.map((a) => (
                  <Badge
                    key={a.id}
                    className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 flex items-center"
                    title={a.name}
                  >
                    {a.name}
                    <button
                      type="button"
                      className="ml-1 text-gray-300 hover:text-white"
                      onClick={() => removeAssignee(a.id)}
                      aria-label={`Remove ${a.name}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No assignees</span>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deadline</label>
            <Input
              type="date"
              value={deadline || ""}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => onSave({ title: title.trim(), description: description.trim(), priority, status, deadline, tags, assignees })}
            disabled={!canSave}
            className="bg-white/90 text-black"
          >
            Save
          </Button>
          <Button variant="ghost" className="bg-white/10 text-gray-300 hover:text-white" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            className="bg-red-400 hover:bg-red-700 text-white ml-auto"
            type="button">
            <Trash className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>

        {/* Comment Section */}
        <div className="mt-8">
          <CommentSection taskId={task.id} />
        </div>
      </div>
    </div>
  )
}
function EditableTaskCard({ onSave, onCancel, taskId, onDeleted }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState("")
  const PRIORITIES = ["Low", "Medium", "High"]
  const canSave = title.trim().length > 0 && priority !== ""
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);


  function addTagFromInput() {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput("");
  }

  function removeTag(index) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDelete() {
    if (!taskId) {
      onCancel?.()
      return
    }
    try {
      const res = await fetch(`${API}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || `PUT /tasks/${taskId} ${res.status}`)
      }
      onDeleted?.(taskId)
      onCancel?.()
    } catch (e) {
      console.error("[archive task]", e)
      alert(e.message)
    }
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-[#1f2023] p-4 shadow-sm">
      {/* Title */}
      <label className="block text-xs text-gray-400 mb-1">Title</label>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="mb-3 bg-transparent text-gray-100 border-gray-700 placeholder:text-gray-500"
      />

      {/* Description */}
      <label className="block text-xs text-gray-400 mb-1">Description</label>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add a short description…"
        className="mb-3 bg-transparent text-gray-100 border-gray-700 placeholder:text-gray-500"
        rows={3}
      />
      {/* Tags */}
      <label className="block text-xs text-gray-400 mb-1">Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center rounded-md bg-gray-700 text-gray-100 px-2 py-1 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTags(prev => prev.filter((_, idx) => idx !== i));
              }}
              className="ml-1 text-gray-300 hover:text-white"
              aria-label={`Remove tag ${t}`}
            >
              ×
            </button>

          </span>
        ))}
      </div>
      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTagFromInput();
          } else if (e.key === "Backspace" && tagInput === "" && tags.length) {
            e.preventDefault();
            setTags(prev => prev.slice(0, -1));
          }
        }}
        placeholder="Type a tag and press Enter (or comma)"
        className="bg-transparent text-gray-100 border-gray-700"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Due date */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Deadline</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-transparent text-gray-100 border-gray-700"
          />
        </div>

        {/* Priority dropdown */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Priority</label>
          <Select value={priority} onValueChange={(v) => setPriority(v)}>
            <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${priorityChipClasses[p]}`}>
                    {p}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {taskId && (
          <Button
            type="button"
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash className="w-4 h-4 mr-1" /> Delete
          </Button>
        )}

        <Button
          onClick={() =>
            onSave({
              title: title.trim(),
              description: description.trim() || undefined,
              dueDate: dueDate || undefined,
              priority,
              tags,
            })
          }
          disabled={!canSave}
          className="bg-white/90 text-black hover:bg-white"
        >
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>

        <Button variant="ghost" onClick={onCancel} className="text-gray-300 hover:text-white">
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  )
}



