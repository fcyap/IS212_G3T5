import React, { useState, useEffect, useCallback } from 'react';
import { CommentBox } from './task-comment';
import { CommentItem } from './task-comment-item';
import { fetchWithCsrf } from '@/lib/csrf';
import { useAuth } from '@/hooks/useAuth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ;
const API = `${API_BASE_URL}/api/tasks`;

export const CommentSection = ({ taskId: propTaskId, currentUser: overrideUser = null }) => {
  const { user: authUser } = useAuth();
  const currentUser = overrideUser ?? authUser;
  if (!currentUser) {
    console.warn('[CommentSection] No authenticated user available; comment actions disabled');
  }
  const taskId = propTaskId;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canComment, setCanComment] = useState(false);

  // map backend row -> UI shape your components already use
  const toViewModel = useCallback((row) => ({
    id: row.id,
    content: row.content,
    user: {
      id: row.user?.id ?? null,
      name: row.user?.name ?? null,
      initials: row.user?.initials ?? null,
    },
    timestamp: row.timestamp, // already a number from backend
    parentId: row.parentId ?? null, // camelCase from backend
    taskId: row.taskId ?? null,
    edited: !!row.edited,
    replies: row.replies ?? [], // if backend sends
  }), []);

  const parseThreadPayload = useCallback((payload) => {
    if (Array.isArray(payload)) {
      return { comments: payload, canComment: true };
    }
    return {
      comments: Array.isArray(payload?.comments) ? payload.comments : [],
      canComment: Boolean(payload?.canComment),
    };
  }, []);

  const applyThreadResponse = useCallback((payload) => {
    const parsed = parseThreadPayload(payload);
    setComments(parsed.comments.map(toViewModel));
    setCanComment(parsed.canComment);
  }, [parseThreadPayload, toViewModel]);

  const reloadThread = useCallback(async () => {
    const res = await fetchWithCsrf(`${API}/${taskId}/comments`, { cache: 'no-store' });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    const data = await res.json();
    applyThreadResponse(data);
  }, [applyThreadResponse, taskId]);


  // LOAD
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
	const res = await fetchWithCsrf(`${API}/${taskId}/comments`, { cache: 'no-store' });
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        const data = await res.json();
        if (!alive) return;
        applyThreadResponse(data);
      } catch (e) {
        console.error('Failed to load comments:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [applyThreadResponse, taskId]);

  // CREATE (top-level or reply)
  const handleCreateComment = async (content, parentId = null) => {
    console.log('handleCreateComment called with parentId:', parentId);
    if (!currentUser) {
      console.error('[handleCreateComment] currentUser is undefined!');
      return;
    } else {
      console.log('[handleCreateComment] currentUser:', currentUser);
    }
    if (!canComment) {
      console.warn('[handleCreateComment] User is not permitted to comment on this task');
      throw new Error('You do not have permission to comment on this task');
    }
    const res = await fetchWithCsrf(`${API}/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, userId: currentUser.id, parentId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    // After creating, reload all comments so replies are nested
    try {
      await reloadThread();
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
    const res = await fetchWithCsrf(`${API}/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, userId: currentUser.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    // After editing, reload all comments so replies are nested
    try {
      await reloadThread();
    } catch (e) {
      console.error('Failed to reload comments after update:', e);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!currentUser) {
      console.error('[handleDeleteComment] currentUser is undefined!');
      return;
    }

    try {
      const res = await fetchWithCsrf(`${API}/comments/${commentId}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || res.statusText);
      }

      await reloadThread();
    } catch (err) {
      console.error('Failed to delete comment:', err);
      throw err;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 rounded-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Comments</h2>
      </div>

      {canComment ? (
        <CommentBox
          onSubmit={(content) => handleCreateComment(content, null)}
          currentUser={currentUser}
        />
      ) : !loading ? (
        <div className="mb-6 rounded-lg border border-dashed border-gray-600 bg-[#1e1e23] px-4 py-3 text-sm text-gray-400">
          You do not have permission to comment on this task.
        </div>
      ) : null}

      {loading ? (
        <div className="text-gray-400">Loading comments…</div>
      ) : comments.length === 0 ? (
        canComment ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No comments yet</p>
          <p className="text-sm">Be the first to share your thoughts!</p>
        </div>
        ) : null
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onUpdate={handleUpdateComment}
              onReply={handleCreateComment}
              onDelete={handleDeleteComment}
              canComment={canComment}
            />
          ))}
        </div>
      )}
    </div>
  );
};
