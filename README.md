# Smart Task Manager

[![Node.js CI](https://github.com/yourusername/IS212_G3T5/workflows/Node.js%20CI/badge.svg)](https://github.com/yourusername/IS212_G3T5/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A comprehensive full-stack web application for project and task management with role-based access control, real-time notifications, and advanced collaboration features.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

## Overview

Smart Task Manager is a productivity system designed for teams to efficiently manage projects and tasks. Built with modern web technologies, it provides a seamless experience for project managers, team leaders, and staff members to collaborate on tasks with real-time updates and intelligent notifications.

### Key Capabilities

- **Project Management**: Create, organize, and track multiple projects
- **Task Management**: Comprehensive task lifecycle management with status tracking
- **Role-Based Access Control (RBAC)**: 3-tier hierarchy (Admin, Manager, Staff)
- **Kanban Board**: Visual task organization with drag-and-drop functionality
- **Real-time Notifications**: In-app and email alerts for assignments and deadlines
- **File Attachments**: Upload and manage task-related documents
- **Recurring Tasks**: Automated task creation with customizable recurrence patterns
- **Comments & Collaboration**: Task discussion threads for team communication
- **Reports & Analytics**: Project and task insights with export capabilities
- **Time Tracking**: Monitor time spent on tasks

## Features

### For Administrators
- Full system access and configuration
- User and role management
- System-wide reporting and analytics
- Security and audit controls

### For Managers
- Project creation and management
- Task assignment to team members
- Department-level reporting
- Team member oversight

### For Staff
- View and update assigned tasks
- Add comments and attachments
- Track personal task progress
- Receive deadline notifications

## Architecture

Smart Task Manager follows a modern **3-tier layered architecture**:

1. **Client Tier**: Next.js 14 React application with App Router
2. **Application Tier**: Express.js 5 REST API with layered architecture
3. **Data Tier**: Supabase (PostgreSQL) with Row-Level Security

### Architectural Patterns

- **MVC Pattern**: Clear separation of Routes, Controllers, Services, and Repositories
- **Middleware Pattern**: Authentication, Authorization, CSRF protection
- **Repository Pattern**: Abstracted data access layer
- **Context API**: Frontend state management
- **Service Orchestration**: Business logic coordination

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.32 | React framework with App Router |
| React | 18.3.1 | UI library |
| Tailwind CSS | 4.1.9 | Utility-first CSS framework |
| Radix UI | Latest | Accessible component primitives |
| React Hook Form | 7.60.0 | Form validation and management |
| Zod | 3.25.67 | Schema validation |
| date-fns | 4.1.0 | Date manipulation |
| Recharts | 2.15.4 | Data visualization |
| Lucide React | 0.454.0 | Icon library |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥18.0.0 | JavaScript runtime |
| Express.js | 5.1.0 | Web application framework |
| Supabase | 2.80.0 | PostgreSQL database platform |
| bcryptjs | 3.0.2 | Password hashing |
| jsonwebtoken | 9.0.2 | JWT authentication |
| SendGrid | 8.1.6 | Email notifications |
| Lusca | 1.7.0 | CSRF protection |
| node-cron | 4.2.1 | Scheduled tasks |
| multer | 2.0.2 | File upload handling |
| PDFKit | 0.17.2 | PDF generation |
| XLSX | Latest | Excel export |

### Development & Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| Jest | 30.1.3 | Testing framework |
| Supertest | 7.1.4 | HTTP assertion library |
| Nodemon | 3.1.10 | Development auto-reload |
| ESLint | 9.35.0 | Code linting |
| Concurrently | 9.2.1 | Run multiple commands |

## Getting Started

### Prerequisites

- **Node.js** ≥18.0.0
- **npm** ≥8.0.0
- **Git** for version control
- **Supabase** account (for database)
- **SendGrid** account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/IS212_G3T5.git
   cd IS212_G3T5
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```
   This command installs dependencies for:
   - Root project
   - Backend (`/backend`)
   - Frontend (`/frontend`)

### Environment Setup

#### Backend Environment Variables

Create `backend/.env` file:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database (Supabase)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database Connection
DB_HOST=your_db_host
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Authentication
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret_key
SESSION_TIMEOUT=3600000

# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# CORS
CORS_ORIGIN=http://localhost:3000

# Cron Jobs
ENABLE_CRON_JOBS=true
```

#### Frontend Environment Variables

Create `frontend/.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api

# Supabase (for file uploads)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### Running the Application

#### Development Mode

Run both frontend and backend concurrently:
```bash
npm run dev
```

This starts:
- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:3000

#### Individual Services

Run backend only:
```bash
npm run dev:backend
```

Run frontend only:
```bash
npm run dev:frontend
```

#### Production Mode

1. **Build the frontend**:
   ```bash
   npm run build
   ```

2. **Start both services**:
   ```bash
   npm run start
   ```

## Project Structure

```
IS212_G3T5/
├── backend/                      # Express.js API
│   ├── src/
│   │   ├── index.js             # Server entry point
│   │   ├── controllers/         # Request handlers (9 files)
│   │   ├── services/            # Business logic (10 files)
│   │   ├── repository/          # Data access layer (11 files)
│   │   ├── routes/              # API routes (12 files)
│   │   ├── middleware/          # Auth, RBAC, logging
│   │   ├── auth/                # Session and role management
│   │   ├── jobs/                # Cron jobs
│   │   └── utils/               # Database clients
│   ├── tests/                   # Jest test files
│   ├── package.json
│   └── jest.config.js
│
├── frontend/                     # Next.js React app
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── page.jsx         # Dashboard
│   │   │   ├── login/           # Auth pages
│   │   │   ├── notifications/   # Notification center
│   │   │   └── reports/         # Analytics
│   │   ├── components/          # React components (20+ files)
│   │   │   ├── ui/              # Shadcn/Radix UI primitives
│   │   │   ├── kanban/          # Kanban board components
│   │   │   └── task-comment/    # Comment system
│   │   ├── contexts/            # React Context providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities (API client, CSRF, etc.)
│   │   └── styles/              # Global CSS
│   ├── package.json
│   ├── next.config.mjs
│   └── tailwind.config.js
│
├── database/                     # Database migrations
│   └── migrations/
│
├── .github/                      # GitHub Actions CI/CD
│   └── workflows/
│
├── package.json                  # Root package.json (monorepo)
└── README.md                     # This file
```

## API Documentation

### Authentication Endpoints
```
POST   /auth/login              # User login
POST   /auth/logout             # User logout
POST   /auth/refresh            # Refresh session
```

### Project Endpoints
```
GET    /api/projects            # List all projects
POST   /api/projects            # Create project
GET    /api/projects/:id        # Get project details
PUT    /api/projects/:id        # Update project
DELETE /api/projects/:id        # Delete project
POST   /api/projects/:id/staff  # Add team member
DELETE /api/projects/:id/staff  # Remove team member
```

### Task Endpoints
```
GET    /api/tasks               # List tasks (filtered by RBAC)
POST   /api/tasks               # Create task
GET    /api/tasks/:id           # Get task details
PUT    /api/tasks/:id           # Update task
DELETE /api/tasks/:id           # Delete task
POST   /api/tasks/:id/clone     # Clone task (recurring)
GET    /api/tasks/:id/subtasks  # Get subtasks
```

### Notification Endpoints
```
GET    /api/notifications              # List user notifications
POST   /api/notifications/read/:id    # Mark as read
DELETE /api/notifications/:id         # Delete notification
```

### Report Endpoints
```
GET    /api/reports/projects          # Project report
GET    /api/reports/tasks             # Task report
GET    /api/reports/export/:format    # Export (PDF/Excel)
```

For complete API documentation, see the individual route files in `/backend/src/routes/`.

## Testing

### Run Backend Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
cd backend
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
cd backend
npm run test:watch
```

### Run Frontend Linting
```bash
npm run test:frontend
```

### Test Coverage
Current test coverage: ~80%

Coverage areas:
- Controllers: Authentication, Task, Project
- Services: Task, Project, Notification
- Repositories: Task, Project, User
- Middleware: Auth, RBAC

## Deployment

### Production Build

1. **Build frontend**:
   ```bash
   npm run build
   ```

2. **Start production servers**:
   ```bash
   npm run start
   ```

### Environment Considerations

- Set `NODE_ENV=production` in backend
- Configure production database credentials
- Update `CORS_ORIGIN` to production domain
- Enable HTTPS/SSL certificates
- Configure email service for production
- Set up process manager (PM2, Docker)
- Enable monitoring and logging

### CI/CD

GitHub Actions workflows are configured in `.github/workflows/`:
- Automated testing on pull requests
- Code quality checks (ESLint)
- Security scanning (CodeQL, TruffleHog)

## Security

### Authentication & Authorization
- Session-based authentication with secure tokens
- HTTP-only cookies with SameSite protection
- Bcrypt password hashing
- JWT token validation
- Role-Based Access Control (RBAC)

### Security Measures
- CSRF protection (Lusca middleware)
- Content Security Policy (CSP)
- Row-Level Security in Supabase
- Environment-based configuration
- GitHub Actions security scanning

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for IS212 Software Project Management course
- Group: G3T5
- Institution: Singapore Management University

## Support

For questions, issues, or feature requests:
- Open an issue on [GitHub](https://github.com/yourusername/IS212_G3T5/issues)
- Contact the development team

---

**Version**: 1.0.0
**Last Updated**: 2025-11-07
**Maintained by**: IS212 G3T5 Team
