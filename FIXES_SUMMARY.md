# Comprehensive Fixes - In Progress

## Issues Being Fixed:

### 1. Dashboard Projects ✅
- **Issue**: Projects not syncing, progress bar broken, click not working
- **Root Cause**: 
  - Projects filter includes guests in line 94
  - Navigation route `/project/${id}` should be `/projects?project=${id}`
  - Progress calculation is correct but tasks might not be loading
- **Fix**: Update filter and navigation route

### 2. Dark Mode 🔄
- **Issue**: Only chat area has proper dark mode
- **Fix Needed**: Apply consistent glassmorphism across all pages

### 3. Task Workflow 🔄
- **Issue**: Need approval system
- **Flow**: Team → Under Review → Admin/Client Approve/Reject
- **Fix Needed**: 
  - Update task status transitions
  - Add approval buttons for admin/client
  - Restrict "Under Review" to team members only

### 4. Completed Projects 🔄
- **Issue**: Tasks from completed projects show in My Tasks
- **Fix**: Filter out tasks where project.status === 'Completed'

### 5. Links Menu 🔄
- **Issue**: Dropdown covered/centered
- **Fix**: Position absolutely, increase z-index

### 6. Task Edit 🔄
- **Issue**: No edit icon
- **Fix**: Add pencil icon next to delete for popup edit
