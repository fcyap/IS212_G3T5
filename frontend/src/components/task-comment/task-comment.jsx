import React, { useState } from 'react';
import { Send, Smile, AtSign, Paperclip, Sparkles } from 'lucide-react';

export const CommentBox = ({ onSubmit, currentUser, placeholder = "Start typing here..." }) => {
    console.log('[CommentBox] currentUser prop:', currentUser);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initials =
    currentUser?.initials ||
    (currentUser?.name
      ? currentUser.name
          .split(' ')
          .map((part) => part[0].toUpperCase())
          .join('')
          .substring(0, 2)
      : '?');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onSubmit(content.trim());
      setContent('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
  <div className="bg-[#23232a] rounded-lg border border-gray-700 shadow-sm p-4 mb-6">
      <div className="flex gap-3">
  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full min-h-[80px] p-3 text-gray-100 placeholder-gray-400 bg-[#23232a] border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />

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