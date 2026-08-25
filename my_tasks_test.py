#!/usr/bin/env python3
"""
My Tasks Filtering Issue Investigation
Testing the assignee matching logic in /api/my-tasks endpoint
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
        self.user_token = None
        self.current_user = None
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
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {json.dumps(details, indent=2)}")
    
    def login_as_team_member(self):
        """Login as a team member to test My Tasks functionality"""
        print("\n=== Logging in as Team Member ===")
        
        # Try common team member credentials
        credentials_to_try = [
            {"email": "testuser@millionaze.com", "password": "testpass123"},
            {"email": "team@millionaze.com", "password": "team123"},
            {"email": "member@millionaze.com", "password": "member123"},
            {"email": "admin@millionaze.com", "password": "admin123"}  # Fallback to admin
        ]
        
        for creds in credentials_to_try:
            try:
                response = self.session.post(f"{API_BASE}/auth/login", json=creds)
                if response.status_code == 200:
                    data = response.json()
                    self.user_token = data['access_token']
                    self.current_user = data['user']
                    self.log_result("Team Member Login", True, f"Logged in as: {self.current_user['name']} ({self.current_user['email']}) - Role: {self.current_user['role']}")
                    return True
            except Exception as e:
                continue
        
        self.log_result("Team Member Login", False, "Failed to login with any credentials")
        return False
    
    def test_current_user_identity(self):
        """Test 1: Check what user information is returned for current session"""
        print("\n=== Testing Current User Identity ===")
        
        if not self.user_token:
            self.log_result("Current User Identity", False, "No user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                self.log_result("Current User Identity", True, f"User ID: {user_data.get('id')}, Email: {user_data.get('email')}, Name: {user_data.get('name')}")
                
                # Store current user for comparison
                self.current_user = user_data
                
                print(f"   Current User Details:")
                print(f"   - ID: {user_data.get('id')}")
                print(f"   - Name: {user_data.get('name')}")
                print(f"   - Email: {user_data.get('email')}")
                print(f"   - Role: {user_data.get('role')}")
                
            else:
                self.log_result("Current User Identity", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Current User Identity", False, f"Exception: {str(e)}")
    
    def test_my_tasks_endpoint(self):
        """Test 2: Check GET /api/my-tasks to see what tasks it returns"""
        print("\n=== Testing My Tasks Endpoint ===")
        
        if not self.user_token:
            self.log_result("My Tasks Endpoint", False, "No user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
            
            if response.status_code == 200:
                my_tasks = response.json()
                self.log_result("My Tasks Endpoint", True, f"Retrieved {len(my_tasks)} tasks from /api/my-tasks")
                
                print(f"   My Tasks Count: {len(my_tasks)}")
                
                if len(my_tasks) > 0:
                    print(f"   Sample My Tasks:")
                    for i, task in enumerate(my_tasks[:3]):  # Show first 3 tasks
                        print(f"   - Task {i+1}: {task.get('title')} (Assignee: {task.get('assignee')}, Status: {task.get('status')})")
                else:
                    print(f"   ⚠️  No tasks returned by /api/my-tasks")
                
                return my_tasks
                
            else:
                self.log_result("My Tasks Endpoint", False, f"HTTP {response.status_code}", response.text)
                return []
                
        except Exception as e:
            self.log_result("My Tasks Endpoint", False, f"Exception: {str(e)}")
            return []
    
    def test_all_tasks_endpoint(self):
        """Test 3: Check GET /api/tasks to see all tasks and their assignee fields"""
        print("\n=== Testing All Tasks Endpoint ===")
        
        if not self.user_token:
            self.log_result("All Tasks Endpoint", False, "No user token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/tasks", headers=headers)
            
            if response.status_code == 200:
                all_tasks = response.json()
                self.log_result("All Tasks Endpoint", True, f"Retrieved {len(all_tasks)} tasks from /api/tasks")
                
                print(f"   All Tasks Count: {len(all_tasks)}")
                
                # Analyze assignee fields
                assignee_analysis = {}
                tasks_with_assignee = []
                
                for task in all_tasks:
                    assignee = task.get('assignee')
                    if assignee:
                        tasks_with_assignee.append(task)
                        if assignee not in assignee_analysis:
                            assignee_analysis[assignee] = 0
                        assignee_analysis[assignee] += 1
                
                print(f"   Tasks with Assignee: {len(tasks_with_assignee)}")
                print(f"   Assignee Distribution:")
                for assignee, count in assignee_analysis.items():
                    print(f"   - {assignee}: {count} tasks")
                
                # Show sample tasks with assignees
                if tasks_with_assignee:
                    print(f"   Sample Tasks with Assignees:")
                    for i, task in enumerate(tasks_with_assignee[:5]):
                        print(f"   - {task.get('title')} -> Assignee: '{task.get('assignee')}' (Status: {task.get('status')})")
                
                return all_tasks, assignee_analysis
                
            else:
                self.log_result("All Tasks Endpoint", False, f"HTTP {response.status_code}", response.text)
                return [], {}
                
        except Exception as e:
            self.log_result("All Tasks Endpoint", False, f"Exception: {str(e)}")
            return [], {}
    
    def test_assignee_matching_logic(self, all_tasks, assignee_analysis):
        """Test 4: Check if tasks are assigned by email or ID and if matching logic works"""
        print("\n=== Testing Assignee Matching Logic ===")
        
        if not self.current_user:
            self.log_result("Assignee Matching Logic", False, "No current user data available")
            return
        
        current_user_id = self.current_user.get('id')
        current_user_email = self.current_user.get('email')
        current_user_name = self.current_user.get('name')
        
        print(f"   Looking for tasks assigned to:")
        print(f"   - User ID: {current_user_id}")
        print(f"   - User Email: {current_user_email}")
        print(f"   - User Name: {current_user_name}")
        
        # Check different matching strategies
        matches_by_id = []
        matches_by_email = []
        matches_by_name = []
        
        for task in all_tasks:
            assignee = task.get('assignee')
            if assignee:
                if assignee == current_user_id:
                    matches_by_id.append(task)
                if assignee == current_user_email:
                    matches_by_email.append(task)
                if assignee == current_user_name:
                    matches_by_name.append(task)
        
        print(f"   Matching Results:")
        print(f"   - Tasks assigned by ID ({current_user_id}): {len(matches_by_id)}")
        print(f"   - Tasks assigned by Email ({current_user_email}): {len(matches_by_email)}")
        print(f"   - Tasks assigned by Name ({current_user_name}): {len(matches_by_name)}")
        
        total_matches = len(matches_by_id) + len(matches_by_email) + len(matches_by_name)
        
        if total_matches > 0:
            self.log_result("Assignee Matching Logic", True, f"Found {total_matches} tasks that should match current user")
            
            # Show sample matching tasks
            all_matches = matches_by_id + matches_by_email + matches_by_name
            print(f"   Sample Matching Tasks:")
            for i, task in enumerate(all_matches[:3]):
                print(f"   - {task.get('title')} -> Assignee: '{task.get('assignee')}'")
        else:
            self.log_result("Assignee Matching Logic", False, "No tasks found that should match current user")
            
            # Show what assignees exist vs current user
            print(f"   Available Assignees: {list(assignee_analysis.keys())}")
            print(f"   Current User Identifiers: ID='{current_user_id}', Email='{current_user_email}', Name='{current_user_name}'")
        
        return total_matches
    
    def test_task_visibility_comparison(self, my_tasks, all_tasks):
        """Test 5: Compare tasks returned by /api/my-tasks vs /api/tasks"""
        print("\n=== Testing Task Visibility Comparison ===")
        
        my_task_ids = {task.get('id') for task in my_tasks}
        all_task_ids = {task.get('id') for task in all_tasks}
        
        print(f"   My Tasks IDs: {len(my_task_ids)} tasks")
        print(f"   All Tasks IDs: {len(all_task_ids)} tasks")
        
        # Check if my tasks are subset of all tasks
        missing_from_all = my_task_ids - all_task_ids
        if missing_from_all:
            self.log_result("Task Visibility Consistency", False, f"My Tasks contains {len(missing_from_all)} tasks not in All Tasks")
        else:
            self.log_result("Task Visibility Consistency", True, "All My Tasks are present in All Tasks")
        
        # Check overlap
        overlap = my_task_ids & all_task_ids
        print(f"   Overlap: {len(overlap)} tasks")
        
        # If we have tasks in all_tasks but none in my_tasks, that's the issue
        if len(all_tasks) > 0 and len(my_tasks) == 0:
            self.log_result("My Tasks Filtering Issue", False, f"All Tasks has {len(all_tasks)} tasks but My Tasks returns 0 - filtering logic issue")
        elif len(my_tasks) > 0:
            self.log_result("My Tasks Filtering Issue", True, f"My Tasks returns {len(my_tasks)} tasks - filtering working")
        else:
            self.log_result("My Tasks Filtering Issue", True, "Both endpoints return 0 tasks - no data issue")
    
    def investigate_backend_my_tasks_logic(self):
        """Investigate the backend logic for my-tasks endpoint"""
        print("\n=== Investigating Backend My-Tasks Logic ===")
        
        if not self.current_user:
            self.log_result("Backend Logic Investigation", False, "No current user data")
            return
        
        # Based on the backend code, the my-tasks endpoint should filter by:
        # assignee == current_user.email OR assignee == current_user.id
        
        current_user_id = self.current_user.get('id')
        current_user_email = self.current_user.get('email')
        
        print(f"   Backend should match tasks where:")
        print(f"   - assignee == '{current_user_email}' (email)")
        print(f"   - assignee == '{current_user_id}' (ID)")
        
        # Test the endpoint with debug info
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
            
            if response.status_code == 200:
                my_tasks = response.json()
                
                # Check if any tasks have assignee matching our criteria
                matching_tasks = []
                for task in my_tasks:
                    assignee = task.get('assignee')
                    if assignee == current_user_email or assignee == current_user_id:
                        matching_tasks.append(task)
                
                if len(matching_tasks) == len(my_tasks):
                    self.log_result("Backend Logic Verification", True, f"All {len(my_tasks)} returned tasks match expected criteria")
                else:
                    self.log_result("Backend Logic Verification", False, f"Only {len(matching_tasks)}/{len(my_tasks)} tasks match expected criteria")
                    
            else:
                self.log_result("Backend Logic Verification", False, f"HTTP {response.status_code}")
                
        except Exception as e:
            self.log_result("Backend Logic Verification", False, f"Exception: {str(e)}")
    
    def run_investigation(self):
        """Run the complete My Tasks investigation"""
        print("🔍 MY TASKS FILTERING ISSUE INVESTIGATION")
        print("=" * 50)
        
        # Step 1: Login
        if not self.login_as_team_member():
            print("❌ Cannot proceed without login")
            return
        
        # Step 2: Test current user identity
        self.test_current_user_identity()
        
        # Step 3: Test my-tasks endpoint
        my_tasks = self.test_my_tasks_endpoint()
        
        # Step 4: Test all tasks endpoint
        all_tasks, assignee_analysis = self.test_all_tasks_endpoint()
        
        # Step 5: Test assignee matching logic
        expected_matches = self.test_assignee_matching_logic(all_tasks, assignee_analysis)
        
        # Step 6: Compare visibility
        self.test_task_visibility_comparison(my_tasks, all_tasks)
        
        # Step 7: Investigate backend logic
        self.investigate_backend_my_tasks_logic()
        
        # Summary
        print("\n" + "=" * 50)
        print("🎯 INVESTIGATION SUMMARY")
        print("=" * 50)
        
        passed_tests = sum(1 for result in self.test_results if result['success'])
        total_tests = len(self.test_results)
        
        print(f"Tests Passed: {passed_tests}/{total_tests}")
        
        # Key findings
        print(f"\nKey Findings:")
        print(f"- Current User: {self.current_user.get('name') if self.current_user else 'Unknown'} ({self.current_user.get('email') if self.current_user else 'Unknown'})")
        print(f"- My Tasks Count: {len(my_tasks)}")
        print(f"- All Tasks Count: {len(all_tasks)}")
        print(f"- Expected Matches: {expected_matches}")
        
        if len(all_tasks) > 0 and len(my_tasks) == 0 and expected_matches > 0:
            print(f"\n🚨 ISSUE CONFIRMED: My Tasks endpoint is not returning tasks that should be assigned to current user")
            print(f"   - There are {expected_matches} tasks that should match the current user")
            print(f"   - But /api/my-tasks returns 0 tasks")
            print(f"   - This indicates a problem with the assignee matching logic in the backend")
        elif len(my_tasks) == 0 and expected_matches == 0:
            print(f"\n✅ NO ISSUE: No tasks are assigned to current user, so empty My Tasks is correct")
        else:
            print(f"\n✅ WORKING: My Tasks endpoint is returning expected results")

if __name__ == "__main__":
    investigator = MyTasksInvestigator()
    investigator.run_investigation()