#!/usr/bin/env python3
"""
My Tasks Investigation Script
Comprehensive investigation of why My Tasks is not working for the current user
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class MyTasksInvestigator:
    def __init__(self):
        self.session = requests.Session()
        self.current_user = None
        self.current_token = None
        self.investigation_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log investigation result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.investigation_results.append(result)
        status = "✅" if success else "❌"
        print(f"{status} {test_name}: {message}")
        if details and isinstance(details, dict):
            for key, value in details.items():
                print(f"   {key}: {value}")
        elif details:
            print(f"   Details: {details}")
    
    def setup_current_user_session(self):
        """Try to login as the admin user to simulate current session"""
        print("\n=== 🔍 IDENTIFYING CURRENT USER SESSION ===")
        
        # Try admin login first (most likely current user)
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                self.current_token = data['access_token']
                self.current_user = data['user']
                
                user_details = {
                    "User ID": self.current_user['id'],
                    "Email": self.current_user['email'],
                    "Name": self.current_user['name'],
                    "Role": self.current_user['role']
                }
                
                self.log_result("Current User Identity", True, 
                              f"Successfully identified current user: {self.current_user['name']}", 
                              user_details)
                return True
        except Exception as e:
            pass
        
        # Try other common users if admin fails
        test_users = [
            {"email": "testuser@millionaze.com", "password": "testpass123"},
            {"email": "maria@millionaze.com", "password": "changeme123"},
            {"email": "irfan@millionaze.com", "password": "changeme123"}
        ]
        
        for creds in test_users:
            try:
                response = self.session.post(f"{API_BASE}/auth/login", json=creds)
                if response.status_code == 200:
                    data = response.json()
                    self.current_token = data['access_token']
                    self.current_user = data['user']
                    
                    user_details = {
                        "User ID": self.current_user['id'],
                        "Email": self.current_user['email'],
                        "Name": self.current_user['name'],
                        "Role": self.current_user['role']
                    }
                    
                    self.log_result("Current User Identity", True, 
                                  f"Successfully identified current user: {self.current_user['name']}", 
                                  user_details)
                    return True
            except Exception as e:
                continue
        
        self.log_result("Current User Identity", False, "Failed to identify current user session")
        return False
    
    def test_my_tasks_endpoint_direct(self):
        """Test the /api/my-tasks endpoint directly with current session"""
        print("\n=== 🎯 DIRECT MY TASKS ENDPOINT TESTING ===")
        
        if not self.current_token:
            self.log_result("My Tasks Endpoint Test", False, "No current user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.current_token}"}
            response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    task_count = len(data)
                    
                    endpoint_details = {
                        "Response Type": "Array",
                        "Task Count": task_count,
                        "HTTP Status": response.status_code
                    }
                    
                    if task_count > 0:
                        # Analyze first few tasks
                        sample_tasks = data[:3]
                        task_analysis = {}
                        for i, task in enumerate(sample_tasks):
                            task_analysis[f"Task {i+1}"] = {
                                "Title": task.get('title', 'N/A'),
                                "Assignee": task.get('assignee', 'N/A'),
                                "Status": task.get('status', 'N/A'),
                                "Project ID": task.get('project_id', 'N/A')
                            }
                        endpoint_details.update(task_analysis)
                        
                        self.log_result("My Tasks Endpoint Response", True, 
                                      f"Endpoint returns {task_count} tasks", 
                                      endpoint_details)
                    else:
                        self.log_result("My Tasks Endpoint Response", False, 
                                      "Endpoint returns EMPTY array - This is the problem!", 
                                      endpoint_details)
                else:
                    self.log_result("My Tasks Endpoint Response", False, 
                                  f"Unexpected response type: {type(data)}", 
                                  {"Response": str(data)[:200]})
                    
            else:
                self.log_result("My Tasks Endpoint Test", False, 
                              f"HTTP {response.status_code}", 
                              {"Response": response.text[:200]})
                
        except Exception as e:
            self.log_result("My Tasks Endpoint Test", False, f"Exception: {str(e)}")
    
    def analyze_all_tasks_vs_my_tasks(self):
        """Compare all tasks with my tasks to find assignment patterns"""
        print("\n=== 📊 TASK ASSIGNMENT PATTERN ANALYSIS ===")
        
        if not self.current_token or not self.current_user:
            self.log_result("Task Assignment Analysis", False, "Missing current user data")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.current_token}"}
            
            # Get all tasks
            all_tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
            my_tasks_response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
            
            if all_tasks_response.status_code == 200 and my_tasks_response.status_code == 200:
                all_tasks = all_tasks_response.json()
                my_tasks = my_tasks_response.json()
                
                analysis_details = {
                    "Total Tasks in System": len(all_tasks),
                    "My Tasks Count": len(my_tasks),
                    "Current User ID": self.current_user['id'],
                    "Current User Email": self.current_user['email'],
                    "Current User Name": self.current_user['name']
                }
                
                # Analyze assignment patterns
                assigned_by_id = []
                assigned_by_email = []
                assigned_by_name = []
                assigned_by_other = []
                
                for task in all_tasks:
                    assignee = task.get('assignee')
                    if assignee:
                        if assignee == self.current_user['id']:
                            assigned_by_id.append(task)
                        elif assignee == self.current_user['email']:
                            assigned_by_email.append(task)
                        elif assignee == self.current_user['name']:
                            assigned_by_name.append(task)
                        else:
                            assigned_by_other.append(assignee)
                
                assignment_patterns = {
                    "Tasks Assigned by ID": len(assigned_by_id),
                    "Tasks Assigned by Email": len(assigned_by_email),
                    "Tasks Assigned by Name": len(assigned_by_name),
                    "Tasks Assigned to Others": len(assigned_by_other)
                }
                
                analysis_details.update(assignment_patterns)
                
                # Show sample assignments
                if assigned_by_id:
                    analysis_details["Sample ID Assignment"] = assigned_by_id[0].get('title', 'N/A')
                if assigned_by_email:
                    analysis_details["Sample Email Assignment"] = assigned_by_email[0].get('title', 'N/A')
                if assigned_by_name:
                    analysis_details["Sample Name Assignment"] = assigned_by_name[0].get('title', 'N/A')
                
                # Show unique assignee values for debugging
                unique_assignees = list(set([task.get('assignee') for task in all_tasks if task.get('assignee')]))[:10]
                analysis_details["Sample Assignee Values"] = unique_assignees
                
                expected_my_tasks = len(assigned_by_id) + len(assigned_by_email)
                
                if len(my_tasks) == expected_my_tasks:
                    self.log_result("Task Assignment Logic", True, 
                                  "My Tasks count matches expected (ID + Email assignments)", 
                                  analysis_details)
                else:
                    self.log_result("Task Assignment Logic", False, 
                                  f"My Tasks count ({len(my_tasks)}) doesn't match expected ({expected_my_tasks})", 
                                  analysis_details)
                
            else:
                self.log_result("Task Assignment Analysis", False, 
                              f"Failed to get tasks: all_tasks={all_tasks_response.status_code}, my_tasks={my_tasks_response.status_code}")
                
        except Exception as e:
            self.log_result("Task Assignment Analysis", False, f"Exception: {str(e)}")
    
    def investigate_project_tasks(self):
        """Investigate tasks in specific projects that user can see"""
        print("\n=== 🏗️ PROJECT TASKS INVESTIGATION ===")
        
        if not self.current_token:
            self.log_result("Project Tasks Investigation", False, "No current user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.current_token}"}
            
            # Get all projects
            projects_response = self.session.get(f"{API_BASE}/projects", headers=headers)
            
            if projects_response.status_code == 200:
                projects = projects_response.json()
                
                project_details = {
                    "Total Projects": len(projects)
                }
                
                # Investigate first few projects
                for i, project in enumerate(projects[:3]):
                    project_id = project.get('id')
                    project_name = project.get('name', 'Unnamed Project')
                    
                    # Get project tasks using the full-data endpoint
                    project_data_response = self.session.get(f"{API_BASE}/projects/{project_id}/full-data", headers=headers)
                    
                    if project_data_response.status_code == 200:
                        project_data = project_data_response.json()
                        project_tasks = project_data.get('tasks', [])
                        
                        project_details[f"Project {i+1} Name"] = project_name
                        project_details[f"Project {i+1} Tasks"] = len(project_tasks)
                        
                        # Analyze assignees in this project
                        assignees_in_project = []
                        user_tasks_in_project = []
                        
                        for task in project_tasks:
                            assignee = task.get('assignee')
                            if assignee:
                                assignees_in_project.append(assignee)
                                
                                # Check if this task should be in My Tasks
                                if (assignee == self.current_user['id'] or 
                                    assignee == self.current_user['email']):
                                    user_tasks_in_project.append(task.get('title', 'Untitled'))
                        
                        project_details[f"Project {i+1} User Tasks"] = len(user_tasks_in_project)
                        if user_tasks_in_project:
                            project_details[f"Project {i+1} User Task Titles"] = user_tasks_in_project[:3]
                        
                        unique_assignees = list(set(assignees_in_project))[:5]
                        project_details[f"Project {i+1} Assignees"] = unique_assignees
                
                self.log_result("Project Tasks Investigation", True, 
                              "Analyzed project tasks and assignments", 
                              project_details)
                
            else:
                self.log_result("Project Tasks Investigation", False, 
                              f"Failed to get projects: HTTP {projects_response.status_code}")
                
        except Exception as e:
            self.log_result("Project Tasks Investigation", False, f"Exception: {str(e)}")
    
    def test_backend_my_tasks_logic(self):
        """Test the backend logic for My Tasks filtering"""
        print("\n=== 🔧 BACKEND MY TASKS LOGIC TESTING ===")
        
        if not self.current_token or not self.current_user:
            self.log_result("Backend Logic Test", False, "Missing current user data")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.current_token}"}
            
            # Create a test task assigned to current user by ID
            test_task_by_id = {
                "title": "Test Task Assigned by ID",
                "description": "Testing My Tasks functionality - assigned by user ID",
                "assignee": self.current_user['id'],
                "status": "Not Started",
                "priority": "Medium"
            }
            
            create_response = self.session.post(f"{API_BASE}/tasks", json=test_task_by_id, headers=headers)
            
            if create_response.status_code == 200:
                created_task = create_response.json()
                task_id = created_task.get('id')
                
                # Wait a moment and check My Tasks
                import time
                time.sleep(1)
                
                my_tasks_response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
                
                if my_tasks_response.status_code == 200:
                    my_tasks = my_tasks_response.json()
                    
                    # Check if our test task appears
                    test_task_found = any(task.get('id') == task_id for task in my_tasks)
                    
                    logic_details = {
                        "Test Task Created": True,
                        "Test Task ID": task_id,
                        "Test Task Assignee": test_task_by_id['assignee'],
                        "My Tasks Count After Creation": len(my_tasks),
                        "Test Task Found in My Tasks": test_task_found
                    }
                    
                    if test_task_found:
                        self.log_result("Backend Logic Test", True, 
                                      "Test task assigned by ID appears in My Tasks - Logic working!", 
                                      logic_details)
                    else:
                        self.log_result("Backend Logic Test", False, 
                                      "Test task assigned by ID does NOT appear in My Tasks - Logic broken!", 
                                      logic_details)
                    
                    # Clean up test task
                    self.session.delete(f"{API_BASE}/tasks/{task_id}", headers=headers)
                    
                else:
                    self.log_result("Backend Logic Test", False, 
                                  f"Failed to get My Tasks after test: HTTP {my_tasks_response.status_code}")
            else:
                self.log_result("Backend Logic Test", False, 
                              f"Failed to create test task: HTTP {create_response.status_code}")
                
        except Exception as e:
            self.log_result("Backend Logic Test", False, f"Exception: {str(e)}")
    
    def investigate_database_direct_query(self):
        """Simulate direct database query by analyzing all available data"""
        print("\n=== 💾 DATABASE-LEVEL TASK ANALYSIS ===")
        
        if not self.current_token or not self.current_user:
            self.log_result("Database Analysis", False, "Missing current user data")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.current_token}"}
            
            # Get all tasks and analyze them as if querying database directly
            all_tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
            
            if all_tasks_response.status_code == 200:
                all_tasks = all_tasks_response.json()
                
                # Simulate the backend My Tasks query logic
                user_id = self.current_user['id']
                user_email = self.current_user['email']
                
                # Filter tasks as backend would do
                matching_tasks = []
                for task in all_tasks:
                    assignee = task.get('assignee')
                    if assignee == user_id or assignee == user_email:
                        matching_tasks.append(task)
                
                # Analyze all assignee patterns
                assignee_patterns = {}
                for task in all_tasks:
                    assignee = task.get('assignee')
                    if assignee:
                        if assignee in assignee_patterns:
                            assignee_patterns[assignee] += 1
                        else:
                            assignee_patterns[assignee] = 1
                
                # Sort by frequency
                sorted_patterns = sorted(assignee_patterns.items(), key=lambda x: x[1], reverse=True)
                
                db_analysis = {
                    "Total Tasks in Database": len(all_tasks),
                    "Tasks Matching User ID": len([t for t in all_tasks if t.get('assignee') == user_id]),
                    "Tasks Matching User Email": len([t for t in all_tasks if t.get('assignee') == user_email]),
                    "Expected My Tasks Count": len(matching_tasks),
                    "Top 10 Assignee Patterns": dict(sorted_patterns[:10])
                }
                
                # Check if user appears in assignee patterns
                user_in_patterns = False
                for assignee, count in sorted_patterns:
                    if assignee in [user_id, user_email, self.current_user['name']]:
                        user_in_patterns = True
                        db_analysis[f"User Found as '{assignee}'"] = f"{count} tasks"
                
                if not user_in_patterns:
                    db_analysis["User Assignment Status"] = "User NOT found in any task assignments"
                
                if len(matching_tasks) > 0:
                    self.log_result("Database Task Analysis", True, 
                                  f"Found {len(matching_tasks)} tasks that should appear in My Tasks", 
                                  db_analysis)
                else:
                    self.log_result("Database Task Analysis", False, 
                                  "NO tasks found assigned to current user by ID or email", 
                                  db_analysis)
                
            else:
                self.log_result("Database Analysis", False, 
                              f"Failed to get all tasks: HTTP {all_tasks_response.status_code}")
                
        except Exception as e:
            self.log_result("Database Analysis", False, f"Exception: {str(e)}")
    
    def run_comprehensive_investigation(self):
        """Run the complete My Tasks investigation"""
        print("🔍 STARTING COMPREHENSIVE MY TASKS INVESTIGATION")
        print("=" * 60)
        
        # Step 1: Identify current user
        if not self.setup_current_user_session():
            print("\n❌ INVESTIGATION FAILED: Could not identify current user")
            return
        
        # Step 2: Test My Tasks endpoint directly
        self.test_my_tasks_endpoint_direct()
        
        # Step 3: Analyze task assignment patterns
        self.analyze_all_tasks_vs_my_tasks()
        
        # Step 4: Investigate project tasks
        self.investigate_project_tasks()
        
        # Step 5: Test backend logic with new task
        self.test_backend_my_tasks_logic()
        
        # Step 6: Database-level analysis
        self.investigate_database_direct_query()
        
        # Summary
        self.print_investigation_summary()
    
    def print_investigation_summary(self):
        """Print a comprehensive summary of findings"""
        print("\n" + "=" * 60)
        print("🎯 MY TASKS INVESTIGATION SUMMARY")
        print("=" * 60)
        
        failed_tests = [r for r in self.investigation_results if not r['success']]
        passed_tests = [r for r in self.investigation_results if r['success']]
        
        print(f"\n📊 RESULTS OVERVIEW:")
        print(f"   ✅ Passed: {len(passed_tests)}")
        print(f"   ❌ Failed: {len(failed_tests)}")
        
        if failed_tests:
            print(f"\n🚨 CRITICAL ISSUES FOUND:")
            for test in failed_tests:
                print(f"   ❌ {test['test']}: {test['message']}")
        
        print(f"\n👤 CURRENT USER:")
        if self.current_user:
            print(f"   Name: {self.current_user['name']}")
            print(f"   Email: {self.current_user['email']}")
            print(f"   ID: {self.current_user['id']}")
            print(f"   Role: {self.current_user['role']}")
        
        print(f"\n🔧 RECOMMENDED ACTIONS:")
        if any("My Tasks Endpoint Response" in test['test'] and not test['success'] for test in self.investigation_results):
            print("   1. ❗ My Tasks endpoint returns empty - check task assignment patterns")
            print("   2. 🔍 Verify tasks are assigned using user ID or email, not display name")
            print("   3. 🛠️ Check backend /api/my-tasks filtering logic")
        
        if any("Backend Logic Test" in test['test'] and not test['success'] for test in self.investigation_results):
            print("   4. 🚨 Backend My Tasks filtering logic is broken - needs immediate fix")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    investigator = MyTasksInvestigator()
    investigator.run_comprehensive_investigation()