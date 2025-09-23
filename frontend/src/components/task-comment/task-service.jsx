export class CommentService {
  constructor() {
    this.comments = [];
    this.currentUserId = 'current-user';
    
    // Initialize with some sample comments
    this.comments = [
      {
        id: '1',
        content: 'This looks great! I love the clean design approach.',
        author: {
          name: 'Sarah Johnson',
          initials: 'SJ',
          color: 'bg-purple-500'
        },
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        parentId: null,
        replies: []
      },
      {
        id: '2',
        content: 'Could we add some animation to make it more engaging?',
        author: {
          name: 'Current User',
          initials: 'CU',
          color: 'bg-blue-500'
        },
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
        parentId: null,
        replies: []
      },
      {
        id: '3',
        content: 'I agree! Maybe some subtle hover effects would work well.',
        author: {
          name: 'Mike Chen',
          initials: 'MC',
          color: 'bg-green-500'
        },
        timestamp: new Date(Date.now() - 900000), // 15 minutes ago
        parentId: '1',
        replies: []
      }
    ];
    
    // Build reply relationships
    this.buildReplyTree();
  }

  buildReplyTree() {
    // Clear existing replies
    this.comments.forEach(comment => comment.replies = []);
    
    // Build reply relationships
    this.comments.forEach(comment => {
      if (comment.parentId) {
        const parent = this.comments.find(c => c.id === comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      }
    });
  }

  getAllComments() {
    // Return only top-level comments (no parentId) with their replies
    return this.comments
      .filter(comment => !comment.parentId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  createComment(data, parentId = null) {
    const newComment = {
      id: Date.now().toString(),
      content: data.content,
      author: {
        name: data.authorName,
        initials: this.generateInitials(data.authorName),
        color: this.generateUserColor(data.authorName)
      },
      timestamp: new Date(),
      parentId: parentId,
      replies: []
    };

    this.comments.push(newComment);
    this.buildReplyTree();
    return newComment;
  }

  updateComment(data) {
    const commentIndex = this.comments.findIndex(comment => comment.id === data.id);
    
    if (commentIndex === -1) {
      throw new Error('Comment not found');
    }

    const comment = this.comments[commentIndex];
    
    // Check if the user is the original author
    if (comment.author.name !== data.authorName) {
      throw new Error('Only the original author can edit this comment');
    }

    const updatedComment = {
      ...comment,
      content: data.content,
      timestamp: new Date() // Update timestamp when edited
    };

    this.comments[commentIndex] = updatedComment;
    this.buildReplyTree();
    return updatedComment;
  }

  getCommentAndRepliesIds(commentId) {
    const idsToDelete = [commentId];
    const comment = this.comments.find(c => c.id === commentId);
    
    if (comment && comment.replies) {
      comment.replies.forEach(reply => {
        idsToDelete.push(...this.getCommentAndRepliesIds(reply.id));
      });
    }
    
    return idsToDelete;
  }

  canEditComment(commentId, authorName) {
    const comment = this.comments.find(comment => comment.id === commentId);
    return comment ? comment.author.name === authorName : false;
  }

  generateInitials(name) {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  }

  generateUserColor(name) {
    const colors = [
      'bg-purple-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-red-500'
    ];
    
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }
}