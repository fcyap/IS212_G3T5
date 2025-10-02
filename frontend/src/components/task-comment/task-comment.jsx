import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useUserSearch } from '@/hooks/useUserSearch';

const mentionBoundary = /[\s()[\]{}.,;:!?]/;

export const CommentBox = ({ onSubmit, currentUser, placeholder = "Start typing here..." }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);

  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const {
    results: mentionResults,
    loading: mentionLoading,
    search: searchMentionUsers,
    clear: clearMentionUsers,
  } = useUserSearch({ minQueryLength: 1 });

  const fallbackLabel = currentUser?.name || currentUser?.email || 'User';
  const initials =
    currentUser?.initials ||
    fallbackLabel
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .join('')
      .substring(0, 2) || 'U';

  const closeMention = useCallback(() => {
    setMentionActive(false);
    setMentionQuery('');
    setMentionTriggerIndex(null);
    setHighlightIndex(0);
    clearMentionUsers();
  }, [clearMentionUsers]);

  const findActiveMention = useCallback((text, cursor) => {
    if (cursor == null) return null;
    const beforeCursor = text.slice(0, cursor);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt === -1) return null;

    if (lastAt > 0 && !mentionBoundary.test(beforeCursor[lastAt - 1])) {
      return null;
    }

    const fragment = beforeCursor.slice(lastAt + 1);
    if (fragment.length > 0 && /[\s@]/.test(fragment)) {
      return null;
    }

    return { start: lastAt, query: fragment };
  }, []);

  const activateMention = useCallback((start, query) => {
    setMentionActive(true);
    setMentionTriggerIndex(start);
    setHighlightIndex(0);
    setMentionQuery(query);

    if (query.trim().length > 0) {
      searchMentionUsers(query);
    } else {
      clearMentionUsers();
    }
  }, [clearMentionUsers, searchMentionUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit(content.trim());
      setContent('');
      closeMention();
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMentionSelection = useCallback((user) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? content.length;
    const before = content.slice(0, mentionTriggerIndex);
    const after = content.slice(cursor);

    const label = user?.name || user?.email || 'user';
    const mentionText = `@${label}`;
    const insertion = `${mentionText} `;
    const nextValue = `${before}${insertion}${after}`;

    setContent(nextValue);
    closeMention();

    requestAnimationFrame(() => {
      const nextCursor = before.length + insertion.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }, [closeMention, content, mentionTriggerIndex]);

  const evaluateMentionFromCursor = useCallback((text, cursor) => {
    const mention = findActiveMention(text, cursor);
    if (mention) {
      activateMention(mention.start, mention.query);
    } else if (mentionActive) {
      closeMention();
    }
  }, [activateMention, closeMention, findActiveMention, mentionActive]);

  const handleContentChange = (e) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(value);
    evaluateMentionFromCursor(value, cursor);
  };

  const handleCursorMove = () => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    evaluateMentionFromCursor(textareaRef.current.value, cursor);
  };

  const handleKeyDown = (e) => {
    if (mentionActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (mentionResults.length > 0) {
          setHighlightIndex((prev) => (prev + 1) % mentionResults.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (mentionResults.length > 0) {
          setHighlightIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
        }
        return;
      }
      if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const selected = mentionResults[highlightIndex];
        if (selected) {
          handleMentionSelection(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (!mentionActive) return;
    if (mentionResults.length === 0) {
      setHighlightIndex(0);
      return;
    }
    setHighlightIndex((prev) => Math.min(prev, mentionResults.length - 1));
  }, [mentionActive, mentionResults]);

  return (
  <div className="bg-[#23232a] rounded-lg border border-gray-700 shadow-sm p-4 mb-6">
      <div className="flex gap-3">
  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1">
          <form onSubmit={handleSubmit}>
            <div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                onKeyUp={handleCursorMove}
                onClick={handleCursorMove}
                onSelect={handleCursorMove}
                placeholder={placeholder}
                className="w-full min-h-[80px] p-3 text-gray-100 placeholder-gray-400 bg-[#23232a] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />

              {mentionActive && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-[#1e1e23] shadow-lg">
                  {mentionLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-400">Searching users…</div>
                  ) : mentionResults.length > 0 ? (
                    mentionResults.map((user, index) => (
                      <button
                        key={user.id ?? `${user.email}-${index}`}
                        type="button"
                        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${index === highlightIndex ? 'bg-gray-700 text-white' : 'text-gray-200 hover:bg-gray-700 hover:text-white'}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleMentionSelection(user)}
                      >
                        <span className="font-medium">{user.name || user.email}</span>
                        {user.email && (
                          <span className="ml-auto text-xs text-gray-400">{user.email}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-400">
                      {mentionQuery ? 'No users found' : 'Type to search users'}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  
                </div>

                <div className="flex items-center gap-3">
    

                  <button
                    type="submit"
                    disabled={!content.trim() || isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Comment
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
