# C4 Architecture Diagrams - Smart Task Manager (Mermaid)

This document contains C4 architecture diagrams using Mermaid syntax.

## Level 1: System Context Diagram

Shows the big picture - how the Smart Task Manager fits into the world.

```mermaid
graph TB
    subgraph "Smart Task Manager System"
        System[Smart Task Manager<br/>Web Application<br/><br/>Enables teams to manage<br/>projects and tasks with<br/>role-based access control]
    end

    Admin[Admin User<br/><br/>System administrator with<br/>full access to manage<br/>users, projects, and<br/>system configuration]
    Manager[Manager User<br/><br/>Project manager who<br/>creates projects and<br/>assigns tasks to team]
    Staff[Staff User<br/><br/>Team member who<br/>executes assigned tasks<br/>and updates status]

    Supabase[(Supabase<br/><br/>PostgreSQL database<br/>and file storage<br/>for application data)]
    SendGrid[SendGrid<br/><br/>Email service for<br/>sending notifications<br/>and alerts]
    GitHub[GitHub<br/><br/>Version control and<br/>CI/CD automation]

    Admin -->|Manages users,<br/>views reports,<br/>configures system| System
    Manager -->|Creates projects,<br/>assigns tasks,<br/>monitors progress| System
    Staff -->|Views tasks,<br/>updates status,<br/>adds comments| System

    System -->|Stores and retrieves<br/>data, uploads files| Supabase
    System -->|Sends email<br/>notifications| SendGrid
    GitHub -->|Deploys application,<br/>runs security scans| System

    style System fill:#1168bd,color:#ffffff
    style Admin fill:#08427b,color:#ffffff
    style Manager fill:#08427b,color:#ffffff
    style Staff fill:#08427b,color:#ffffff
    style Supabase fill:#999999,color:#ffffff
    style SendGrid fill:#999999,color:#ffffff
    style GitHub fill:#999999,color:#ffffff
```

## Level 2: Container Diagram

Shows the high-level technology choices and how containers communicate.

```mermaid
graph TB
    subgraph "User Devices"
        Browser[Web Browser<br/><br/>User interface for<br/>interacting with the<br/>task management system]
    end

    subgraph "Smart Task Manager System"
        Frontend[Next.js Frontend<br/>JavaScript/React<br/><br/>Delivers UI components,<br/>handles client-side routing,<br/>manages state with Context API<br/><br/>Port: 3000]

        Backend[Express.js API<br/>Node.js<br/><br/>Provides REST API,<br/>handles authentication,<br/>enforces RBAC,<br/>processes business logic<br/><br/>Port: 3001]

        CronJobs[Background Jobs<br/>Node.js/node-cron<br/><br/>Scheduled tasks for<br/>overdue task checks,<br/>recurring task creation]
    end

    Database[(Supabase Database<br/>PostgreSQL<br/><br/>Stores users, projects,<br/>tasks, notifications,<br/>comments, attachments)]

    Storage[(Supabase Storage<br/>S3-compatible<br/><br/>Stores uploaded files<br/>and task attachments)]

    Email[SendGrid API<br/>SMTP Service<br/><br/>Sends email notifications<br/>for task assignments,<br/>deadlines, comments]

    Admin[Admin User]
    Manager[Manager User]
    Staff[Staff User]

    Admin -->|Uses HTTPS| Browser
    Manager -->|Uses HTTPS| Browser
    Staff -->|Uses HTTPS| Browser

    Browser -->|Makes API calls<br/>via HTTPS/JSON<br/>Port 3000| Frontend
    Frontend -->|Makes API calls<br/>via HTTPS/JSON<br/>Port 3001| Backend

    Backend -->|Reads/Writes<br/>via PostgreSQL<br/>protocol| Database
    Backend -->|Uploads/Downloads<br/>via S3 API| Storage
    Frontend -->|Uploads files<br/>via S3 API| Storage
    Backend -->|Sends emails<br/>via HTTPS/REST| Email

    CronJobs -->|Queries tasks<br/>PostgreSQL| Database
    CronJobs -->|Triggers<br/>notifications| Backend

    style Frontend fill:#1168bd,color:#ffffff
    style Backend fill:#1168bd,color:#ffffff
    style CronJobs fill:#1168bd,color:#ffffff
    style Browser fill:#08427b,color:#ffffff
    style Database fill:#999999,color:#ffffff
    style Storage fill:#999999,color:#ffffff
    style Email fill:#999999,color:#ffffff
    style Admin fill:#08427b,color:#ffffff
    style Manager fill:#08427b,color:#ffffff
    style Staff fill:#08427b,color:#ffffff
```

## Level 3: Component Diagram - Backend API

Shows the components inside the Express.js Backend container.

```mermaid
graph TB
    Browser[Web Browser]

    subgraph "Express.js Backend Container"
        subgraph "API Routes"
            AuthRoutes[Auth Routes<br/>/auth/*<br/><br/>Login, logout,<br/>session management]
            TaskRoutes[Task Routes<br/>/api/tasks/*<br/><br/>Task CRUD operations]
            ProjectRoutes[Project Routes<br/>/api/projects/*<br/><br/>Project CRUD operations]
            NotifRoutes[Notification Routes<br/>/api/notifications/*<br/><br/>Notification management]
            ReportRoutes[Report Routes<br/>/api/reports/*<br/><br/>Analytics and exports]
        end

        subgraph "Middleware"
            AuthMW[Auth Middleware<br/><br/>Validates sessions,<br/>checks authentication]
            RBACMW[RBAC Middleware<br/><br/>Enforces role-based<br/>permissions]
            CSRFMW[CSRF Middleware<br/><br/>Lusca CSRF protection]
        end

        subgraph "Controllers"
            TaskCtrl[Task Controller<br/><br/>Validates requests,<br/>formats responses]
            ProjectCtrl[Project Controller<br/><br/>Validates requests,<br/>formats responses]
            NotifCtrl[Notification Controller<br/><br/>Validates requests,<br/>formats responses]
        end

        subgraph "Services"
            TaskSvc[Task Service<br/><br/>Business logic:<br/>- Task operations<br/>- Recurrence logic<br/>- RBAC filtering]
            ProjectSvc[Project Service<br/><br/>Business logic:<br/>- Project management<br/>- Team assignments]
            NotifSvc[Notification Service<br/><br/>Business logic:<br/>- In-app notifications<br/>- Email orchestration]
            RBACSvc[RBAC Service<br/><br/>Permission checking<br/>role hierarchy]
        end

        subgraph "Repositories"
            TaskRepo[Task Repository<br/><br/>SQL queries for<br/>task data access]
            ProjectRepo[Project Repository<br/><br/>SQL queries for<br/>project data access]
            NotifRepo[Notification Repository<br/><br/>SQL queries for<br/>notification data]
        end

        subgraph "Authentication"
            SessionMgr[Session Manager<br/><br/>Create/validate<br/>sessions, manage<br/>session lifecycle]
            RoleMgr[Role Manager<br/><br/>Define role hierarchy,<br/>permission mappings]
        end
    end

    Database[(Supabase<br/>PostgreSQL)]
    EmailAPI[SendGrid API]

    Browser -->|HTTPS/JSON| AuthRoutes
    Browser -->|HTTPS/JSON| TaskRoutes
    Browser -->|HTTPS/JSON| ProjectRoutes
    Browser -->|HTTPS/JSON| NotifRoutes
    Browser -->|HTTPS/JSON| ReportRoutes

    AuthRoutes --> AuthMW
    TaskRoutes --> AuthMW
    ProjectRoutes --> AuthMW
    NotifRoutes --> AuthMW
    ReportRoutes --> AuthMW

    AuthMW --> RBACMW
    AuthMW --> SessionMgr
    RBACMW --> RoleMgr

    TaskRoutes --> TaskCtrl
    ProjectRoutes --> ProjectCtrl
    NotifRoutes --> NotifCtrl

    TaskCtrl --> TaskSvc
    ProjectCtrl --> ProjectSvc
    NotifCtrl --> NotifSvc

    TaskSvc --> TaskRepo
    TaskSvc --> RBACSvc
    TaskSvc --> NotifSvc
    ProjectSvc --> ProjectRepo
    NotifSvc --> NotifRepo

    TaskRepo --> Database
    ProjectRepo --> Database
    NotifRepo --> Database
    SessionMgr --> Database

    NotifSvc --> EmailAPI

    style TaskRoutes fill:#85bbf0,color:#000000
    style ProjectRoutes fill:#85bbf0,color:#000000
    style AuthRoutes fill:#85bbf0,color:#000000
    style NotifRoutes fill:#85bbf0,color:#000000
    style ReportRoutes fill:#85bbf0,color:#000000

    style AuthMW fill:#b3d9ff,color:#000000
    style RBACMW fill:#b3d9ff,color:#000000
    style CSRFMW fill:#b3d9ff,color:#000000

    style TaskCtrl fill:#1168bd,color:#ffffff
    style ProjectCtrl fill:#1168bd,color:#ffffff
    style NotifCtrl fill:#1168bd,color:#ffffff

    style TaskSvc fill:#52a3db,color:#000000
    style ProjectSvc fill:#52a3db,color:#000000
    style NotifSvc fill:#52a3db,color:#000000
    style RBACSvc fill:#52a3db,color:#000000
```

## Level 3: Component Diagram - Frontend Application

Shows the components inside the Next.js Frontend container.

```mermaid
graph TB
    User[User Browser]

    subgraph "Next.js Frontend Container"
        subgraph "Pages & Routing"
            DashboardPage[Dashboard Page<br/>app/page.jsx<br/><br/>Main landing page,<br/>project overview]
            LoginPage[Login Page<br/>app/login/<br/><br/>Authentication UI]
            NotifPage[Notifications Page<br/>app/notifications/<br/><br/>Notification center]
            ReportsPage[Reports Page<br/>app/reports/<br/><br/>Analytics dashboard]
        end

        subgraph "Feature Components"
            KanbanBoard[Kanban Board<br/>kanban-board.jsx<br/><br/>Drag-drop task board<br/>by status columns]
            ProjectDetails[Project Details<br/>project-details.jsx<br/><br/>Project information,<br/>team members, tasks]
            TaskCard[Task Card<br/>task-card.jsx<br/><br/>Task display with<br/>actions, status]
            TaskComments[Task Comments<br/>task-comment/<br/><br/>Comment thread UI]
            FileUpload[File Upload<br/>task-attachments<br/><br/>Drag-drop file upload]
        end

        subgraph "UI Components"
            UILib[UI Library<br/>components/ui/*<br/><br/>Radix/Shadcn<br/>primitives: Button,<br/>Dialog, Card, etc.]
        end

        subgraph "State Management"
            ProjectCtx[Project Context<br/>project-context.jsx<br/><br/>Current project state,<br/>tasks, team members]
            NotifCtx[Notification Context<br/>notification-context.jsx<br/><br/>Notification state,<br/>unread count]
            SettingsCtx[Settings Context<br/>settings-context.jsx<br/><br/>User preferences,<br/>theme settings]
        end

        subgraph "Services & Utilities"
            APIClient[API Client<br/>lib/api.js<br/><br/>HTTP client wrapper,<br/>error handling,<br/>token management]
            CSRFHandler[CSRF Handler<br/>lib/csrf.js<br/><br/>CSRF token fetch<br/>and injection]
            SupabaseUpload[Supabase Upload<br/>lib/supabaseFileUpload.js<br/><br/>File upload to<br/>Supabase Storage]
        end
    end

    BackendAPI[Express.js API<br/>Port 3001]
    SupabaseStorage[(Supabase Storage)]

    User --> DashboardPage
    User --> LoginPage
    User --> NotifPage
    User --> ReportsPage

    DashboardPage --> KanbanBoard
    DashboardPage --> ProjectDetails
    KanbanBoard --> TaskCard
    ProjectDetails --> TaskCard
    TaskCard --> TaskComments
    TaskCard --> FileUpload

    KanbanBoard --> UILib
    TaskCard --> UILib
    ProjectDetails --> UILib

    DashboardPage --> ProjectCtx
    KanbanBoard --> ProjectCtx
    ProjectDetails --> ProjectCtx

    NotifPage --> NotifCtx
    DashboardPage --> SettingsCtx

    DashboardPage --> APIClient
    KanbanBoard --> APIClient
    TaskCard --> APIClient
    TaskComments --> APIClient
    LoginPage --> APIClient

    APIClient --> CSRFHandler
    FileUpload --> SupabaseUpload

    APIClient -->|HTTPS REST API<br/>JSON| BackendAPI
    CSRFHandler -->|Fetch CSRF token| BackendAPI
    SupabaseUpload -->|Upload files<br/>S3 API| SupabaseStorage

    style DashboardPage fill:#85bbf0,color:#000000
    style LoginPage fill:#85bbf0,color:#000000
    style NotifPage fill:#85bbf0,color:#000000
    style ReportsPage fill:#85bbf0,color:#000000

    style KanbanBoard fill:#1168bd,color:#ffffff
    style ProjectDetails fill:#1168bd,color:#ffffff
    style TaskCard fill:#1168bd,color:#ffffff
    style TaskComments fill:#1168bd,color:#ffffff
    style FileUpload fill:#1168bd,color:#ffffff

    style UILib fill:#52a3db,color:#000000

    style ProjectCtx fill:#b3d9ff,color:#000000
    style NotifCtx fill:#b3d9ff,color:#000000
    style SettingsCtx fill:#b3d9ff,color:#000000

    style APIClient fill:#1168bd,color:#ffffff
    style CSRFHandler fill:#52a3db,color:#000000
    style SupabaseUpload fill:#52a3db,color:#000000
```

## Key Relationships

### Authentication Flow
```
User → Login Page → API Client → Auth Routes → Auth Middleware → Session Manager → Database
```

### Task Creation Flow
```
User → Kanban Board → API Client → Task Routes → RBAC Middleware → Task Controller → Task Service → Task Repository → Database
```

### Notification Flow
```
Cron Job → Task Service → Notification Service → SendGrid API (Email) + Notification Repository (In-app)
```

### File Upload Flow
```
User → File Upload Component → Supabase Upload → Supabase Storage
File metadata → API Client → Attachment Routes → Attachment Service → Database
```

## Technology Summary

| Level | Components | Technologies |
|-------|-----------|--------------|
| **Context** | Entire System | Web Application |
| **Container** | Frontend | Next.js 14, React 18, Tailwind CSS |
| **Container** | Backend API | Express.js 5, Node.js 18+ |
| **Container** | Database | PostgreSQL (Supabase) |
| **Container** | File Storage | S3-compatible (Supabase) |
| **Component** | Routes | Express Router |
| **Component** | Middleware | Custom + Lusca (CSRF) |
| **Component** | Controllers | JavaScript classes |
| **Component** | Services | Business logic modules |
| **Component** | Repositories | SQL query modules |
| **Component** | UI Components | React functional components |
| **Component** | State | React Context API |
