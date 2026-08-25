#!/bin/bash

# Update all files to use the new config
files=(
  "/app/frontend/src/contexts/SocketContext.js"
  "/app/frontend/src/components/TopBar.jsx"
  "/app/frontend/src/components/Notifications.jsx"
  "/app/frontend/src/pages/ClientProjectView.jsx"
  "/app/frontend/src/pages/Settings.jsx"
  "/app/frontend/src/pages/ClientProjects.jsx"
  "/app/frontend/src/pages/TeamMembers.jsx"
  "/app/frontend/src/pages/Projects.jsx"
  "/app/frontend/src/pages/ProjectViewOld.jsx"
  "/app/frontend/src/pages/GuestInvite.jsx"
  "/app/frontend/src/pages/GuestAccess.jsx"
  "/app/frontend/src/pages/Chats.jsx"
  "/app/frontend/src/pages/MyTasks.jsx"
  "/app/frontend/src/pages/ProjectView.jsx"
  "/app/frontend/src/pages/ProjectViewNew.jsx"
  "/app/frontend/src/pages/Dashboard.jsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file"
    # Add import at the top after other imports
    sed -i "1a import { BACKEND_URL, API_URL } from '../config';" "$file" 2>/dev/null || sed -i "" "1a\
import { BACKEND_URL, API_URL } from '../config';" "$file"
    
    # Replace the old BACKEND_URL line
    sed -i 's/const BACKEND_URL = process\.env\.REACT_APP_BACKEND_URL;/\/\/ Using BACKEND_URL from config/g' "$file" 2>/dev/null || sed -i "" 's/const BACKEND_URL = process\.env\.REACT_APP_BACKEND_URL;/\/\/ Using BACKEND_URL from config/g' "$file"
    sed -i 's/const backendUrl = process\.env\.REACT_APP_BACKEND_URL;/const backendUrl = BACKEND_URL;/g' "$file" 2>/dev/null || sed -i "" 's/const backendUrl = process\.env\.REACT_APP_BACKEND_URL;/const backendUrl = BACKEND_URL;/g' "$file"
  fi
done

echo "Done!"
