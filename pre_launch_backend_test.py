#!/usr/bin/env python3
"""
PRE-LAUNCH COMPREHENSIVE BACKEND TESTING
Focus: Production-ready verification of all critical backend functionality
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test Credentials
ADMIN_EMAIL = "admin@millionaze.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "testuser_1762213115@example.com"
USER_PASSWORD = "testpass123"

class PreLaunchTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.admin_user_data = None
        self.regular_user_data = None
        self.test_results = []
        self.test_project_id = None
        self.test_task_id = None
        self.test_guest_token = None
        self.test_time_entry_id = None
        self.critical_failures = []
        
    def log_result(self, test_name, success, message, details=None, is_critical=False):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'is_critical': is_critical,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅" if success else "❌"
        critical_marker = " [CRITICAL]" if is_critical else ""
        print(f"{status} {test_name}{critical_marker}: {message}")
        if details and not success:
            print(f"   Details: {details}")
        
        if not success and is_critical:
            self.critical_failures.append(test_name)
    
    def print_section(self, title):
        """Print section header"""
        print(f"\n{'='*80}")
        print(f"  {title}")
        print(f"{'='*80}\n")
    
    # ============ AUTHENTICATION & USER MANAGEMENT ============
    
    def test_admin_login(self):
        """Test POST /api/auth/login with admin credentials"""
        self.print_section("1. AUTHENTICATION & USER MANAGEMENT")
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('access_token')
                self.admin_user_data = data.get('user')
                
                if self.admin_token and self.admin_user_data:
                    self.log_result(
                        "Admin Login",
                        True,
                        f"Admin logged in successfully: {self.admin_user_data.get('name')}",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Admin Login",
                        False,
                        "Missing access_token or user data in response",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Admin Login",
                    False,
                    f"Login failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_user_login(self):
        """Test POST /api/auth/login with regular user credentials"""
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": USER_EMAIL,
                "password": USER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.user_token = data.get('access_token')
                self.regular_user_data = data.get('user')
                
                if self.user_token and self.regular_user_data:
                    self.log_result(
                        "User Login",
                        True,
                        f"User logged in successfully: {self.regular_user_data.get('name')}",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "User Login",
                        False,
                        "Missing access_token or user data in response",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "User Login",
                    False,
                    f"Login failed with status {response.status_code} - Test user may not exist or password incorrect",
                    response.text,
                    is_critical=False  # Not critical if test user doesn't exist
                )
        except Exception as e:
            self.log_result("User Login", False, f"Exception: {str(e)}", is_critical=False)
    
    def test_get_current_user(self):
        """Test GET /api/auth/me"""
        if not self.admin_token:
            self.log_result("Get Current User", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('id') == self.admin_user_data.get('id'):
                    self.log_result(
                        "Get Current User",
                        True,
                        "Current user data retrieved correctly",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Get Current User",
                        False,
                        "User ID mismatch",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Current User",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Current User", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_get_all_users(self):
        """Test GET /api/users (admin only)"""
        if not self.admin_token:
            self.log_result("Get All Users", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/users", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check for password_hash exposure
                    if len(data) > 0 and 'password_hash' in data[0]:
                        self.log_result(
                            "Get All Users",
                            False,
                            "SECURITY ISSUE: password_hash exposed in response",
                            is_critical=True
                        )
                    else:
                        self.log_result(
                            "Get All Users",
                            True,
                            f"Retrieved {len(data)} users, password_hash properly excluded",
                            is_critical=True
                        )
                else:
                    self.log_result(
                        "Get All Users",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get All Users",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get All Users", False, f"Exception: {str(e)}", is_critical=True)
    
    # ============ PROJECTS & GUEST LINKS ============
    
    def test_get_projects(self):
        """Test GET /api/projects"""
        self.print_section("2. PROJECTS & GUEST LINKS")
        
        if not self.admin_token:
            self.log_result("Get Projects", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/projects", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result(
                        "Get Projects",
                        True,
                        f"Retrieved {len(data)} projects",
                        is_critical=True
                    )
                    
                    # Store first project for testing
                    if len(data) > 0:
                        self.test_project_id = data[0].get('id')
                else:
                    self.log_result(
                        "Get Projects",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Projects",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Projects", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_create_project(self):
        """Test POST /api/projects"""
        if not self.admin_token:
            self.log_result("Create Project", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            project_data = {
                "name": "Pre-Launch Test Project",
                "company_name": "Test Company",
                "business_name": "Test Business",
                "client_name": "Test Client",
                "client_email": "testclient@example.com",
                "client_phone": "+1234567890",
                "budget": 10000.0,
                "project_owner": "Test Owner",
                "status": "Getting Started",
                "priority": "High",
                "description": "Project created for pre-launch testing",
                "team_members": []
            }
            
            response = self.session.post(f"{API_BASE}/projects", json=project_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_project_id = data.get('id')
                self.log_result(
                    "Create Project",
                    True,
                    f"Created project: {data.get('name')}",
                    is_critical=True
                )
            else:
                self.log_result(
                    "Create Project",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Create Project", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_generate_guest_link(self):
        """Test POST /api/projects/{id}/generate-guest-link and verify URL format"""
        if not self.admin_token or not self.test_project_id:
            self.log_result("Generate Guest Link", False, "Missing admin token or project ID", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.post(
                f"{API_BASE}/projects/{self.test_project_id}/generate-guest-link",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                guest_token = data.get('guest_link')  # This is the token, not full URL
                
                if guest_token:
                    self.test_guest_token = guest_token
                    # Construct the full guest link URL
                    frontend_url = BACKEND_URL.replace('/api', '')
                    guest_link_url = f"{frontend_url}/guest/{guest_token}"
                    
                    # CRITICAL: Check if constructed URL contains domain (not localhost)
                    if 'localhost' in guest_link_url:
                        self.log_result(
                            "Generate Guest Link",
                            False,
                            f"CRITICAL: Guest link would contain localhost: {guest_link_url}",
                            is_critical=True
                        )
                    else:
                        self.log_result(
                            "Generate Guest Link",
                            True,
                            f"Guest link token generated: {guest_token[:8]}... (URL: {guest_link_url})",
                            is_critical=True
                        )
                else:
                    self.log_result(
                        "Generate Guest Link",
                        False,
                        "Missing guest_link token in response",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Generate Guest Link",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Generate Guest Link", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_guest_access(self):
        """Test POST /api/guest-access/{token}"""
        if not self.test_guest_token:
            self.log_result("Guest Access", False, "No guest token available", is_critical=True)
            return
        
        try:
            guest_data = {
                "name": "Test Guest",
                "email": "testguest@example.com"
            }
            response = self.session.post(
                f"{API_BASE}/guest-access/{self.test_guest_token}",
                json=guest_data
            )
            
            if response.status_code == 200:
                data = response.json()
                # Response includes access_token, user, and project_id
                if 'project_id' in data and 'access_token' in data:
                    self.log_result(
                        "Guest Access",
                        True,
                        f"Guest can access project via token (project_id: {data['project_id'][:8]}...)",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Guest Access",
                        False,
                        "Missing project_id or access_token in response",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Guest Access",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Guest Access", False, f"Exception: {str(e)}", is_critical=True)
    
    # ============ TASKS ============
    
    def test_get_tasks(self):
        """Test GET /api/tasks"""
        self.print_section("3. TASKS")
        
        if not self.admin_token:
            self.log_result("Get Tasks", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/tasks", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result(
                        "Get Tasks",
                        True,
                        f"Retrieved {len(data)} tasks",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Get Tasks",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Tasks",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Tasks", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_create_task(self):
        """Test POST /api/tasks"""
        if not self.admin_token or not self.test_project_id:
            self.log_result("Create Task", False, "Missing admin token or project ID", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            task_data = {
                "project_id": self.test_project_id,
                "title": "Pre-Launch Test Task",
                "description": "Task created for pre-launch testing",
                "assignee": self.admin_user_data.get('id'),
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "priority": "High",
                "status": "Not Started"
            }
            
            response = self.session.post(f"{API_BASE}/tasks", json=task_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_task_id = data.get('id')
                self.log_result(
                    "Create Task",
                    True,
                    f"Created task: {data.get('title')}",
                    is_critical=True
                )
            else:
                self.log_result(
                    "Create Task",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Create Task", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_update_task(self):
        """Test PUT /api/tasks/{task_id}"""
        if not self.admin_token or not self.test_task_id:
            self.log_result("Update Task", False, "Missing admin token or task ID", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            update_data = {
                "status": "In Progress",
                "description": "Updated description for pre-launch testing"
            }
            
            response = self.session.put(
                f"{API_BASE}/tasks/{self.test_task_id}",
                json=update_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == "In Progress":
                    self.log_result(
                        "Update Task",
                        True,
                        "Task updated successfully",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Update Task",
                        False,
                        "Task status not updated",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Update Task",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Update Task", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_get_project_tasks(self):
        """Test GET /api/tasks?project_id={project_id}"""
        if not self.admin_token or not self.test_project_id:
            self.log_result("Get Project Tasks", False, "Missing admin token or project ID", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(
                f"{API_BASE}/tasks",
                params={"project_id": self.test_project_id},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result(
                        "Get Project Tasks",
                        True,
                        f"Retrieved {len(data)} tasks for project",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Get Project Tasks",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Project Tasks",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Project Tasks", False, f"Exception: {str(e)}", is_critical=True)
    
    # ============ TIME ENTRIES ============
    
    def test_clock_in(self):
        """Test POST /api/time-entries/clock-in"""
        self.print_section("4. TIME ENTRIES")
        
        if not self.admin_token or not self.test_task_id or not self.test_project_id:
            self.log_result("Clock In", False, "Missing admin token, task ID, or project ID", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            clock_in_data = {
                "task_id": self.test_task_id,
                "project_id": self.test_project_id
            }
            
            response = self.session.post(
                f"{API_BASE}/time-entries/clock-in",
                json=clock_in_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                time_entry = data.get('time_entry')
                if time_entry and time_entry.get('id'):
                    self.test_time_entry_id = time_entry.get('id')
                    self.log_result(
                        "Clock In",
                        True,
                        "Clocked in successfully",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Clock In",
                        False,
                        "Missing time_entry data in response",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Clock In",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Clock In", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_get_active_time_entry(self):
        """Test GET /api/time-entries/active"""
        if not self.admin_token:
            self.log_result("Get Active Time Entry", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/time-entries/active", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data and data.get('id'):
                    self.log_result(
                        "Get Active Time Entry",
                        True,
                        f"Active time entry retrieved: {data.get('id')}",
                        is_critical=True
                    )
                elif data is None:
                    self.log_result(
                        "Get Active Time Entry",
                        True,
                        "No active time entry (expected if not clocked in)",
                        is_critical=False
                    )
                else:
                    self.log_result(
                        "Get Active Time Entry",
                        False,
                        "Unexpected response format",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Active Time Entry",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Active Time Entry", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_weekly_summary(self):
        """Test GET /api/time-entries/weekly-summary"""
        if not self.admin_token:
            self.log_result("Weekly Summary", False, "No admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Get current week dates
            now = datetime.now()
            start_of_week = now - timedelta(days=now.weekday())
            end_of_week = start_of_week + timedelta(days=6)
            
            params = {
                "start_date": start_of_week.isoformat(),
                "end_date": end_of_week.isoformat()
            }
            
            response = self.session.get(
                f"{API_BASE}/time-entries/weekly-summary",
                params=params,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'users' in data and isinstance(data['users'], list):
                    self.log_result(
                        "Weekly Summary",
                        True,
                        f"Retrieved weekly summary for {len(data['users'])} users",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Weekly Summary",
                        False,
                        "Missing or invalid users data",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Weekly Summary",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Weekly Summary", False, f"Exception: {str(e)}", is_critical=True)
    
    # ============ DOCUMENTS & LINKS ============
    
    def test_get_documents(self):
        """Test GET /api/documents/{project_id}"""
        self.print_section("5. DOCUMENTS & LINKS")
        
        if not self.test_project_id:
            self.log_result("Get Documents", False, "No project ID available", is_critical=True)
            return
        
        try:
            response = self.session.get(f"{API_BASE}/documents/{self.test_project_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result(
                        "Get Documents",
                        True,
                        f"Retrieved {len(data)} documents",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Get Documents",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Documents",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Documents", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_get_useful_links(self):
        """Test GET /api/useful-links/{project_id}"""
        if not self.test_project_id:
            self.log_result("Get Useful Links", False, "No project ID available", is_critical=True)
            return
        
        try:
            response = self.session.get(f"{API_BASE}/useful-links/{self.test_project_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result(
                        "Get Useful Links",
                        True,
                        f"Retrieved {len(data)} useful links",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Get Useful Links",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Useful Links",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Useful Links", False, f"Exception: {str(e)}", is_critical=True)
    
    def test_get_meeting_notes(self):
        """Test GET /api/meeting-notes/{project_id}"""
        if not self.test_project_id or not self.admin_token:
            self.log_result("Get Meeting Notes", False, "No project ID or admin token available", is_critical=True)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/meeting-notes/{self.test_project_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result(
                        "Get Meeting Notes",
                        True,
                        f"Retrieved {len(data)} meeting notes",
                        is_critical=True
                    )
                else:
                    self.log_result(
                        "Get Meeting Notes",
                        False,
                        f"Expected array, got {type(data)}",
                        data,
                        is_critical=True
                    )
            else:
                self.log_result(
                    "Get Meeting Notes",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=True
                )
        except Exception as e:
            self.log_result("Get Meeting Notes", False, f"Exception: {str(e)}", is_critical=True)
    
    # ============ AI TASK EXTRACTION ============
    
    def test_ai_task_extraction(self):
        """Test POST /api/projects/{project_id}/extract-tasks-ai"""
        self.print_section("6. AI TASK EXTRACTION")
        
        if not self.admin_token or not self.test_project_id:
            self.log_result("AI Task Extraction", False, "Missing admin token or project ID", is_critical=False)
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            extraction_data = {
                "include_meeting_notes": True,
                "include_useful_links": True
            }
            
            response = self.session.post(
                f"{API_BASE}/projects/{self.test_project_id}/extract-tasks-ai",
                json=extraction_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'tasks' in data or 'message' in data:
                    self.log_result(
                        "AI Task Extraction",
                        True,
                        "AI task extraction endpoint working",
                        is_critical=False
                    )
                else:
                    self.log_result(
                        "AI Task Extraction",
                        False,
                        "Unexpected response format",
                        data,
                        is_critical=False
                    )
            else:
                self.log_result(
                    "AI Task Extraction",
                    False,
                    f"Failed with status {response.status_code}",
                    response.text,
                    is_critical=False
                )
        except Exception as e:
            self.log_result("AI Task Extraction", False, f"Exception: {str(e)}", is_critical=False)
    
    # ============ BACKEND LOGS CHECK ============
    
    def check_backend_logs(self):
        """Check backend logs for errors"""
        self.print_section("7. BACKEND LOGS CHECK")
        
        print("Checking backend logs for errors...")
        import subprocess
        
        try:
            result = subprocess.run(
                ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                error_log = result.stdout
                if error_log.strip():
                    # Check for critical errors
                    critical_keywords = ['ERROR', 'CRITICAL', 'Exception', 'Traceback']
                    has_errors = any(keyword in error_log for keyword in critical_keywords)
                    
                    if has_errors:
                        self.log_result(
                            "Backend Logs",
                            False,
                            "Errors found in backend logs",
                            error_log[-500:],  # Last 500 chars
                            is_critical=True
                        )
                    else:
                        self.log_result(
                            "Backend Logs",
                            True,
                            "No critical errors in backend logs",
                            is_critical=False
                        )
                else:
                    self.log_result(
                        "Backend Logs",
                        True,
                        "Backend error log is empty (good sign)",
                        is_critical=False
                    )
            else:
                self.log_result(
                    "Backend Logs",
                    False,
                    "Could not read backend logs",
                    is_critical=False
                )
        except Exception as e:
            self.log_result("Backend Logs", False, f"Exception: {str(e)}", is_critical=False)
    
    # ============ SUMMARY ============
    
    def print_summary(self):
        """Print test summary"""
        self.print_section("TEST SUMMARY")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['success'])
        failed_tests = total_tests - passed_tests
        critical_tests = sum(1 for r in self.test_results if r['is_critical'])
        critical_passed = sum(1 for r in self.test_results if r['is_critical'] and r['success'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ({passed_tests/total_tests*100:.1f}%)")
        print(f"Failed: {failed_tests} ({failed_tests/total_tests*100:.1f}%)")
        print(f"\nCritical Tests: {critical_tests}")
        print(f"Critical Passed: {critical_passed} ({critical_passed/critical_tests*100:.1f}%)")
        print(f"Critical Failed: {critical_tests - critical_passed}")
        
        if self.critical_failures:
            print(f"\n❌ CRITICAL FAILURES ({len(self.critical_failures)}):")
            for failure in self.critical_failures:
                print(f"   - {failure}")
        else:
            print(f"\n✅ ALL CRITICAL TESTS PASSED!")
        
        # Group results by section
        print(f"\n{'='*80}")
        print("DETAILED RESULTS BY SECTION:")
        print(f"{'='*80}\n")
        
        sections = {
            "Authentication & User Management": [],
            "Projects & Guest Links": [],
            "Tasks": [],
            "Time Entries": [],
            "Documents & Links": [],
            "AI Task Extraction": [],
            "Backend Logs": []
        }
        
        for result in self.test_results:
            test_name = result['test']
            if any(x in test_name for x in ['Login', 'User', 'Auth']):
                sections["Authentication & User Management"].append(result)
            elif any(x in test_name for x in ['Project', 'Guest']):
                sections["Projects & Guest Links"].append(result)
            elif 'Task' in test_name and 'AI' not in test_name:
                sections["Tasks"].append(result)
            elif any(x in test_name for x in ['Time', 'Clock', 'Weekly']):
                sections["Time Entries"].append(result)
            elif any(x in test_name for x in ['Document', 'Link', 'Meeting']):
                sections["Documents & Links"].append(result)
            elif 'AI' in test_name:
                sections["AI Task Extraction"].append(result)
            elif 'Log' in test_name:
                sections["Backend Logs"].append(result)
        
        for section, results in sections.items():
            if results:
                passed = sum(1 for r in results if r['success'])
                total = len(results)
                status = "✅" if passed == total else "⚠️" if passed > 0 else "❌"
                print(f"{status} {section}: {passed}/{total} passed")
                
                # Show failed tests in this section
                failed = [r for r in results if not r['success']]
                if failed:
                    for f in failed:
                        print(f"   ❌ {f['test']}: {f['message']}")
    
    def run_all_tests(self):
        """Run all pre-launch tests"""
        print("\n" + "="*80)
        print("  PRE-LAUNCH COMPREHENSIVE BACKEND TESTING")
        print("  Testing production-ready functionality")
        print("="*80 + "\n")
        
        # Authentication & User Management
        self.test_admin_login()
        self.test_user_login()
        self.test_get_current_user()
        self.test_get_all_users()
        
        # Projects & Guest Links
        self.test_get_projects()
        self.test_create_project()
        self.test_generate_guest_link()
        self.test_guest_access()
        
        # Tasks
        self.test_get_tasks()
        self.test_create_task()
        self.test_update_task()
        self.test_get_project_tasks()
        
        # Time Entries
        self.test_clock_in()
        self.test_get_active_time_entry()
        self.test_weekly_summary()
        
        # Documents & Links
        self.test_get_documents()
        self.test_get_useful_links()
        self.test_get_meeting_notes()
        
        # AI Task Extraction
        self.test_ai_task_extraction()
        
        # Backend Logs
        self.check_backend_logs()
        
        # Print Summary
        self.print_summary()
        
        # Return exit code
        return 0 if not self.critical_failures else 1

if __name__ == "__main__":
    tester = PreLaunchTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
