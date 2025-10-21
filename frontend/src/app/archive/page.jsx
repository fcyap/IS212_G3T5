"use client";
import { useEffect, useState } from "react";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react";
import Link from "next/link"
import { fetchWithCsrf } from "@/lib/csrf";
const API = process.env.NEXT_PUBLIC_API_URL ;

export default function ArchivePage() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithCsrf(`${API}/tasks?archived=true`);
        if (!res.ok) {
          if (res.status === 401) {
            console.warn('[ArchivePage] Unauthorized when fetching archived tasks.');
            setTasks([]);
            return;
          }
          throw new Error(`GET /tasks?archived=true ${res.status}`);
        }
        const rows = await res.json();
        const normalized = Array.isArray(rows)
          ? rows
          : Array.isArray(rows?.tasks)
            ? rows.tasks
            : [];
        setTasks(normalized);
      } catch (err) {
        console.error('[ArchivePage] Failed to load archived tasks:', err);
        setTasks([]);
      }
    })();
  }, []);

  async function handleUnarchive(id) {
    const res = await fetchWithCsrf(`${API}/tasks/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: false }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      alert(error || "Failed to unarchive");
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-white text-xl font-semibold">Archived Tasks</h1>

        <Button asChild className="bg-gray-700 hover:bg-gray-600 text-white flex-shrink-0">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Home
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.description}
            priority={t.priority}
            assignees={t.assignees}
            deadline={t.deadline}
            tags={Array.isArray(t.tags) ? t.tags : []}
            onUnarchive={() => handleUnarchive(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
