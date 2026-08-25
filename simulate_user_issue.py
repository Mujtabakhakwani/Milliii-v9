#!/usr/bin/env python3
"""
Simulate the exact user issue: Tasks visible in Project View but not in My Tasks
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class UserIssueSimulator:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅" if success else "❌"
        print(f"{status} {test_name}: {message}")
        if details and isinstance(details, dict):
            for key, value in details.items():
                print(f"   {key}: {value}")
        elif details:
            print(f"   Details: {details}")
    
    def create_test_scenario(self):
        """Create a scenario where tasks are visible in Project View but not My Tasks"""
        print("\n=== 🎭 CREATING TEST SCENARIO ===")
        
        # Login as admin to set up the scenario
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                admin_token = data['access_token']
                headers = {"Authorization": f"Bearer {admin_token}"}
                
                # Create a test project
                project_data = {
                    "name": "My Tasks Issue Test Project",
                    "company_name": "Test Company",
                    "business_name": "Test Business",
                    "client_name": "Test Client",
                    "client_email": "testclient@example.com",
                    "status": "Getting Started",
                    "team_members": []
                }
                
                project_response = self.session.post(f"{API_BASE}/projects", json=project_data, headers=headers)
                
                if project_response.status_code == 200:
                    project = project_response.json()
                    project_id = project['id']
                    
                    # Create tasks with different assignment patterns that could cause the issue
                    test_tasks = [
                        {
                            "project_id": project_id,
                            "title": "Task Assigned by Display Name Only",
                            "description": "This task is assigned by display name, should NOT appear in My Tasks",
                            "assignee": "Admin User",  # Display name, not ID or email
                            "status": "Not Started",
                            "priority": "Medium"
                        },
                        {
                            "project_id": project_id,
                            "title": "Task Assigned by Partial Name",
                            "description": "This task is assigned by partial name",
                            "assignee": "Admin",  # Partial name
                            "status": "In Progress",
                            "priority": "High"
                        },
                        {
                            "project_id": project_id,
                            "title": "Task Assigned by Wrong Case Email",
                            "description": "This task is assigned by wrong case email",
                            "assignee": "ADMIN@MILLIONAZE.COM",  # Wrong case
                            "status": "Under Review",
                            "priority": "Low"
                        },
                        {
                            "project_id": project_id,
                            "title": "Task Assigned Correctly by Email",
                            "description": "This task should appear in My Tasks",
                            "assignee": "admin@millionaze.com",  # Correct email
                            "status": "Not Started",
                            "priority": "Medium"
                        },
                        {
                            "project_id": project_id,
                            "title": "Task Assigned Correctly by ID",
                            "description": "This task should appear in My Tasks",
                            "assignee": "c4f6840e-6e35-4d47-a896-aebb477e324e",  # Admin user ID
                            "status": "In Progress",
                            "priority": "High"
                        }
                    ]
                    
                    created_task_ids = []
                    
                    for task_data in test_tasks:
                        task_response = self.session.post(f"{API_BASE}/tasks", json=task_data, headers=headers)
                        if task_response.status_code == 200:
                            task = task_response.json()
                            created_task_ids.append(task['id'])
                    
                    scenario_details = {
                        "Test Project ID": project_id,
                        "Test Project Name": project_data['name'],
                        "Tasks Created": len(created_task_ids),
                        "Assignment Patterns": ["Display Name", "Partial Name", "Wrong Case Email", "Correct Email", "Correct ID"]
                    }
                    
                    self.log_result("Test Scenario Creation", True, 
                                  f"Created test project with {len(created_task_ids)} tasks", scenario_details)
                    
                    return project_id, created_task_ids
                else:
                    self.log_result("Test Scenario Creation", False, 
                                  f"Failed to create project: HTTP {project_response.status_code}")
                    return None, []
            else:
                self.log_result("Test Scenario Creation", False, 
                              f"Failed to login as admin: HTTP {response.status_code}")
                return None, []
                
        except Exception as e:
            self.log_result("Test Scenario Creation", False, f"Exception: {str(e)}")
            return None, []
    
    def test_project_view_vs_my_tasks(self, project_id):
        """Test the difference between Project View and My Tasks"""
        print("\n=== 🔍 TESTING PROJECT VIEW VS MY TASKS ===")
        
        # Login as admin (the user experiencing the issue)
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                user_token = data['access_token']
                current_user = data['user']
                headers = {"Authorization": f"Bearer {user_token}"}
                
                # Get tasks from Project View (using full-data endpoint)
                project_response = self.session.get(f"{API_BASE}/projects/{project_id}/full-data", headers=headers)
                
                # Get tasks from My Tasks
                my_tasks_response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
                
                if project_response.status_code == 200 and my_tasks_response.status_code == 200:
                    project_data = project_response.json()
                    project_tasks = project_data.get('tasks', [])
                    my_tasks = my_tasks_response.json()
                    
                    # Filter project tasks to only those assigned to current user (by any method)
                    user_id = current_user['id']
                    user_email = current_user['email']
                    user_name = current_user['name']
                    
                    # Tasks visible in project view that are "assigned" to user
                    project_view_user_tasks = []
                    for task in project_tasks:
                        assignee = task.get('assignee', '')
                        if assignee in [user_id, user_email, user_name, user_name.upper(), user_email.upper()]:
                            project_view_user_tasks.append(task)
                    
                    # Tasks that should appear in My Tasks (only ID and email matches)
                    expected_my_tasks = []
                    for task in project_tasks:
                        assignee = task.get('assignee', '')
                        if assignee == user_id or assignee == user_email:
                            expected_my_tasks.append(task)
                    
                    # Find the discrepancy
                    project_view_count = len(project_view_user_tasks)
                    my_tasks_count = len([t for t in my_tasks if t.get('project_id') == project_id])
                    expected_count = len(expected_my_tasks)
                    
                    comparison_details = {
                        "Project View User Tasks": project_view_count,
                        "My Tasks from This Project": my_tasks_count,
                        "Expected My Tasks": expected_count,
                        "Current User ID": user_id,
                        "Current User Email": user_email,
                        "Current User Name": user_name
                    }
                    
                    # Show assignment patterns
                    assignment_patterns = {}
                    for task in project_view_user_tasks:
                        assignee = task.get('assignee', '')
                        pattern_key = f"Assigned as '{assignee}'"
                        if pattern_key not in assignment_patterns:
                            assignment_patterns[pattern_key] = []
                        assignment_patterns[pattern_key].append(task.get('title', 'Untitled'))
                    
                    comparison_details.update(assignment_patterns)
                    
                    if project_view_count > my_tasks_count:
                        self.log_result("Project View vs My Tasks Discrepancy", False, 
                                      f"ISSUE REPRODUCED: {project_view_count} tasks in Project View, {my_tasks_count} in My Tasks", 
                                      comparison_details)
                        
                        # Show which tasks are missing from My Tasks
                        missing_tasks = []
                        for task in project_view_user_tasks:
                            task_id = task.get('id')
                            if not any(mt.get('id') == task_id for mt in my_tasks):
                                missing_info = {
                                    "Title": task.get('title', 'Untitled'),
                                    "Assignee": task.get('assignee', 'None'),
                                    "Status": task.get('status', 'Unknown')
                                }
                                missing_tasks.append(missing_info)
                        
                        if missing_tasks:
                            print(f"\n   🚨 TASKS MISSING FROM MY TASKS:")
                            for i, task in enumerate(missing_tasks):
                                print(f"      {i+1}. {task['Title']} (assigned to: '{task['Assignee']}')")
                    else:
                        self.log_result("Project View vs My Tasks Comparison", True, 
                                      "No discrepancy found - counts match", comparison_details)
                
                else:
                    self.log_result("Project View vs My Tasks Test", False, 
                                  f"API calls failed: project={project_response.status_code}, my_tasks={my_tasks_response.status_code}")
            else:
                self.log_result("User Login for Comparison", False, 
                              f"Failed to login: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_result("Project View vs My Tasks Test", False, f"Exception: {str(e)}")
    
    def analyze_backend_filtering_logic(self):
        """Analyze the backend My Tasks filtering logic"""
        print("\n=== 🔧 ANALYZING BACKEND FILTERING LOGIC ===")
        
        # Login as admin
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                user_token = data['access_token']
                current_user = data['user']
                headers = {"Authorization": f"Bearer {user_token}"}
                
                # Get all tasks
                all_tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                my_tasks_response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
                
                if all_tasks_response.status_code == 200 and my_tasks_response.status_code == 200:
                    all_tasks = all_tasks_response.json()
                    my_tasks = my_tasks_response.json()
                    
                    user_id = current_user['id']
                    user_email = current_user['email']
                    user_name = current_user['name']
                    
                    # Simulate backend filtering logic
                    backend_filtered = []
                    for task in all_tasks:
                        assignee = task.get('assignee')
                        # Backend logic: assignee == user.email OR assignee == user.id
                        if assignee == user_email or assignee == user_id:
                            backend_filtered.append(task)
                    
                    # Count different assignment patterns
                    assigned_by_id = len([t for t in all_tasks if t.get('assignee') == user_id])
                    assigned_by_email = len([t for t in all_tasks if t.get('assignee') == user_email])
                    assigned_by_name = len([t for t in all_tasks if t.get('assignee') == user_name])
                    assigned_by_name_variations = len([t for t in all_tasks if t.get('assignee', '').lower() == user_name.lower() and t.get('assignee') != user_name])
                    
                    logic_analysis = {
                        "Total Tasks in System": len(all_tasks),
                        "My Tasks API Returns": len(my_tasks),
                        "Backend Logic Should Return": len(backend_filtered),
                        "Tasks Assigned by ID": assigned_by_id,
                        "Tasks Assigned by Email": assigned_by_email,
                        "Tasks Assigned by Name (exact)": assigned_by_name,
                        "Tasks Assigned by Name (case variations)": assigned_by_name_variations,
                        "Backend Matches API": len(my_tasks) == len(backend_filtered)
                    }
                    
                    if len(my_tasks) == len(backend_filtered):
                        self.log_result("Backend Filtering Logic", True, 
                                      "My Tasks API matches expected backend logic", logic_analysis)
                    else:
                        self.log_result("Backend Filtering Logic", False, 
                                      f"My Tasks API ({len(my_tasks)}) doesn't match backend logic ({len(backend_filtered)})", 
                                      logic_analysis)
                    
                    # Show the root cause
                    if assigned_by_name > 0 or assigned_by_name_variations > 0:
                        root_cause = {
                            "Root Cause": "Tasks assigned by display name don't appear in My Tasks",
                            "Tasks Assigned by Name": assigned_by_name + assigned_by_name_variations,
                            "Backend Logic": "Only matches assignee == user.email OR assignee == user.id",
                            "Solution": "Tasks must be assigned using user ID or email, not display name"
                        }
                        
                        self.log_result("Root Cause Analysis", True, 
                                      "Identified why tasks don't appear in My Tasks", root_cause)
                
                else:
                    self.log_result("Backend Logic Analysis", False, 
                                  f"Failed to get tasks: all={all_tasks_response.status_code}, my={my_tasks_response.status_code}")
            else:
                self.log_result("Backend Logic Analysis", False, 
                              f"Failed to login: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_result("Backend Logic Analysis", False, f"Exception: {str(e)}")
    
    def cleanup_test_data(self, project_id, task_ids):
        """Clean up test data"""
        print("\n=== 🧹 CLEANING UP TEST DATA ===")
        
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                admin_token = data['access_token']
                headers = {"Authorization": f"Bearer {admin_token}"}
                
                # Delete test tasks
                deleted_tasks = 0
                for task_id in task_ids:
                    delete_response = self.session.delete(f"{API_BASE}/tasks/{task_id}", headers=headers)
                    if delete_response.status_code == 200:
                        deleted_tasks += 1
                
                # Delete test project
                project_deleted = False
                if project_id:
                    project_delete_response = self.session.delete(f"{API_BASE}/projects/{project_id}", headers=headers)
                    project_deleted = project_delete_response.status_code == 200
                
                cleanup_details = {
                    "Tasks Deleted": deleted_tasks,
                    "Project Deleted": project_deleted
                }
                
                self.log_result("Test Data Cleanup", True, 
                              f"Cleaned up {deleted_tasks} tasks and project", cleanup_details)
            else:
                self.log_result("Test Data Cleanup", False, "Could not login for cleanup")
                
        except Exception as e:
            self.log_result("Test Data Cleanup", False, f"Exception: {str(e)}")
    
    def run_user_issue_simulation(self):
        """Run the complete user issue simulation"""
        print("🎭 SIMULATING USER ISSUE: Tasks in Project View but not My Tasks")
        print("=" * 70)
        
        # Create test scenario
        project_id, task_ids = self.create_test_scenario()
        
        if project_id:
            # Test the discrepancy
            self.test_project_view_vs_my_tasks(project_id)
            
            # Analyze backend logic
            self.analyze_backend_filtering_logic()
            
            # Clean up
            self.cleanup_test_data(project_id, task_ids)
        
        # Print summary
        self.print_simulation_summary()
    
    def print_simulation_summary(self):
        """Print simulation summary"""
        print("\n" + "=" * 70)
        print("🎯 USER ISSUE SIMULATION SUMMARY")
        print("=" * 70)
        
        failed_tests = [r for r in self.test_results if not r['success']]
        passed_tests = [r for r in self.test_results if r['success']]
        
        print(f"\n📊 RESULTS OVERVIEW:")
        print(f"   ✅ Passed: {len(passed_tests)}")
        print(f"   ❌ Failed: {len(failed_tests)}")
        
        # Check if we reproduced the issue
        discrepancy_test = next((r for r in self.test_results if "Discrepancy" in r['test']), None)
        
        if discrepancy_test and not discrepancy_test['success']:
            print(f"\n🎯 ISSUE SUCCESSFULLY REPRODUCED!")
            print(f"   Problem: {discrepancy_test['message']}")
            print(f"\n🔍 ROOT CAUSE:")
            print(f"   • Tasks assigned by display name appear in Project View")
            print(f"   • But My Tasks API only matches by user ID or email")
            print(f"   • This creates the discrepancy user is experiencing")
            print(f"\n💡 SOLUTION:")
            print(f"   • Ensure all task assignments use user ID or email")
            print(f"   • Update frontend to assign tasks by ID/email, not display name")
            print(f"   • Consider updating backend to also match by display name (if desired)")
        else:
            print(f"\n✅ NO DISCREPANCY FOUND")
            print(f"   • My Tasks functionality appears to be working correctly")
            print(f"   • User issue may be session-specific or resolved")
        
        print("\n" + "=" * 70)

if __name__ == "__main__":
    simulator = UserIssueSimulator()
    simulator.run_user_issue_simulation()