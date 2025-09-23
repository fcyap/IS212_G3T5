# Project Management Backend API

A Node.js/Express backend API for managing projects with Supabase integration.

## Features

- Create, read, update, and delete projects
- Manage project team members
- Supabase database integration
- RESTful API endpoints
- Error handling and validation

## Project Structure

```
backend/
├── src/
│   ├── controllers/
│   │   └── projectController.js    # Request handlers
│   ├── services/
│   │   └── projectService.js       # Business logic
│   ├── routes/
│   │   └── projects.js             # API routes
│   ├── utils/
│   │   └── supabase.js            # Database connection
│   └── index.js                    # Main server file
├── scripts/
│   └── test-projects.js           # Test script
├── database/
│   └── create_projects_table.sql  # Database schema
├── .env.example                   # Environment variables template
└── package.json
```

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings > API to get your project URL and anon key
   - Run the SQL script in `database/create_projects_table.sql` in your Supabase SQL Editor

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3001
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm run dev    # Development mode with nodemon
   # or
   npm start      # Production mode
   ```

## API Endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Get all projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/:id` | Get project by ID |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/staff` | Add staff to project |
| DELETE | `/api/projects/:id/staff` | Remove staff from project |

### Request Examples

**Create Project**
```bash
POST /api/projects
Content-Type: application/json

{
  "name": "My New Project",
  "description": "Project description here",
  "created_by": "user123",
  "team_staff": ["staff1", "staff2", "staff3"]
}
```

**Add Staff to Project**
```bash
POST /api/projects/:id/staff
Content-Type: application/json

{
  "staffId": "staff4"
}
```

## Database Schema

The `projects` table has the following structure:

```sql
- id (UUID, Primary Key)
- name (VARCHAR(255), NOT NULL)
- description (TEXT, NOT NULL)
- created_by (VARCHAR(255), NOT NULL)
- created_at (TIMESTAMP, DEFAULT NOW())
- updated_at (TIMESTAMP, DEFAULT NOW())
- team_staff (TEXT[], DEFAULT '{}')
- status (VARCHAR(50), DEFAULT 'active')
```

## Testing

Run the test script to verify the API functionality:

```bash
npm run test:projects
```

This will create sample projects and test the API endpoints.

## Error Handling

All endpoints return JSON responses in the following format:

**Success Response**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "project": { /* project data */ }
}
```

**Error Response**
```json
{
  "success": false,
  "error": "Error description",
  "message": "User-friendly message"
}
```

## Development Notes

- The API uses Row Level Security (RLS) in Supabase
- CORS is enabled for cross-origin requests
- Environment variables are required for database connection
- All timestamps are in ISO format with timezone
- Team staff is stored as an array of user IDs

## Next Steps

1. Add user authentication
2. Implement project tasks/subtasks
3. Add file upload functionality
4. Create project templates
5. Add notification system
