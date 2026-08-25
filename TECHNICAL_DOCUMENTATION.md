# Millii - Complete Project Technical Documentation

## Project Overview
**Millii** (formerly Millionaze) is a comprehensive project management and time tracking system with robust Role-Based Access Control (RBAC), real-time chat functionality, and client portal capabilities.

---

## Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Real-time**: WebSocket (Socket.IO)
- **Authentication**: JWT tokens
- **External Integrations**: 
  - GoHighLevel (Email notifications)
  - Jibble (Time tracking - optional)
  - Time tracking built-in system

### Frontend
- **Framework**: React 18
- **Routing**: React Router v6
- **State Management**: React Context API
- **Styling**: Tailwind CSS
- **UI Components**: Custom components + shadcn/ui
- **Real-time**: Socket.IO client
- **HTTP Client**: Axios
- **Rich Text**: Custom contentEditable implementation

### DevOps
- **Process Manager**: Supervisord
- **Web Server**: Nginx (reverse proxy)
- **Environment**: Docker/Kubernetes
- **Hot Reload**: Enabled for both frontend and backend

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Admin      │  │  Team Member │  │    Client    │      │
│  │  Dashboard   │  │   Workspace  │  │    Portal    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓ (API Calls + WebSocket)
┌─────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Auth/RBAC   │  │  API Routes  │  │  WebSocket   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      MongoDB Database                        │
│  users | projects | tasks | channels | messages | ...       │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (MongoDB Collections)

### 1. **users**
```javascript
{
  id: String (UUID),
  email: String (unique),
  password_hash: String,
  name: String,
  role: String, // "admin", "manager", "team member", "user", "client", "guest"
  profile_image_url: String (optional),
  created_at: String (ISO datetime),
  permission_overrides: Object (optional), // Custom permissions per user
  phone: String (optional)
}
```

### 2. **projects**
```javascript
{
  id: String (UUID),
  name: String,
  description: String,
  status: String, // "Not Started", "In Progress", "Completed", "On Hold"
  client_name: String,
  client_email: String,
  budget: Number,
  created_by: String (user_id),
  owner_id: String (user_id),
  team_members: Array<String> (user_ids),
  guests: Array<String> (user_ids),
  guest_link: String (UUID - for guest access),
  archived: Boolean,
  internal_notes: String,
  created_at: String (ISO datetime),
  section_visibility: Object {
    tasks: { team: Boolean, client: Boolean },
    links_documents: { team: Boolean, client: Boolean },
    meeting_notes: { team: Boolean, client: Boolean },
    internal_notes: { team: Boolean, client: Boolean },
    deliverables: { team: Boolean, client: Boolean },
    team_members: { team: Boolean, client: Boolean },
    timesheet: { team: Boolean, client: Boolean }
  }
}
```

### 3. **tasks**
```javascript
{
  id: String (UUID),
  title: String,
  description: String,
  status: String, // "Not Started", "In Progress", "Under Review", "Completed"
  priority: String, // "low", "medium", "high"
  due_date: String (ISO date),
  assignee: String (user_id or email),
  project_id: String (optional - null for standalone tasks),
  created_by: String (user_id),
  created_at: String (ISO datetime)
}
```

### 4. **channels**
```javascript
{
  id: String (UUID),
  name: String,
  type: String, // "team", "project", "direct", "milli_ai"
  description: String (optional),
  project_id: String (optional - for project channels),
  members: Array<String> (user_ids),
  created_by: String (user_id),
  created_at: String (ISO datetime)
}
```

### 5. **messages**
```javascript
{
  id: String (UUID),
  channel_id: String,
  content: String (HTML - supports rich text),
  sender_id: String (user_id),
  sender_name: String,
  timestamp: String (ISO datetime),
  attachments: Array<Object> (optional),
  edited: Boolean,
  edited_at: String (ISO datetime, optional)
}
```

### 6. **notifications**
```javascript
{
  id: String (UUID),
  user_id: String,
  title: String,
  message: String,
  type: String, // "info", "success", "warning", "error"
  read: Boolean,
  link: String (optional),
  created_at: String (ISO datetime)
}
```

### 7. **time_entries** (Time Tracking)
```javascript
{
  id: String (UUID),
  user_id: String,
  task_id: String (optional),
  project_id: String (optional),
  duration: Number (seconds),
  start_time: String (ISO datetime),
  end_time: String (ISO datetime),
  description: String (optional)
}
```

### 8. **documents** (Project Documents/Links)
```javascript
{
  id: String (UUID),
  project_id: String,
  name: String,
  url: String,
  type: String, // "link", "document"
  created_by: String (user_id),
  created_at: String (ISO datetime)
}
```

### 9. **deliverables**
```javascript
{
  id: String (UUID),
  project_id: String,
  name: String,
  description: String,
  due_date: String (ISO date),
  status: String, // "pending", "in_progress", "completed"
  created_at: String (ISO datetime)
}
```

### 10. **notes** (Meeting Notes / Internal Notes)
```javascript
{
  id: String (UUID),
  project_id: String,
  type: String, // "meeting", "internal"
  content: String,
  created_by: String (user_id),
  created_at: String (ISO datetime),
  updated_at: String (ISO datetime)
}
```

---

## Backend API Endpoints

### Authentication (`/api/auth`)
```
POST   /api/auth/register              - Register new user
POST   /api/auth/login                 - Login (returns JWT token)
POST   /api/auth/forgot-password       - Request password reset OTP
POST   /api/auth/verify-otp            - Verify OTP code
POST   /api/auth/reset-password        - Reset password with OTP
GET    /api/auth/me                    - Get current user info
GET    /api/auth/permissions           - Get current user permissions
```

### Users (`/api/users`, `/api/team-members-list`)
```
GET    /api/users                      - List all users (admin only)
GET    /api/users/{user_id}            - Get user by ID
PUT    /api/users/{user_id}            - Update user
DELETE /api/users/{user_id}            - Delete user (admin only)
POST   /api/users                      - Create new user (admin only)
GET    /api/team-members-list          - Get team members (excludes clients/guests)
GET    /api/users/{user_id}/permissions - Get user permissions
PUT    /api/users/{user_id}/permissions - Update user permissions (admin only)
```

### Projects (`/api/projects`)
```
GET    /api/projects                   - List all projects (filtered by role)
GET    /api/projects/{project_id}      - Get project details
POST   /api/projects                   - Create new project
PUT    /api/projects/{project_id}      - Update project
DELETE /api/projects/{project_id}      - Delete project
PUT    /api/projects/{project_id}/visibility - Update section visibility
POST   /api/projects/{project_id}/generate-guest-link - Generate guest access link
GET    /api/projects/{project_id}/guest/{token} - Access project via guest link
POST   /api/projects/{project_id}/archive - Archive project
POST   /api/projects/{project_id}/restore - Restore archived project
```

### Tasks (`/api/tasks`)
```
GET    /api/tasks                      - List all tasks
GET    /api/tasks/{task_id}            - Get task details
POST   /api/tasks                      - Create new task
PUT    /api/tasks/{task_id}            - Update task
DELETE /api/tasks/{task_id}            - Delete task
GET    /api/projects/{project_id}/tasks - Get tasks for project
```

### Channels & Messages (`/api/channels`, `/api/messages`)
```
GET    /api/channels                   - List user's channels (filtered by role)
GET    /api/channels/{channel_id}      - Get channel details
POST   /api/channels                   - Create new channel
PUT    /api/channels/{channel_id}      - Update channel
DELETE /api/channels/{channel_id}      - Delete channel
GET    /api/channels/{channel_id}/messages - Get channel messages
POST   /api/channels/{channel_id}/messages - Send message
PUT    /api/messages/{message_id}      - Edit message
DELETE /api/messages/{message_id}      - Delete message
```

### Notifications (`/api/notifications`)
```
GET    /api/notifications              - List user's notifications
POST   /api/notifications              - Create notification
PUT    /api/notifications/{notification_id}/read - Mark as read
DELETE /api/notifications/{notification_id} - Delete notification
POST   /api/notifications/mark-all-read - Mark all as read
```

### Time Tracking (`/api/time-tracking`)
```
GET    /api/time-tracking-activity     - Get time tracking data
POST   /api/time-entries               - Create time entry
GET    /api/time-entries               - List time entries
```

### Documents & Deliverables
```
POST   /api/projects/{project_id}/documents - Add document/link
GET    /api/projects/{project_id}/documents - List documents
DELETE /api/documents/{doc_id}        - Delete document
POST   /api/projects/{project_id}/deliverables - Add deliverable
GET    /api/projects/{project_id}/deliverables - List deliverables
PUT    /api/deliverables/{deliverable_id} - Update deliverable
```

### Notes
```
POST   /api/projects/{project_id}/notes - Create note (meeting/internal)
GET    /api/projects/{project_id}/notes - List notes
PUT    /api/notes/{note_id}            - Update note
DELETE /api/notes/{note_id}            - Delete note
```

### Admin (`/api/admin`)
```
POST   /api/admin/impersonate/{user_id} - Impersonate user (admin only)
GET    /api/admin/role-permissions     - Get role configurations (admin only)
```

### External Integrations
```
GET    /api/jibble/team-activity       - Get Jibble team activity (optional)
POST   /api/emails/send                - Send email via GoHighLevel
```

### WebSocket Events
```
connect                                 - User connects
disconnect                              - User disconnects
join_channel                           - Join a channel
leave_channel                          - Leave a channel
send_message                           - Send message (broadcasts to channel)
typing                                 - User typing indicator
message_edited                         - Message was edited
message_deleted                        - Message was deleted
```

---

## Role-Based Access Control (RBAC)

### Roles & Default Permissions

#### 1. **Admin**
- Full access to everything
- Can manage users, projects, tasks
- Can impersonate other users
- Can configure permissions
- Can access all sections

#### 2. **Manager**
- Can view team tabs
- Can view time sheets
- Can view reports
- Can complete project tasks
- Can edit workspace settings
- Can create recurring tasks
- Can create new projects
- Can chat with Milli AI
- Can have direct chats

#### 3. **Team Member** (team member role)
- Can chat with Milli AI
- Can have direct chats
- Limited to assigned projects/channels only

#### 4. **User** (Client role in new terminology)
- Can have direct chats (for project channels only)
- Cannot chat with Milli AI
- Can only see projects they're invited to
- Cannot see internal notes/team members by default

#### 5. **Client** 
- Can have direct chats (for project channels only)
- Cannot chat with Milli AI
- Can only see projects they're invited to
- Cannot see internal notes/team members by default

#### 6. **Guest**
- Can have direct chats (for project channels only)
- Cannot chat with Milli AI
- Can only access via guest link
- Limited project visibility

### Permission Override System
Individual users can have custom permissions that override their role defaults via the `permission_overrides` field.

---

## Frontend Component Structure

### Main Layouts
1. **MainLayout** - For admin, managers, team members
   - Sidebar navigation
   - Top bar (notifications, user menu, impersonation controls)
   - Main content area

2. **ClientPortalLayout** - For clients and guests
   - Simplified sidebar (My Projects, Chats)
   - Top bar (user menu)
   - Clean, focused interface

### Key Pages & Routes

#### Admin/Team Workspace
```
/dashboard              - Overview, KPIs, quick tasks, team activity
/my-tasks              - User's assigned tasks (list/table/kanban views)
/projects              - All projects (grid/table/kanban views)
/projects/:id          - Project details with tabs:
                         • Tasks
                         • Links & Documents
                         • Meeting Notes
                         • Deliverables
                         • Internal Notes
                         • Team & Guests
                         • Timesheet (NEW)
/chats                 - Real-time messaging (team, project, DM channels)
/team-members          - Team management
/time-sheet            - Time tracking interface
/reports               - Analytics and reports
/settings              - User and workspace settings
```

#### Client Portal
```
/projects              - Client's projects (filtered by access)
/projects/:id          - Project view (visibility controlled by settings)
/chats                 - Project channel chats only
```

#### Guest Access
```
/guest/:token          - Guest project access via unique link
```

---

## Key Features Implemented

### 1. **Task Management**
- **Trello-style task cards** with dual-modal system:
  - Click card → Quick edit modal (edit status, priority, due date, assignee, project)
  - Click eye icon → Edit title & description only
- Title on first line (bold), description on second line
- Status badges, priority indicators
- Task assignment to users
- Standalone tasks (no project) vs project tasks
- Filtering and sorting

### 2. **Project Section Visibility Control** (NEW)
- Admin can click eye icon on project cards
- Modal with toggles for each section (team vs client visibility):
  - Tasks
  - Links & Documents
  - Meeting Notes
  - Internal Notes
  - Deliverables
  - Team Members
  - Timesheet
- Backend stores visibility settings
- Frontend respects settings when rendering tabs

### 3. **Timesheet Tab** (NEW)
- Shows total hours spent on project
- Task-by-task breakdown with time entries
- Completed tasks count
- Active tasks count
- Displays assignee and task status
- Formatted hours and minutes

### 4. **Rich Text Chat** (NEW)
- Custom contentEditable implementation (React 18 compatible)
- Formatting toolbar:
  - Bold
  - Italic
  - Links
  - Code blocks
  - Emoji picker
  - File attachments
- @ mention functionality with dropdown
- Real-time typing indicators
- Message editing and deletion
- HTML content rendering with mention highlights

### 5. **Channel System**
- **Team channels** - For internal communication
- **Project channels** - Tied to specific projects
- **Direct messages** - 1-on-1 conversations
- **Milli AI channel** - AI assistant (team only)
- Role-based filtering:
  - Clients see only project channels they're members of
  - Team members see channels they're assigned to
  - Admins see all channels

### 6. **Client Names in DM List** (NEW)
- Helper function `getDMChannelDisplayName()`
- Shows user names instead of emails
- Works in DM list and channel header

### 7. **Team Activity Sidebar**
- Shows only team members (excludes clients/guests)
- Real-time updates every 30 seconds
- IN/OUT/BREAK status from time tracking
- Profile pictures and initials
- No manual refresh button needed

### 8. **Authentication & Security**
- JWT token-based authentication
- OTP-based password reset flow
- Email verification via GoHighLevel
- Auto-logout after token expiry
- Impersonation feature for admins (with visual indicator)

### 9. **Notifications System**
- Real-time notifications dropdown
- Mark as read/unread
- Different types (info, success, warning, error)
- Notification count badge

### 10. **Guest Access**
- Unique guest links per project
- Token-based authentication
- Limited visibility based on project settings
- Automatic layout switching

---

## Recent Changes & Improvements

### Session 1: Core Fixes
1. Fixed OTP password reset bug
2. Rebranded from "Millionaze" to "Millii"
3. Increased logo and text size, centered in header

### Session 2: Task UI Overhaul
1. Implemented Trello-style task cards
2. Dual-modal system (quick edit vs title/description edit)
3. New card layout (title first line, description second)
4. Applied across Dashboard, My Tasks, Project Views
5. Fixed modal glitching issues

### Session 3: Permissions & Visibility
1. Fixed assignee display bug (field name mismatch)
2. Implemented RBAC for task editing
3. Team members can edit their own standalone tasks
4. Hidden "Assigned To" field for standalone tasks

### Session 4: Team Activity
1. Real-time updates (30-second interval)
2. Filtered to show only team members (no clients/guests)
3. Removed manual refresh button
4. Backend filtering improvements

### Session 5: Chat Enhancements
1. External users (user/client/guest) see project channels only
2. Team members see channels they're members of
3. Added "team member" role to backend permissions
4. Updated team-members-list endpoint

### Session 6: Project Visibility Controls
1. Created ProjectVisibilityModal component
2. Added eye icon to project cards (admin only)
3. Toggle visibility for 7 sections (team vs client)
4. Implemented backend endpoint for visibility updates
5. Frontend respects visibility settings dynamically

### Session 7: Timesheet Implementation
1. Added Timesheet tab to project views
2. Summary cards (total hours, completed tasks, active tasks)
3. Task-by-task time breakdown table
4. Integrated with time tracking system
5. Visibility control (hidden from clients by default)

### Session 8: Rich Text Chat
1. Replaced react-quill with custom contentEditable (React 18 fix)
2. Added emoji picker integration
3. File attachment support
4. @ mention with user dropdown
5. Formatting toolbar (bold, italic, links, code)
6. HTML rendering with mention highlighting
7. Fixed insertMention for contentEditable

### Session 9: Client Portal Chat Access
1. Fixed redirect loop for clients
2. Updated ProtectedRoute to redirect clients to /projects
3. Fixed role confusion (team member vs client)
4. Added debug logging
5. Ensured clients can access chats with proper permissions

### Session 10: UI Cleanup
1. Removed "View all notifications" button
2. Removed debug console logs from MainLayout
3. Fixed timeTrackingData undefined error in Projects page
4. Error-free dashboard verification

---

## Environment Configuration

### Backend (.env)
```bash
# MongoDB
MONGO_URL=mongodb://localhost:27017/
DB_NAME=millii_workflow

# JWT Secret
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=720

# GoHighLevel (Email)
GHL_API_KEY=your-ghl-api-key
GHL_LOCATION_ID=your-location-id

# Jibble (Optional)
JIBBLE_CLIENT_ID=your-jibble-client-id
JIBBLE_CLIENT_SECRET=your-jibble-client-secret

# Server
PORT=8001
HOST=0.0.0.0
```

### Frontend (.env)
```bash
# Backend URL (configured for production)
REACT_APP_BACKEND_URL=https://your-backend-url.com

# Do NOT modify - this is production configured
```

---

## Running the Application

### Backend
```bash
cd /app/backend
sudo supervisorctl restart backend
# or
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd /app/frontend
sudo supervisorctl restart frontend
# or
yarn start
```

### Both
```bash
sudo supervisorctl restart all
```

### Check Status
```bash
sudo supervisorctl status
```

### View Logs
```bash
# Backend
tail -f /var/log/supervisor/backend.err.log

# Frontend
tail -f /var/log/supervisor/frontend.err.log
```

---

## Important Notes for Developer

### 1. **URL Configuration - DO NOT MODIFY**
```javascript
// Frontend always uses environment variable
const API_URL = process.env.REACT_APP_BACKEND_URL;

// Backend always binds to 0.0.0.0:8001
# This is mapped by Kubernetes/supervisor - do not change
```

### 2. **MongoDB ObjectID**
- **DO NOT USE** MongoDB's ObjectId
- **USE** UUIDs for all IDs
- Reason: ObjectId is not JSON serializable

### 3. **DateTime Handling**
```python
# Always use timezone-aware datetime
from datetime import datetime, timezone
datetime.now(timezone.utc)

# NOT datetime.utcnow() (deprecated)
```

### 4. **Installing Packages**
```bash
# Backend
cd /app/backend
pip install <package>
pip freeze > requirements.txt

# Frontend
cd /app/frontend
yarn add <package>  # NOT npm install
```

### 5. **Nginx Routing**
- All `/api/*` routes → Backend (port 8001)
- All other routes → Frontend (port 3000)
- WebSocket connections → Backend

### 6. **Permission Checking**
```javascript
// Frontend
const { hasPermission } = usePermissions();
if (hasPermission('can_edit_tasks')) {
  // Show edit button
}

// Backend
from dependencies import get_current_user
async def protected_route(current_user: User = Depends(get_current_user)):
    # Route is protected
```

### 7. **Impersonation**
- Admin can impersonate any user
- Original token stored in localStorage
- Yellow banner shows "Viewing as X"
- Exit impersonation restores admin session

### 8. **Role Mapping**
```
Database Role    → UI Display      → Permissions Level
---------------------------------------------------------
admin            → Admin           → Full access
manager          → Manager         → High access
team member      → Team Member     → Medium access
user             → Client          → Limited (external)
client           → Client          → Limited (external)
guest            → Guest           → Very limited
```

---

## API Authentication

### Headers Required
```javascript
{
  'Authorization': 'Bearer <jwt_token>',
  'Content-Type': 'application/json'
}
```

### Getting Token
```javascript
// Login
const response = await axios.post(`${API_URL}/api/auth/login`, {
  email: 'user@example.com',
  password: 'password123'
});

const token = response.data.access_token;
localStorage.setItem('token', token);
```

### Using Token
```javascript
const token = localStorage.getItem('token');
const response = await axios.get(`${API_URL}/api/projects`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## WebSocket Connection

### Client-side
```javascript
import io from 'socket.io-client';

const socket = io(API_URL, {
  auth: { token: localStorage.getItem('token') }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.emit('join_channel', { channel_id: 'channel-uuid' });

socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

---

## Common Issues & Solutions

### Issue 1: "findDOMNode is deprecated"
**Solution**: Replaced react-quill with custom contentEditable

### Issue 2: Client redirect loop
**Solution**: Ensure user role is correct, log out and back in after role change

### Issue 3: timeTrackingData undefined
**Solution**: Added state initialization and API fetch in fetchProjectDetails

### Issue 4: Permissions not updating
**Solution**: User must log out and back in after permission changes

### Issue 5: Chat not showing for clients
**Solution**: Check role in database, ensure it's "client" not "team member"

---

## Testing Accounts

```
Admin:
  Email: admin@millionaze.com
  Password: admin123

Team Member:
  Email: testuser@millionaze.com
  Password: admin123

Client:
  Email: irfanics786@gmail.com
  Password: admin123
  Role: client
```

---

## Future Enhancements Suggested

1. **Grid View** - Implement grid view for tasks in Projects page
2. **Milli AI** - Complete AI assistant implementation
3. **Advanced Reporting** - More detailed analytics
4. **Mobile App** - React Native mobile version
5. **Export Features** - PDF/Excel exports for reports
6. **File Storage** - Integrate with S3 or similar for attachments
7. **Email Notifications** - More comprehensive email system
8. **Calendar Integration** - Sync with Google Calendar
9. **Gantt Charts** - Project timeline visualization
10. **Resource Management** - Capacity planning

---

## Contact & Support

For technical questions or issues:
1. Check logs: `/var/log/supervisor/`
2. Check MongoDB: `mongo millii_workflow`
3. Restart services: `sudo supervisorctl restart all`
4. Review this documentation

---

**Last Updated**: October 24, 2025
**Version**: 2.0
**Status**: Production Ready
