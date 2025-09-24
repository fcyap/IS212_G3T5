"use client";
import { useEffect, useState } from "react";
import { TaskCard } from "@/components/task-card";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ArchivePage() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/tasks?archived=true`);
      const rows = await res.json();
      setTasks(rows);
    })();
  }, []);

  async function handleUnarchive(id) {
    const res = await fetch(`${API}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
    <div className="p-6 bg-[#1a1a1d] min-h-screen">
      <h1 className="text-white text-xl mb-4">Archived Tasks</h1>
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
