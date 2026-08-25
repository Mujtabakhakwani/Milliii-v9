#!/usr/bin/env python3
"""
Test My Tasks functionality with different users to identify the specific user having issues
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class MultiUserMyTasksTester:
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
    
    def get_all_users(self):
        """Get all users in the system to test with"""
        print("\n=== 👥 GETTING ALL USERS FOR TESTING ===")
        
        # Login as admin first to get user list
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                admin_token = data['access_token']
                
                # Get all users
                headers = {"Authorization": f"Bearer {admin_token}"}
                users_response = self.session.get(f"{API_BASE}/users", headers=headers)
                
                if users_response.status_code == 200:
                    users = users_response.json()
                    
                    user_summary = {
                        "Total Users": len(users),
                        "User List": []
                    }
                    
                    for user in users:
                        user_info = f"{user.get('name', 'N/A')} ({user.get('email', 'N/A')}) - {user.get('role', 'N/A')}"
                        user_summary["User List"].append(user_info)
                    
                    self.log_result("Get All Users", True, f"Found {len(users)} users in system", user_summary)
                    return users
                else:
                    self.log_result("Get All Users", False, f"Failed to get users: HTTP {users_response.status_code}")
                    return []
            else:
                self.log_result("Admin Login for User List", False, f"Failed to login as admin: HTTP {response.status_code}")
                return []
                
        except Exception as e:
            self.log_result("Get All Users", False, f"Exception: {str(e)}")
            return []
    
    def test_user_my_tasks(self, user_email, password="changeme123"):
        """Test My Tasks functionality for a specific user"""
        print(f"\n=== 🧪 TESTING MY TASKS FOR {user_email} ===")
        
        # Try to login as this user
        credentials = {
            "email": user_email,
            "password": password
        }
        
        # Try multiple common passwords
        passwords_to_try = [password, "admin123", "testpass123", "password123", "changeme123"]
        
        user_token = None
        current_user = None
        
        for pwd in passwords_to_try:
            try:
                test_creds = {"email": user_email, "password": pwd}
                response = self.session.post(f"{API_BASE}/auth/login", json=test_creds)
                if response.status_code == 200:
                    data = response.json()
                    user_token = data['access_token']
                    current_user = data['user']
                    break
            except:
                continue
        
        if not user_token:
            self.log_result(f"Login {user_email}", False, "Could not login with any common password")
            return
        
        # Test My Tasks endpoint
        try:
            headers = {"Authorization": f"Bearer {user_token}"}
            my_tasks_response = self.session.get(f"{API_BASE}/my-tasks", headers=headers)
            
            if my_tasks_response.status_code == 200:
                my_tasks = my_tasks_response.json()
                
                # Get all tasks to compare
                all_tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                all_tasks = all_tasks_response.json() if all_tasks_response.status_code == 200 else []
                
                # Analyze assignment patterns for this user
                user_id = current_user['id']
                user_email_addr = current_user['email']
                user_name = current_user['name']
                
                assigned_by_id = [t for t in all_tasks if t.get('assignee') == user_id]
                assigned_by_email = [t for t in all_tasks if t.get('assignee') == user_email_addr]
                assigned_by_name = [t for t in all_tasks if t.get('assignee') == user_name]
                
                expected_count = len(assigned_by_id) + len(assigned_by_email)
                actual_count = len(my_tasks)
                
                test_details = {
                    "User ID": user_id,
                    "User Email": user_email_addr,
                    "User Name": user_name,
                    "My Tasks Count": actual_count,
                    "Tasks Assigned by ID": len(assigned_by_id),
                    "Tasks Assigned by Email": len(assigned_by_email),
                    "Tasks Assigned by Name": len(assigned_by_name),
                    "Expected My Tasks": expected_count,
                    "Total Tasks in System": len(all_tasks)
                }
                
                if actual_count == expected_count:
                    self.log_result(f"My Tasks for {user_email}", True, 
                                  f"Working correctly: {actual_count} tasks", test_details)
                elif actual_count == 0 and expected_count > 0:
                    self.log_result(f"My Tasks for {user_email}", False, 
                                  f"BROKEN: Expected {expected_count} tasks, got 0", test_details)
                elif actual_count == 0 and expected_count == 0:
                    self.log_result(f"My Tasks for {user_email}", True, 
                                  "Working correctly: No tasks assigned to this user", test_details)
                else:
                    self.log_result(f"My Tasks for {user_email}", False, 
                                  f"Mismatch: Expected {expected_count}, got {actual_count}", test_details)
                
                # If this user has issues, show sample assignee values
                if actual_count == 0 and expected_count > 0:
                    sample_assignees = list(set([t.get('assignee') for t in all_tasks if t.get('assignee')]))[:10]
                    print(f"   🔍 Sample assignee values in system: {sample_assignees}")
                
            else:
                self.log_result(f"My Tasks API for {user_email}", False, 
                              f"HTTP {my_tasks_response.status_code}")
                
        except Exception as e:
            self.log_result(f"My Tasks Test for {user_email}", False, f"Exception: {str(e)}")
    
    def test_specific_problematic_scenarios(self):
        """Test specific scenarios that might cause My Tasks to be empty"""
        print("\n=== 🔍 TESTING PROBLEMATIC SCENARIOS ===")
        
        # Login as admin to create test scenarios
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
                
                # Get a non-admin user to test with
                users_response = self.session.get(f"{API_BASE}/users", headers=headers)
                if users_response.status_code == 200:
                    users = users_response.json()
                    test_user = None
                    
                    # Find a non-admin user
                    for user in users:
                        if user.get('role') != 'admin' and user.get('email') != 'admin@millionaze.com':
                            test_user = user
                            break
                    
                    if test_user:
                        # Create tasks with different assignment patterns
                        test_scenarios = [
                            {
                                "title": "Task Assigned by User ID",
                                "assignee": test_user['id'],
                                "description": "Should appear in My Tasks"
                            },
                            {
                                "title": "Task Assigned by Email",
                                "assignee": test_user['email'],
                                "description": "Should appear in My Tasks"
                            },
                            {
                                "title": "Task Assigned by Name",
                                "assignee": test_user['name'],
                                "description": "Should NOT appear in My Tasks (backend only matches ID/email)"
                            }
                        ]
                        
                        created_task_ids = []
                        
                        for scenario in test_scenarios:
                            task_response = self.session.post(f"{API_BASE}/tasks", json=scenario, headers=headers)
                            if task_response.status_code == 200:
                                task_data = task_response.json()
                                created_task_ids.append(task_data['id'])
                        
                        # Now test My Tasks for this user
                        self.test_user_my_tasks(test_user['email'])
                        
                        # Clean up test tasks
                        for task_id in created_task_ids:
                            self.session.delete(f"{API_BASE}/tasks/{task_id}", headers=headers)
                        
                        scenario_details = {
                            "Test User": f"{test_user['name']} ({test_user['email']})",
                            "Test Tasks Created": len(created_task_ids),
                            "Assignment Patterns Tested": ["ID", "Email", "Name"]
                        }
                        
                        self.log_result("Problematic Scenarios Test", True, 
                                      "Created and tested different assignment patterns", scenario_details)
                    else:
                        self.log_result("Problematic Scenarios Test", False, "No non-admin user found for testing")
                else:
                    self.log_result("Problematic Scenarios Test", False, "Could not get users list")
            else:
                self.log_result("Problematic Scenarios Test", False, "Could not login as admin")
                
        except Exception as e:
            self.log_result("Problematic Scenarios Test", False, f"Exception: {str(e)}")
    
    def run_comprehensive_multi_user_test(self):
        """Run comprehensive My Tasks testing across multiple users"""
        print("🔍 STARTING MULTI-USER MY TASKS TESTING")
        print("=" * 60)
        
        # Get all users
        users = self.get_all_users()
        
        if not users:
            print("❌ Could not get user list, aborting test")
            return
        
        # Test My Tasks for each user (limit to first 10 to avoid spam)
        test_users = users[:10]
        
        for user in test_users:
            user_email = user.get('email')
            if user_email:
                self.test_user_my_tasks(user_email)
        
        # Test specific problematic scenarios
        self.test_specific_problematic_scenarios()
        
        # Print summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 60)
        print("🎯 MULTI-USER MY TASKS TEST SUMMARY")
        print("=" * 60)
        
        failed_tests = [r for r in self.test_results if not r['success']]
        passed_tests = [r for r in self.test_results if r['success']]
        
        print(f"\n📊 RESULTS OVERVIEW:")
        print(f"   ✅ Passed: {len(passed_tests)}")
        print(f"   ❌ Failed: {len(failed_tests)}")
        
        # Identify users with My Tasks issues
        my_tasks_failures = [r for r in failed_tests if "My Tasks for" in r['test']]
        
        if my_tasks_failures:
            print(f"\n🚨 USERS WITH MY TASKS ISSUES:")
            for test in my_tasks_failures:
                user_email = test['test'].replace("My Tasks for ", "")
                print(f"   ❌ {user_email}: {test['message']}")
                if test.get('details'):
                    details = test['details']
                    print(f"      Expected: {details.get('Expected My Tasks', 'N/A')} tasks")
                    print(f"      Actual: {details.get('My Tasks Count', 'N/A')} tasks")
        else:
            print(f"\n✅ ALL USERS' MY TASKS WORKING CORRECTLY")
        
        print(f"\n🔧 DIAGNOSIS:")
        if my_tasks_failures:
            print("   • Some users have My Tasks functionality broken")
            print("   • Issue appears to be user-specific, not system-wide")
            print("   • Check task assignment patterns for affected users")
            print("   • Verify tasks are assigned by user ID or email, not display name")
        else:
            print("   • My Tasks functionality appears to be working correctly for all tested users")
            print("   • If user reports issues, check their specific session and task assignments")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = MultiUserMyTasksTester()
    tester.run_comprehensive_multi_user_test()