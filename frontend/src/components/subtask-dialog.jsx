"use client"
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PriorityDropdown } from './priority-dropdown';
import { useAuth } from '@/hooks/useAuth';
import { useUserSearch } from '@/hooks/useUserSearch';
import toast from 'react-hot-toast';
import { fetchWithCsrf } from '@/lib/csrf';
const API = process.env.NEXT_PUBLIC_API_URL;
export function SubtaskDialog({ parentId, parentDeadline, projectId = null, projectMembers = [], onClose, onCreated }) {
  const { user: currentUser } = useAuth()
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(5); // Default to medium priority
  const [status, setStatus] = useState("pending");
  const [deadline, setDeadline] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [attachments, setAttachments] = useState([]);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ];

  const parentMax = parentDeadline
    ? String(parentDeadline).slice(0, 10)
    : null;

  // Filter project members based on search query
  const filteredMemberResults = useMemo(() => {
    if (!userSearch.trim()) return [];
    
    const query = userSearch.trim().toLowerCase();
    return projectMembers
      .filter(member => {
        // Don't show already assigned members
        if (assignees.some(a => a.id === member.id)) return false;
        
        // Match by name or email
        const name = (member.name || '').toLowerCase();
        const email = (member.email || '').toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .slice(0, 8); // Limit to 8 results
  }, [userSearch, projectMembers, assignees]);

  const deadlineError =
    parentMax && deadline && deadline > parentMax
      ? `Deadline must be on or before ${parentMax}`
      : "";

  // Require all fields except tags to be filled
  const canSave =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    priority !== "" &&
    status !== "" &&
    deadline !== "" &&
    assignees.length > 0 &&
    !deadlineError;

  function addTagFromInput() {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput("");
  }
  function removeTagAt(i) {
    setTags((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addAssignee(user) {
    if (!assignees.some((a) => a.id === user.id)) {
      setAssignees((prev) => [...prev, user]);
    }
    setUserSearch("");
  }
  function removeAssignee(id) {
    setAssignees((prev) => prev.filter((a) => a.id !== id));
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only PDF, DOCX, XLSX, PNG, and JPG are allowed.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 50MB.`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      toast.error(errors.join(', '));
    }

    setAttachments(prev => [...prev, ...validFiles]);
    event.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function handleUserSearchInput(e) {
    const value = e.target.value;
    setUserSearch(value);
  }

  async function handleCreate() {
    try {
      if (parentMax && deadline && deadline > parentMax) {
        toast.error(`Subtask deadline must be on or before ${parentMax}.`);
        return;
      }
      const assignedTo =
        assignees.length > 0 ? assignees.map(a => a.id) : [currentUser.id];
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority: Number(priority) || 5, // Send as integer
        status,
        deadline: deadline || null,
        tags,
        parent_id: parentId,
        assigned_to: assignedTo,
      };

      // If parentId is null, just return the data without creating
      if (parentId === null) {
        onCreated?.({
          ...payload,
          assignees: assignees,
          attachments: attachments
        });
        return;
      }

      const res = await fetchWithCsrf(`${API}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || `POST /tasks ${res.status}`);
      }
      const row = await res.json();

      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        try {
          const formData = new FormData();
          attachments.forEach(file => {
            formData.append('files', file);
          });

          const uploadRes = await fetchWithCsrf(`${API}/tasks/${row.id}/files`, {
            method: 'POST',
            body: formData
          });

          if (!uploadRes.ok) {
            console.warn('Failed to upload some attachments');
          } else {
            const uploadResult = await uploadRes.json();
            if (uploadResult.data?.errors && uploadResult.data.errors.length > 0) {
              console.warn('Some files failed:', uploadResult.data.errors);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading attachments:', uploadError);
        }
      }

      onCreated?.(row); // push into list in parent
    } catch (e) {
      console.error("[create subtask]", e);
      toast.error(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-1/2 top-12 translate-x-1/2 w-full max-w-lg rounded-xl border border-gray-700 bg-[#1f2023] p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-semibold">Add subtask</h4>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl">×</button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
              placeholder="Subtask title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-transparent text-gray-100 border-gray-700"
              placeholder="Describe the subtask"
              required
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Priority <span className="text-red-400">*</span>
              </label>
              <PriorityDropdown
                value={priority}
                onValueChange={setPriority}
                triggerClassName="bg-transparent text-gray-100 border-gray-700"
                contentClassName="bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Status <span className="text-red-400">*</span>
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-transparent text-gray-100 border-gray-700">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="pending">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Deadline <span className="text-red-400">*</span>
            </label>
            <Input
              type="date"
              value={deadline || ""}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-transparent text-gray-100 border-gray-700"
              max={parentMax || undefined}
            />
            {deadlineError && (
              <div className="mt-1 text-xs text-red-400">{deadlineError}</div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-400">Tags</label>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span key={`${t}-${i}`} className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200">
                    {t}
                    <button className="ml-1 text-gray-300 hover:text-white" onClick={() => removeTagAt(i)}>×</button>
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
                  e.preventDefault();
                  addTagFromInput();
                }
                if (e.key === "Backspace" && tagInput === "" && tags.length) {
                  removeTagAt(tags.length - 1);
                }
              }}
              placeholder="Type a tag and press Enter (or comma)"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Assignees <span className="text-red-400">*</span>
            </label>
            <div className="mb-2 relative">
              <input
                type="text"
                className="w-full bg-transparent text-gray-100 border border-gray-700 rounded-md px-2 py-1 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="Search project members by name or email..."
                value={userSearch}
                onChange={handleUserSearchInput}
                autoComplete="off"
              />
              {filteredMemberResults.length > 0 && (
                <div className="absolute z-50 bg-[#23232a] border border-gray-700 rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
                  {filteredMemberResults.map((u) => (
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
                  <span
                    key={a.id}
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200"
                    title={a.name}
                  >
                    {a.name}
                    <button className="ml-1 text-gray-300 hover:text-white" onClick={() => removeAssignee(a.id)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No assignees</span>
            )}
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Attachments</label>
            <div className="border-2 border-dashed border-gray-700 rounded-md p-3 hover:border-gray-600 transition-colors">
              <input
                type="file"
                id="subtask-file-input"
                multiple
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="subtask-file-input"
                className="flex flex-col items-center cursor-pointer"
              >
                <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-xs text-gray-400">Click to upload</span>
                <span className="text-xs text-gray-500 mt-0.5">PDF, DOCX, XLSX, PNG, JPG (Max 50MB)</span>
              </label>
            </div>
            
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-gray-400 hover:text-red-400 ml-2 text-sm"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="text-gray-300 hover:text-white" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} className="bg-white/90 text-black hover:bg-white" onClick={handleCreate}>
            Create subtask
          </Button>
        </div>
      </div>
    </div>
  );
}
