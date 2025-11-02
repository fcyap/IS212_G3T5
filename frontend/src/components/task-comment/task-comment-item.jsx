import React, { useState } from 'react';
import { Edit2, Trash2, Check, X, Reply, MessageCircle } from 'lucide-react';
import { CommentBox } from './task-comment';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export const CommentItem = ({
  comment,
  currentUser,
  onUpdate,
  onReply,
  onDelete = () => {},
  depth = 0,
  canComment = true,
}) => {
  const { user: authUser, role: authRole } = useAuth();
  const effectiveUser = authUser ?? currentUser;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  console.log('Current User:', effectiveUser);
  const canEdit = comment.user?.id && effectiveUser?.id && comment.user.id === effectiveUser.id;
  const hasReplies = comment.replies && comment.replies.length > 0;
  const resolveRole = (roleLike) => {
    if (!roleLike) return '';
    if (typeof roleLike === 'string') return roleLike;
    if (typeof roleLike === 'object') {
      return (
        roleLike.label ??
        roleLike.name ??
        roleLike.role ??
        roleLike.roleName ??
        roleLike.role_label ??
        roleLike.value ??
        ''
      );
    }
    return String(roleLike);
  };

  const normalizedRole = String(
    resolveRole(authRole) ||
    resolveRole(effectiveUser?.role) ||
    effectiveUser?.roleName ||
    effectiveUser?.role_label ||
    ''
  ).toLowerCase();
  const normalizedDepartment = String(effectiveUser?.department ?? authUser?.department ?? '').trim().toLowerCase();
  const isAdmin = normalizedRole === 'admin' || normalizedDepartment === 'hr team';

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      await onUpdate(comment.id, editContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update comment:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleReply = async (content) => {
    try {
      await onReply(content, comment.id);
      setShowReplyBox(false);
    } catch (error) {
      console.error('Failed to reply to comment:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (typeof onDelete !== 'function' || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
      setShowDeleteConfirm(false);
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error(error.message || 'Failed to delete comment');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleReplies = () => {
    setShowReplies(!showReplies);
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const ts = new Date(timestamp);
    const diffMs = now.getTime() - ts.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return ts.toLocaleDateString();
  };

  const safeName = effectiveUser?.name || effectiveUser?.email || (typeof effectiveUser === 'string' ? effectiveUser : 'User');
  const initials = safeName.split(' ').map(part => part.charAt(0).toUpperCase()).join('').substring(0, 2);
  const currentUserData = {
    name: safeName,
    initials,
    color: 'bg-blue-500'
  };

  return (
    <div className={`bg-[#23232a] rounded-lg border border-gray-700 p-4 hover:shadow-md transition-shadow ${depth > 0 ? 'ml-8 mt-3' : ''}`}> 
      <div className="flex gap-3">
        <div
          className={`${depth > 0 ? 'w-7 h-7' : 'w-8 h-8'} bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0 mr-2`}
          title={comment.user.name}
        >
          {comment.user.initials || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
              {comment.user.name}
            </h4>
            <span className="text-xs text-gray-500">
              {formatTimestamp(comment.timestamp)}
            </span>
            {depth > 0 && (
              <span className="text-xs text-gray-100 bg-gray-500 px-2 py-0.5 rounded-full">
                Reply
              </span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[80px] p-3 text-sm text-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                maxLength={1000}
                autoFocus
              />
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim() || isUpdating}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {isUpdating ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Save
                </button>
                
                <button
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
              
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-500">
                {canComment && (
                  <button
                    onClick={() => setShowReplyBox(!showReplyBox)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Reply to comment"
                  >
                    <Reply size={14} />
                  </button>
                )}
                
                {hasReplies && (
                  <button
                    onClick={toggleReplies}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors flex items-center gap-1"
                    title={showReplies ? 'Hide replies' : 'Show replies'}
                  >
                    <MessageCircle size={14} />
                    <span className="text-xs">{comment.replies.length}</span>
                  </button>
                )}
                
                {canEdit && (
                  <>
                  <button
                    onClick={handleStartEdit}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit comment"
                  >
                    <Edit2 size={14} />
                  </button>
                  </>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {canComment && showReplyBox && (
        <div className="mt-4 ml-11">
          <CommentBox 
            onSubmit={handleReply}
            currentUser={currentUserData}
            placeholder="Write a reply..."
          />
        </div>
      )}
      
      {hasReplies && showReplies && (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUser={effectiveUser}
              onUpdate={onUpdate}
              onReply={onReply}
              onDelete={onDelete}
              depth={depth + 1}
              canComment={canComment}
            />
          ))}
        </div>
      )}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteConfirm(open);
          }
        }}
      >
        <DialogContent className="bg-[#23232a] border border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete comment?</DialogTitle>
            <DialogDescription className="text-gray-400">
              This comment{hasReplies ? ' and its replies' : ''} will be permanently removed. 
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Deleting…
                </span>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
