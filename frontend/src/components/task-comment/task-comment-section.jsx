import React, { useState, useEffect } from 'react';
import { CommentBox } from './task-comment';
import { CommentItem } from './task-comment-item';
import { getCsrfToken } from '@/lib/csrf';
import { useAuth } from '@/hooks/useAuth';

const API = 'http://localhost:3001/api/tasks';

export const CommentSection = ({ taskId: propTaskId, currentUser: overrideUser = null }) => {
  const { user: authUser } = useAuth();
  const currentUser = overrideUser ?? authUser;
  if (!currentUser) {
    console.warn('[CommentSection] No authenticated user available; comment actions disabled');
  }
  const taskId = propTaskId;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  // map backend row -> UI shape your components already use
const toViewModel = (row) => ({
  id: row.id,
  content: row.content,
  user: {
    id: row.user?.id ?? null,
    name: row.user?.name ?? null,
    initials: row.user?.initials ?? null,
  },
  timestamp: row.timestamp,           // already a number from backend
  parentId: row.parentId ?? null,     // camelCase from backend
  taskId: row.taskId ?? null,
  edited: !!row.edited,
  replies: row.replies ?? [],         // if backend sends
});


  // LOAD
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
  const res = await fetch(`${API}/${taskId}/comments`, {
    cache: 'no-store',
    credentials: 'include',
  });
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        const data = await res.json();
        if (alive) setComments(data.map(toViewModel));
      } catch (e) {
        console.error('Failed to load comments:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [taskId]);

  // CREATE (top-level or reply)
  const handleCreateComment = async (content, parentId = null) => {
    console.log('handleCreateComment called with parentId:', parentId);
    if (!currentUser) {
      console.error('[handleCreateComment] currentUser is undefined!');
      return;
    } else {
      console.log('[handleCreateComment] currentUser:', currentUser);
    }
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${API}/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify({ content, userId: currentUser.id, parentId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    // After creating, reload all comments so replies are nested
    try {
  const reload = await fetch(`${API}/${taskId}/comments`, {
    cache: 'no-store',
    credentials: 'include',
  });
      if (!reload.ok) throw new Error((await reload.json()).error || reload.statusText);
      const data = await reload.json();
      setComments(data.map(toViewModel));
    } catch (e) {
      console.error('Failed to reload comments after create:', e);
    }
  };

  // UPDATE
  const handleUpdateComment = async (commentId, content) => {
    if (!currentUser) {
      console.error('[handleUpdateComment] currentUser is undefined!');
      return;
    } else {
      console.log('[handleUpdateComment] currentUser:', currentUser);
    }
    const csrfToken = await getCsrfToken();
    const res = await fetch(`${API}/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify({ content, userId: currentUser.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    // After editing, reload all comments so replies are nested
    try {
  const reload = await fetch(`${API}/${taskId}/comments`, {
    cache: 'no-store',
    credentials: 'include',
  });
      if (!reload.ok) throw new Error((await reload.json()).error || reload.statusText);
      const data = await reload.json();
      setComments(data.map(toViewModel));
    } catch (e) {
      console.error('Failed to reload comments after update:', e);
    }
  };
  
  return (
    <div className="max-w-3xl mx-auto p-6 rounded-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Comments</h2>
      </div>

      <CommentBox onSubmit={(content) => handleCreateComment(content, null)} currentUser={currentUser} />

      {loading ? (
        <div className="text-gray-400">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No comments yet</p>
          <p className="text-sm">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onUpdate={handleUpdateComment}
              onReply={handleCreateComment}
            />
          ))}
        </div>
      )}
    </div>
  );
};
