# C3 Component Diagram - Smart Task Manager (PlantUML)

This document contains a detailed C3 (Component) diagram using PlantUML syntax, showing the internal structure and component relationships of the Smart Task Manager system.

## Full System Component Diagram

File: `c3-component-full.puml`

```plantuml
@startuml c3-component-full
!define RECTANGLE class

skinparam component {
    BackgroundColor<<frontend>> LightBlue
    BackgroundColor<<backend>> LightGreen
    BackgroundColor<<middleware>> LightYellow
    BackgroundColor<<service>> LightCyan
    BackgroundColor<<repository>> LightGray
    BackgroundColor<<external>> Pink
}

title C3 Component Diagram - Smart Task Manager (Full System)

package "Frontend Container (Next.js - Port 3000)" {

    package "UI Layer" {
        component [Pages/Routes\nApp Router] as Pages <<frontend>>
        component [UI Components\nKanban, Tasks, Projects] as Components <<frontend>>
        component [UI Library\nRadix/Shadcn] as UILib <<frontend>>
    }

    package "State Management" {
        component [Project Context\nproject-context.jsx] as ProjectCtx <<frontend>>
        component [Notification Context\nnotification-context.jsx] as NotifCtx <<frontend>>
        component [Settings Context\nsettings-context.jsx] as SettingsCtx <<frontend>>
    }

    package "Frontend Services" {
        component [API Client\nlib/api.js] as APIClient <<frontend>>
        component [CSRF Handler\nlib/csrf.js] as CSRFHandler <<frontend>>
        component [File Upload\nSupabase Storage] as FileUpload <<frontend>>
    }
}

package "Backend Container (Express.js - Port 3001)" {

    package "Routes Layer" {
        component [Auth Routes\n/auth/*] as AuthRoutes <<backend>>
        component [Task Routes\n/api/tasks/*] as TaskRoutes <<backend>>
        component [Project Routes\n/api/projects/*] as ProjectRoutes <<backend>>
        component [User Routes\n/api/users/*] as UserRoutes <<backend>>
        component [Notification Routes\n/api/notifications/*] as NotifRoutes <<backend>>
        component [Report Routes\n/api/reports/*] as ReportRoutes <<backend>>
        component [Comment Routes\n/api/tasks/:id/comments] as CommentRoutes <<backend>>
        component [Attachment Routes\n/api/tasks/:id/attachments] as AttachRoutes <<backend>>
    }

    package "Middleware Layer" {
        component [Auth Middleware\nSession Validation] as AuthMW <<middleware>>
        component [RBAC Middleware\nPermission Checks] as RBACMW <<middleware>>
        component [Logger Middleware\nRequest/Response Logs] as LoggerMW <<middleware>>
        component [CSRF Protection\nLusca] as CSRFMW <<middleware>>
    }

    package "Controller Layer" {
        component [Task Controller\nRequest Handlers] as TaskCtrl <<backend>>
        component [Project Controller\nRequest Handlers] as ProjectCtrl <<backend>>
        component [User Controller\nRequest Handlers] as UserCtrl <<backend>>
        component [Notification Controller\nRequest Handlers] as NotifCtrl <<backend>>
        component [Report Controller\nRequest Handlers] as ReportCtrl <<backend>>
        component [Comment Controller\nRequest Handlers] as CommentCtrl <<backend>>
        component [Attachment Controller\nRequest Handlers] as AttachCtrl <<backend>>
    }

    package "Service Layer (Business Logic)" {
        component [Task Service\nTask Operations, Recurrence] as TaskSvc <<service>>
        component [Project Service\nProject Management] as ProjectSvc <<service>>
        component [User Service\nUser Management] as UserSvc <<service>>
        component [Notification Service\nIn-app & Email Alerts] as NotifSvc <<service>>
        component [Report Service\nAnalytics & Export] as ReportSvc <<service>>
        component [Comment Service\nComment Operations] as CommentSvc <<service>>
        component [Attachment Service\nFile Management] as AttachSvc <<service>>
        component [Assignee Hours Service\nTime Tracking] as AssigneeSvc <<service>>
        component [RBAC Service\nPermission Logic] as RBACSvc <<service>>
    }

    package "Repository Layer (Data Access)" {
        component [Task Repository\nDB Queries] as TaskRepo <<repository>>
        component [Project Repository\nDB Queries] as ProjectRepo <<repository>>
        component [User Repository\nDB Queries] as UserRepo <<repository>>
        component [Notification Repository\nDB Queries] as NotifRepo <<repository>>
        component [Comment Repository\nDB Queries] as CommentRepo <<repository>>
        component [Attachment Repository\nDB Queries] as AttachRepo <<repository>>
    }

    package "Authentication" {
        component [Session Manager\nCreate/Validate Sessions] as SessionMgr <<service>>
        component [Role Manager\nRole Hierarchy] as RoleMgr <<service>>
    }

    package "Background Jobs" {
        component [Cron Job\nCheck Overdue Tasks] as CronJob <<service>>
    }
}

database "Supabase PostgreSQL\nDatabase" as Database <<external>>
component [SendGrid\nEmail Service] as EmailService <<external>>
database "Supabase Storage\nFile Storage" as Storage <<external>>

' Frontend internal connections
Pages --> Components
Components --> UILib
Components --> ProjectCtx
Components --> NotifCtx
Components --> SettingsCtx
Pages --> APIClient
APIClient --> CSRFHandler
Components --> FileUpload

' Frontend to Backend connections
APIClient --> AuthRoutes : HTTPS/JSON
APIClient --> TaskRoutes : HTTPS/JSON
APIClient --> ProjectRoutes : HTTPS/JSON
APIClient --> UserRoutes : HTTPS/JSON
APIClient --> NotifRoutes : HTTPS/JSON
APIClient --> ReportRoutes : HTTPS/JSON
APIClient --> CommentRoutes : HTTPS/JSON
APIClient --> AttachRoutes : HTTPS/JSON

' Routes to Middleware
AuthRoutes --> AuthMW
TaskRoutes --> AuthMW
ProjectRoutes --> AuthMW
UserRoutes --> AuthMW
NotifRoutes --> AuthMW
ReportRoutes --> AuthMW
CommentRoutes --> AuthMW
AttachRoutes --> AuthMW

' Middleware connections
AuthMW --> RBACMW
AuthMW --> SessionMgr
RBACMW --> RoleMgr

' Routes to Controllers
TaskRoutes --> TaskCtrl
ProjectRoutes --> ProjectCtrl
UserRoutes --> UserCtrl
NotifRoutes --> NotifCtrl
ReportRoutes --> ReportCtrl
CommentRoutes --> CommentCtrl
AttachRoutes --> AttachCtrl

' Controllers to Services
TaskCtrl --> TaskSvc
ProjectCtrl --> ProjectSvc
UserCtrl --> UserSvc
NotifCtrl --> NotifSvc
ReportCtrl --> ReportSvc
CommentCtrl --> CommentSvc
AttachCtrl --> AttachSvc

' Service layer connections
TaskSvc --> TaskRepo
TaskSvc --> NotifSvc
TaskSvc --> RBACSvc
TaskSvc --> AssigneeSvc
ProjectSvc --> ProjectRepo
UserSvc --> UserRepo
NotifSvc --> NotifRepo
CommentSvc --> CommentRepo
AttachSvc --> AttachRepo

' Repository to Database
TaskRepo --> Database : SQL
ProjectRepo --> Database : SQL
UserRepo --> Database : SQL
NotifRepo --> Database : SQL
CommentRepo --> Database : SQL
AttachRepo --> Database : SQL
SessionMgr --> Database : SQL

' External service connections
NotifSvc --> EmailService : HTTPS/REST
FileUpload --> Storage : S3 API
AttachSvc --> Storage : S3 API

' Background jobs
CronJob --> TaskSvc
CronJob --> NotifSvc

@enduml
```

## Backend Components Only (Detailed View)

File: `c3-component-backend-detailed.puml`

```plantuml
@startuml c3-component-backend-detailed
!theme plain

skinparam component {
    BackgroundColor<<routes>> #85BBF0
    BackgroundColor<<middleware>> #B3D9FF
    BackgroundColor<<controller>> #1168BD
    BorderColor<<controller>> #0B4884
    FontColor<<controller>> White
    BackgroundColor<<service>> #52A3DB
    BackgroundColor<<repository>> #D9D9D9
    BackgroundColor<<auth>> #FFA500
}

title C3 Component Diagram - Backend Container (Detailed)

actor "Web Browser" as Browser

package "Express.js Backend (Port 3001)" {

    rectangle "Routes Layer" {
        component "Auth Routes\n/auth/login\n/auth/logout" as AuthR <<routes>>
        component "Task Routes\nGET/POST/PUT/DELETE\n/api/tasks/*" as TaskR <<routes>>
        component "Project Routes\nGET/POST/PUT/DELETE\n/api/projects/*" as ProjR <<routes>>
        component "Notification Routes\nGET/POST/DELETE\n/api/notifications/*" as NotifR <<routes>>
        component "Report Routes\nGET /api/reports/*\nGET /api/reports/export" as ReportR <<routes>>
    }

    rectangle "Middleware" {
        component "Auth Middleware\n- Validate session token\n- Check authentication\n- Attach user to request" as AuthMW <<middleware>>
        component "RBAC Middleware\n- Check user role\n- Verify permissions\n- Enforce hierarchy" as RBACMW <<middleware>>
        component "CSRF Middleware\n- Validate CSRF token\n- Lusca protection" as CSRFMW <<middleware>>
        component "Logger Middleware\n- Log requests\n- Log responses\n- Error tracking" as LogMW <<middleware>>
    }

    rectangle "Controllers" {
        component "Task Controller\n- validateCreateTask()\n- validateUpdateTask()\n- formatTaskResponse()" as TaskC <<controller>>
        component "Project Controller\n- validateCreateProject()\n- validateUpdateProject()\n- formatProjectResponse()" as ProjC <<controller>>
        component "Notification Controller\n- validateMarkAsRead()\n- formatNotificationResponse()" as NotifC <<controller>>
        component "Report Controller\n- validateReportParams()\n- formatReportData()" as ReportC <<controller>>
    }

    rectangle "Services (Business Logic)" {
        component "Task Service\n- createTask()\n- updateTask()\n- handleRecurrence()\n- applyRBACFilter()" as TaskS <<service>>
        component "Project Service\n- createProject()\n- addTeamMember()\n- removeTeamMember()" as ProjS <<service>>
        component "Notification Service\n- sendInAppNotification()\n- sendEmailNotification()\n- notifyTaskAssignment()" as NotifS <<service>>
        component "Report Service\n- generateProjectReport()\n- generateTaskReport()\n- exportToPDF()\n- exportToExcel()" as ReportS <<service>>
        component "RBAC Service\n- checkPermission()\n- canAccessResource()\n- filterByHierarchy()" as RBACS <<service>>
    }

    rectangle "Repositories (Data Access)" {
        component "Task Repository\n- findById()\n- findByProject()\n- create()\n- update()\n- delete()" as TaskRep <<repository>>
        component "Project Repository\n- findById()\n- findByUser()\n- create()\n- update()" as ProjRep <<repository>>
        component "Notification Repository\n- findByUser()\n- create()\n- markAsRead()\n- delete()" as NotifRep <<repository>>
    }

    rectangle "Authentication" {
        component "Session Manager\n- createSession()\n- validateSession()\n- destroySession()\n- cleanupExpired()" as SessMgr <<auth>>
        component "Role Manager\n- getRoleHierarchy()\n- hasPermission()\n- canManageUser()" as RoleMgr <<auth>>
    }
}

database "Supabase\nPostgreSQL" as DB
component "SendGrid\nEmail API" as Email

' Browser connections
Browser -down-> AuthR : POST /auth/login
Browser -down-> TaskR : CRUD requests
Browser -down-> ProjR : CRUD requests
Browser -down-> NotifR : GET/POST
Browser -down-> ReportR : GET

' Routes to Middleware
AuthR -down-> AuthMW
TaskR -down-> AuthMW
ProjR -down-> AuthMW
NotifR -down-> AuthMW
ReportR -down-> AuthMW

' Middleware chain
AuthMW -right-> RBACMW
AuthMW -down-> SessMgr
RBACMW -down-> RoleMgr

' Routes to Controllers
TaskR -down-> TaskC
ProjR -down-> ProjC
NotifR -down-> NotifC
ReportR -down-> ReportC

' Controllers to Services
TaskC -down-> TaskS
ProjC -down-> ProjS
NotifC -down-> NotifS
ReportC -down-> ReportS

' Service interactions
TaskS -down-> TaskRep
TaskS -right-> NotifS
TaskS -right-> RBACS
ProjS -down-> ProjRep
NotifS -down-> NotifRep
ReportS -right-> TaskRep
ReportS -right-> ProjRep

' Repositories to Database
TaskRep -down-> DB : SQL queries
ProjRep -down-> DB : SQL queries
NotifRep -down-> DB : SQL queries
SessMgr -down-> DB : SQL queries

' External services
NotifS -right-> Email : HTTPS/REST

note right of TaskS
  Business Logic Layer
  - Handles recurrence
  - Applies RBAC filters
  - Triggers notifications
  - Manages task lifecycle
end note

note right of RBACS
  Permission System
  - 3-tier hierarchy
  - Admin > Manager > Staff
  - Department/Division rules
end note

@enduml
```

## Frontend Components Only (Detailed View)

File: `c3-component-frontend-detailed.puml`

```plantuml
@startuml c3-component-frontend-detailed
!theme plain

skinparam component {
    BackgroundColor<<page>> #85BBF0
    BackgroundColor<<feature>> #1168BD
    BorderColor<<feature>> #0B4884
    FontColor<<feature>> White
    BackgroundColor<<ui>> #52A3DB
    BackgroundColor<<context>> #B3D9FF
    BackgroundColor<<service>> #FFA500
}

title C3 Component Diagram - Frontend Container (Detailed)

actor "User" as User

package "Next.js Frontend (Port 3000)" {

    rectangle "Pages (App Router)" {
        component "Dashboard Page\napp/page.jsx\n- Main landing\n- Project overview" as DashPage <<page>>
        component "Login Page\napp/login/\n- Authentication UI\n- Form validation" as LoginPage <<page>>
        component "Notifications Page\napp/notifications/\n- Notification center\n- Mark as read" as NotifPage <<page>>
        component "Reports Page\napp/reports/\n- Analytics dashboard\n- Export options" as ReportsPage <<page>>
    }

    rectangle "Feature Components" {
        component "Kanban Board\nkanban-board.jsx\n- Drag-drop columns\n- Status: Todo/In Progress/Done\n- Real-time updates" as Kanban <<feature>>
        component "Project Details\nproject-details.jsx\n- Project info\n- Team members\n- Task list view" as ProjDetails <<feature>>
        component "Task Card\ntask-card.jsx\n- Task display\n- Quick actions\n- Status toggle" as TaskCard <<feature>>
        component "Task Comments\ntask-comment/\n- Comment thread\n- Add/Edit/Delete\n- User mentions" as TaskComments <<feature>>
        component "File Upload\ntask-attachments\n- Drag-drop upload\n- File preview\n- Delete files" as FileUpload <<feature>>
    }

    rectangle "UI Library (Radix/Shadcn)" {
        component "UI Components\n- Button\n- Dialog\n- Card\n- Dropdown\n- Select" as UIComp <<ui>>
    }

    rectangle "State Management (React Context)" {
        component "Project Context\nproject-context.jsx\n- Current project\n- Tasks array\n- Team members" as ProjCtx <<context>>
        component "Notification Context\nnotification-context.jsx\n- Notifications list\n- Unread count\n- Auto-refresh" as NotifCtx <<context>>
        component "Settings Context\nsettings-context.jsx\n- User preferences\n- Theme settings\n- Display options" as SettingsCtx <<context>>
    }

    rectangle "Services & Utilities" {
        component "API Client\nlib/api.js\n- fetchWithAuth()\n- handleErrors()\n- retryLogic()" as API <<service>>
        component "CSRF Handler\nlib/csrf.js\n- fetchCSRFToken()\n- injectToken()" as CSRF <<service>>
        component "Supabase Upload\nlib/supabaseFileUpload.js\n- uploadFile()\n- deleteFile()\n- getPublicUrl()" as Upload <<service>>
    }
}

component "Express.js API\nPort 3001" as Backend
database "Supabase Storage" as Storage

' User interactions
User -down-> DashPage : Navigate
User -down-> LoginPage : Authenticate
User -down-> NotifPage : View alerts
User -down-> ReportsPage : View analytics

' Page to Feature components
DashPage -down-> Kanban : Renders
DashPage -down-> ProjDetails : Renders
Kanban -down-> TaskCard : Renders multiple
ProjDetails -down-> TaskCard : Renders list
TaskCard -down-> TaskComments : Opens dialog
TaskCard -down-> FileUpload : Attach files

' Components to UI Library
Kanban -down-> UIComp : Uses
TaskCard -down-> UIComp : Uses
ProjDetails -down-> UIComp : Uses
TaskComments -down-> UIComp : Uses

' Pages to Context
DashPage -down-> ProjCtx : Consumes
Kanban -down-> ProjCtx : Consumes
ProjDetails -down-> ProjCtx : Consumes
NotifPage -down-> NotifCtx : Consumes
DashPage -down-> SettingsCtx : Consumes

' Components to Services
DashPage -down-> API : Calls
Kanban -down-> API : Calls
TaskCard -down-> API : Calls
TaskComments -down-> API : Calls
LoginPage -down-> API : Calls

API -right-> CSRF : Uses
FileUpload -down-> Upload : Uses

' Services to External
API -down-> Backend : HTTPS/JSON
CSRF -down-> Backend : GET /api/csrf
Upload -down-> Storage : S3 API

note right of Kanban
  Drag & Drop Features
  - DnD Kit library
  - Optimistic updates
  - Auto-save on drop
  - Column: Todo, In Progress, Done
end note

note right of API
  HTTP Client Wrapper
  - Automatic token injection
  - Error handling
  - Retry logic (3 attempts)
  - Request/Response logging
end note

note right of ProjCtx
  Global State
  - Selected project
  - Filtered tasks
  - Team member list
  - Real-time updates
end note

@enduml
```

## Data Flow Diagrams

File: `c3-dataflow-task-creation.puml`

```plantuml
@startuml c3-dataflow-task-creation
!theme plain

title Data Flow - Task Creation

actor User
participant "Create Task Dialog\n(React Component)" as Dialog
participant "API Client\n(lib/api.js)" as API
participant "Task Routes\n(/api/tasks)" as Routes
participant "Auth Middleware" as AuthMW
participant "RBAC Middleware" as RBACMW
participant "Task Controller" as Controller
participant "Task Service" as Service
participant "Task Repository" as Repo
database "Supabase\nPostgreSQL" as DB
participant "Notification Service" as NotifSvc
participant "SendGrid API" as Email

User -> Dialog : Fill form & submit
activate Dialog
Dialog -> API : POST /api/tasks\n{title, description, assignees, ...}
activate API

API -> Routes : HTTPS/JSON request
activate Routes
Routes -> AuthMW : Validate request
activate AuthMW
AuthMW -> AuthMW : Check session token
AuthMW -> RBACMW : User authenticated
deactivate AuthMW

activate RBACMW
RBACMW -> RBACMW : Check user can create task
RBACMW -> Controller : Authorized
deactivate RBACMW

activate Controller
Controller -> Controller : Validate input schema
Controller -> Service : createTask(data)
deactivate Controller

activate Service
Service -> Repo : insert(taskData)
activate Repo
Repo -> DB : INSERT INTO tasks\nVALUES (...)
activate DB
DB --> Repo : task_id
deactivate DB
Repo --> Service : newTask object
deactivate Repo

Service -> NotifSvc : notifyTaskAssignment(newTask)
activate NotifSvc
NotifSvc -> Repo : Insert in-app notification
NotifSvc -> Email : Send email to assignees
Email --> NotifSvc : Email sent
NotifSvc --> Service : Notification sent
deactivate NotifSvc

Service --> Controller : newTask
deactivate Service
activate Controller
Controller --> Routes : 201 Created\n{task: {...}}
deactivate Controller
Routes --> API : Response
deactivate Routes
API --> Dialog : Success
deactivate API

Dialog -> Dialog : Update UI\nRefresh task list
Dialog --> User : Show success toast
deactivate Dialog

@enduml
```

## Deployment Diagram

File: `c3-deployment.puml`

```plantuml
@startuml c3-deployment

title Deployment Diagram - Smart Task Manager

node "User Device" {
    component [Web Browser\nChrome/Firefox/Edge] as Browser
}

cloud "Cloud Infrastructure" {
    node "Frontend Server" {
        component [Next.js Application\nNode.js Runtime\nPort 3000] as Frontend
    }

    node "Backend Server" {
        component [Express.js API\nNode.js Runtime\nPort 3001] as Backend
        component [Background Jobs\nnode-cron] as Cron
    }

    node "Supabase Cloud" {
        database [PostgreSQL Database\nUsers, Projects, Tasks] as DB
        storage [Object Storage\nS3-compatible\nFile Attachments] as Storage
    }

    node "SendGrid Cloud" {
        component [Email Service\nSMTP API] as Email
    }
}

node "GitHub" {
    component [CI/CD\nGitHub Actions\nCodeQL, TruffleHog] as CICD
}

Browser -down-> Frontend : HTTPS (443)
Frontend -down-> Backend : HTTPS/REST (3001)
Backend -down-> DB : PostgreSQL (5432)
Backend -down-> Storage : HTTPS/S3 API
Frontend -down-> Storage : HTTPS/S3 API
Backend -right-> Email : HTTPS/REST
Cron -down-> DB : SQL Queries
CICD -down-> Frontend : Deploy
CICD -down-> Backend : Deploy

note right of Frontend
  Static Generation +
  Server Components

  Environment:
  - Node.js 18+
  - Next.js 14
end note

note right of Backend
  RESTful API

  Environment:
  - Node.js 18+
  - Express.js 5
  - PM2 (process manager)
end note

note bottom of DB
  Managed PostgreSQL
  - Row-Level Security (RLS)
  - Auto-backups
  - Connection pooling
end note

@enduml
```

## How to Use

### Rendering Options

1. **Online PlantUML Editor**
   - Visit: http://www.plantuml.com/plantuml/uml/
   - Paste diagram code
   - View rendered image

2. **VS Code Extension**
   ```bash
   # Install extension
   code --install-extension jebbs.plantuml
   ```
   - Create `.puml` files
   - Press `Alt+D` to preview

3. **Command Line**
   ```bash
   # Install PlantUML
   npm install -g node-plantuml

   # Generate diagrams
   puml generate c3-component-full.puml -o ./output/
   ```

4. **IntelliJ IDEA / WebStorm**
   - Install "PlantUML integration" plugin
   - Right-click `.puml` file → "Show PlantUML Diagram"

### Recommended File Structure

```
diagrams/
├── plantuml/
│   ├── c3-component-full.puml
│   ├── c3-component-backend-detailed.puml
│   ├── c3-component-frontend-detailed.puml
│   ├── c3-dataflow-task-creation.puml
│   └── c3-deployment.puml
└── output/
    ├── c3-component-full.png
    ├── c3-component-backend-detailed.png
    └── ...
```

## Color Legend

| Color | Component Type |
|-------|---------------|
| Light Blue (#85BBF0) | Pages/Routes |
| Dark Blue (#1168BD) | Controllers/Feature Components |
| Cyan (#52A3DB) | Services/UI Library |
| Light Yellow (#B3D9FF) | Middleware/Context |
| Light Gray (#D9D9D9) | Repositories |
| Orange (#FFA500) | Authentication/Utilities |
| Pink | External Systems |
