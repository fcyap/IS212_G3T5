import React, { useState } from 'react';
import { Edit2, Trash2, Check, X, Reply, MessageCircle } from 'lucide-react';
import { CommentBox } from './task-comment';

export const CommentItem = ({ comment, currentUser, onUpdate, onReply, depth = 0 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  console.log('Current User:', currentUser);
  const canEdit = comment.user?.id && currentUser?.id && comment.user.id === currentUser.id;
  const hasReplies = comment.replies && comment.replies.length > 0;

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

  const safeName = currentUser?.name || (typeof currentUser === 'string' ? currentUser : 'User');
  const initials = safeName.split(' ').map(part => part.charAt(0).toUpperCase()).join('').substring(0, 2);
  const currentUserData = {
    name: safeName,
    initials,
    color: 'bg-blue-500'
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow ${depth > 0 ? 'ml-8 mt-3' : ''}`}>
      <div className="flex gap-3">
        <div
          className={`${depth > 0 ? 'w-7 h-7' : 'w-8 h-8'} bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-xs flex-shrink-0 mr-2`}
          title={comment.user.name}
        >
          {comment.user.initials || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-gray-900 text-sm">
              {comment.user.name}
            </h4>
            <span className="text-xs text-gray-500">
              {formatTimestamp(comment.timestamp)}
            </span>
            {depth > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Reply
              </span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[80px] p-3 text-sm text-gray-700 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
              
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                { (
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
              </div>
            </>
          )}
        </div>
      </div>
      
      {showReplyBox && (
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
              currentUser={currentUser}
              onUpdate={onUpdate}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};