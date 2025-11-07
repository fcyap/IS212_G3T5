# C4 Architecture Diagrams - Smart Task Manager (PlantUML)

This document contains C4 architecture diagrams using PlantUML C4 model syntax.

## Setup Instructions

To render these diagrams, you need:
1. PlantUML with C4-PlantUML library
2. Include the C4 model by using the `!include` directives shown in each diagram

## Level 1: System Context Diagram

File: `c4-context.puml`

```plantuml
@startuml c4-context
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

LAYOUT_WITH_LEGEND()

title System Context Diagram for Smart Task Manager

Person(admin, "Admin User", "System administrator with full access to manage users, projects, and system configuration")
Person(manager, "Manager User", "Project manager who creates projects and assigns tasks to team members")
Person(staff, "Staff User", "Team member who executes assigned tasks and updates their status")

System(taskManager, "Smart Task Manager", "Web application that enables teams to manage projects and tasks with role-based access control, notifications, and reporting")

System_Ext(supabase, "Supabase", "PostgreSQL database and file storage platform for application data")
System_Ext(sendgrid, "SendGrid", "Email service for sending notifications and alerts to users")
System_Ext(github, "GitHub", "Version control and CI/CD automation platform")

Rel(admin, taskManager, "Manages users, views reports, configures system", "HTTPS")
Rel(manager, taskManager, "Creates projects, assigns tasks, monitors progress", "HTTPS")
Rel(staff, taskManager, "Views tasks, updates status, adds comments", "HTTPS")

Rel(taskManager, supabase, "Stores and retrieves data, uploads files", "PostgreSQL/S3 API")
Rel(taskManager, sendgrid, "Sends email notifications", "HTTPS/REST")
Rel(github, taskManager, "Deploys application, runs security scans", "GitHub Actions")

@enduml
```

## Level 2: Container Diagram

File: `c4-container.puml`

```plantuml
@startuml c4-container
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

LAYOUT_WITH_LEGEND()

title Container Diagram for Smart Task Manager

Person(admin, "Admin User", "System administrator")
Person(manager, "Manager User", "Project manager")
Person(staff, "Staff User", "Team member")

System_Boundary(taskManagerSystem, "Smart Task Manager") {
    Container(frontend, "Next.js Frontend", "JavaScript, React 18, Next.js 14", "Delivers the user interface, handles client-side routing, manages application state with Context API")
    Container(backend, "Express.js API", "Node.js, Express.js 5", "Provides REST API endpoints, handles authentication, enforces role-based access control, processes business logic")
    Container(cronJobs, "Background Jobs", "Node.js, node-cron", "Scheduled tasks for checking overdue tasks and creating recurring tasks")
}

ContainerDb(database, "Supabase Database", "PostgreSQL", "Stores users, projects, tasks, notifications, comments, and attachments")
ContainerDb(storage, "Supabase Storage", "S3-compatible Object Storage", "Stores uploaded files and task attachments")
System_Ext(email, "SendGrid API", "Sends email notifications for task assignments, deadlines, and comments")

Rel(admin, frontend, "Uses", "HTTPS")
Rel(manager, frontend, "Uses", "HTTPS")
Rel(staff, frontend, "Uses", "HTTPS")

Rel(frontend, backend, "Makes API calls to", "HTTPS/JSON, Port 3001")
Rel(frontend, storage, "Uploads files to", "HTTPS/S3 API")

Rel(backend, database, "Reads from and writes to", "PostgreSQL protocol")
Rel(backend, storage, "Uploads and downloads files", "S3 API")
Rel(backend, email, "Sends emails using", "HTTPS/REST")

Rel(cronJobs, database, "Queries tasks", "PostgreSQL protocol")
Rel(cronJobs, backend, "Triggers notifications via", "Internal API")

@enduml
```

## Level 3: Component Diagram - Backend API

File: `c4-component-backend.puml`

```plantuml
@startuml c4-component-backend
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Component Diagram for Express.js Backend Container

Container(frontend, "Next.js Frontend", "JavaScript, React", "Delivers the user interface")
ContainerDb(database, "Supabase Database", "PostgreSQL", "Stores application data")
System_Ext(email, "SendGrid API", "Sends email notifications")

Container_Boundary(backend, "Express.js Backend") {
    Component(authRoutes, "Auth Routes", "Express Router", "Handles authentication endpoints: login, logout, session management")
    Component(taskRoutes, "Task Routes", "Express Router", "Handles task CRUD operations and task-related endpoints")
    Component(projectRoutes, "Project Routes", "Express Router", "Handles project CRUD operations and team management")
    Component(notifRoutes, "Notification Routes", "Express Router", "Handles notification management endpoints")
    Component(reportRoutes, "Report Routes", "Express Router", "Handles analytics and report generation endpoints")

    Component(authMiddleware, "Auth Middleware", "Express Middleware", "Validates sessions and checks user authentication")
    Component(rbacMiddleware, "RBAC Middleware", "Express Middleware", "Enforces role-based permissions for resource access")
    Component(csrfMiddleware, "CSRF Middleware", "Lusca", "Provides CSRF token protection for state-changing operations")

    Component(taskController, "Task Controller", "JavaScript Module", "Validates task requests and formats responses")
    Component(projectController, "Project Controller", "JavaScript Module", "Validates project requests and formats responses")
    Component(notifController, "Notification Controller", "JavaScript Module", "Validates notification requests and formats responses")

    Component(taskService, "Task Service", "JavaScript Module", "Implements business logic for task operations, recurrence, and RBAC filtering")
    Component(projectService, "Project Service", "JavaScript Module", "Implements business logic for project management and team assignments")
    Component(notifService, "Notification Service", "JavaScript Module", "Orchestrates in-app and email notifications")
    Component(rbacService, "RBAC Service", "JavaScript Module", "Handles permission checking and role hierarchy logic")

    Component(taskRepo, "Task Repository", "JavaScript Module", "Executes SQL queries for task data access")
    Component(projectRepo, "Project Repository", "JavaScript Module", "Executes SQL queries for project data access")
    Component(notifRepo, "Notification Repository", "JavaScript Module", "Executes SQL queries for notification data access")

    Component(sessionManager, "Session Manager", "JavaScript Module", "Creates and validates user sessions, manages session lifecycle")
    Component(roleManager, "Role Manager", "JavaScript Module", "Defines role hierarchy and permission mappings")
}

Rel(frontend, authRoutes, "Calls", "HTTPS/JSON")
Rel(frontend, taskRoutes, "Calls", "HTTPS/JSON")
Rel(frontend, projectRoutes, "Calls", "HTTPS/JSON")
Rel(frontend, notifRoutes, "Calls", "HTTPS/JSON")
Rel(frontend, reportRoutes, "Calls", "HTTPS/JSON")

Rel(authRoutes, authMiddleware, "Uses")
Rel(taskRoutes, authMiddleware, "Uses")
Rel(projectRoutes, authMiddleware, "Uses")
Rel(notifRoutes, authMiddleware, "Uses")
Rel(reportRoutes, authMiddleware, "Uses")

Rel(authMiddleware, rbacMiddleware, "Passes to")
Rel(authMiddleware, sessionManager, "Uses")
Rel(rbacMiddleware, roleManager, "Uses")

Rel(taskRoutes, taskController, "Routes to")
Rel(projectRoutes, projectController, "Routes to")
Rel(notifRoutes, notifController, "Routes to")

Rel(taskController, taskService, "Calls")
Rel(projectController, projectService, "Calls")
Rel(notifController, notifService, "Calls")

Rel(taskService, taskRepo, "Uses")
Rel(taskService, rbacService, "Uses")
Rel(taskService, notifService, "Triggers")
Rel(projectService, projectRepo, "Uses")
Rel(notifService, notifRepo, "Uses")

Rel(taskRepo, database, "Reads/Writes", "SQL")
Rel(projectRepo, database, "Reads/Writes", "SQL")
Rel(notifRepo, database, "Reads/Writes", "SQL")
Rel(sessionManager, database, "Reads/Writes", "SQL")

Rel(notifService, email, "Sends emails via", "HTTPS/REST")

@enduml
```

## Level 3: Component Diagram - Frontend Application

File: `c4-component-frontend.puml`

```plantuml
@startuml c4-component-frontend
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Component Diagram for Next.js Frontend Container

Person(user, "User", "Application user (Admin/Manager/Staff)")
Container(backend, "Express.js API", "Node.js, Express", "Provides REST API endpoints")
ContainerDb(storage, "Supabase Storage", "S3-compatible", "Stores uploaded files")

Container_Boundary(frontend, "Next.js Frontend") {
    Component(dashboardPage, "Dashboard Page", "Next.js Page", "Main landing page showing project overview")
    Component(loginPage, "Login Page", "Next.js Page", "Authentication user interface")
    Component(notifPage, "Notifications Page", "Next.js Page", "Notification center for user alerts")
    Component(reportsPage, "Reports Page", "Next.js Page", "Analytics dashboard and reports")

    Component(kanbanBoard, "Kanban Board", "React Component", "Drag-and-drop task board organized by status columns")
    Component(projectDetails, "Project Details", "React Component", "Displays project information, team members, and tasks")
    Component(taskCard, "Task Card", "React Component", "Task display with actions, status, and details")
    Component(taskComments, "Task Comments", "React Component", "Comment thread UI for task discussions")
    Component(fileUpload, "File Upload", "React Component", "Drag-and-drop file upload interface")

    Component(uiLibrary, "UI Library", "Radix/Shadcn Components", "Reusable UI primitives: Button, Dialog, Card, etc.")

    Component(projectContext, "Project Context", "React Context", "Manages current project state, tasks, and team members")
    Component(notifContext, "Notification Context", "React Context", "Manages notification state and unread count")
    Component(settingsContext, "Settings Context", "React Context", "Manages user preferences and theme settings")

    Component(apiClient, "API Client", "JavaScript Module", "HTTP client wrapper with error handling and token management")
    Component(csrfHandler, "CSRF Handler", "JavaScript Module", "Fetches and injects CSRF tokens into requests")
    Component(supabaseUpload, "Supabase Upload", "JavaScript Module", "Handles file upload to Supabase Storage")
}

Rel(user, dashboardPage, "Views")
Rel(user, loginPage, "Uses")
Rel(user, notifPage, "Views")
Rel(user, reportsPage, "Views")

Rel(dashboardPage, kanbanBoard, "Renders")
Rel(dashboardPage, projectDetails, "Renders")
Rel(kanbanBoard, taskCard, "Renders")
Rel(projectDetails, taskCard, "Renders")
Rel(taskCard, taskComments, "Renders")
Rel(taskCard, fileUpload, "Renders")

Rel(kanbanBoard, uiLibrary, "Uses")
Rel(taskCard, uiLibrary, "Uses")
Rel(projectDetails, uiLibrary, "Uses")

Rel(dashboardPage, projectContext, "Uses")
Rel(kanbanBoard, projectContext, "Uses")
Rel(projectDetails, projectContext, "Uses")
Rel(notifPage, notifContext, "Uses")
Rel(dashboardPage, settingsContext, "Uses")

Rel(dashboardPage, apiClient, "Calls")
Rel(kanbanBoard, apiClient, "Calls")
Rel(taskCard, apiClient, "Calls")
Rel(taskComments, apiClient, "Calls")
Rel(loginPage, apiClient, "Calls")

Rel(apiClient, csrfHandler, "Uses")
Rel(fileUpload, supabaseUpload, "Uses")

Rel(apiClient, backend, "Makes API calls", "HTTPS/JSON")
Rel(csrfHandler, backend, "Fetches CSRF token", "HTTPS")
Rel(supabaseUpload, storage, "Uploads files", "S3 API")

@enduml
```

## How to Use These Diagrams

### Online Rendering
1. Visit [PlantUML Online Editor](http://www.plantuml.com/plantuml/uml/)
2. Copy and paste the diagram code
3. View the rendered diagram

### VS Code
1. Install the "PlantUML" extension
2. Create `.puml` files with the code above
3. Use `Alt+D` to preview

### Local Rendering
```bash
# Install PlantUML
npm install -g node-plantuml

# Generate PNG
puml generate c4-context.puml -o output/
```

### IntelliJ/WebStorm
1. Install "PlantUML integration" plugin
2. Create `.puml` files
3. Right-click and select "Show PlantUML Diagram"

## File Structure for PlantUML Diagrams

Create separate files for each diagram:

```
diagrams/
├── c4-context.puml          (Level 1: System Context)
├── c4-container.puml        (Level 2: Containers)
├── c4-component-backend.puml (Level 3: Backend Components)
└── c4-component-frontend.puml (Level 3: Frontend Components)
```

## Notes

- The C4-PlantUML library provides specialized stereotypes for C4 diagrams
- Colors and styling are automatically applied based on component types
- Legends are automatically generated using `LAYOUT_WITH_LEGEND()`
- These diagrams follow the official C4 model conventions
