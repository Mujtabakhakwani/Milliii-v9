#!/usr/bin/env python3
"""
Recurring Task UPDATE Functionality Testing
Focus: Testing the PUT /api/recurring-tasks/{task_id} endpoint fix
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class RecurringTaskUpdateTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
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
        if details:
            print(f"    Details: {details}")
        return success

    def login_admin(self):
        """Login as admin user"""
        try:
            login_data = {
                "email": "admin@millionaze.com",
                "password": "admin123"
            }
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('access_token')
                return self.log_result("Admin Login", True, "Successfully logged in as admin")
            else:
                return self.log_result("Admin Login", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            return self.log_result("Admin Login", False, f"Exception: {str(e)}")

    def get_existing_recurring_tasks(self):
        """Get existing recurring tasks to pick one for testing"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/recurring-tasks", headers=headers)
            
            if response.status_code == 200:
                tasks = response.json()
                if tasks and len(tasks) > 0:
                    task_id = tasks[0].get('id')
                    task_title = tasks[0].get('title', 'Unknown')
                    return self.log_result("Get Existing Recurring Tasks", True, 
                                         f"Found {len(tasks)} recurring tasks, selected: {task_title}", 
                                         {"task_id": task_id, "task_data": tasks[0]})
                else:
                    return self.log_result("Get Existing Recurring Tasks", False, "No recurring tasks found")
            else:
                return self.log_result("Get Existing Recurring Tasks", False, 
                                     f"HTTP {response.status_code}", response.text)
        except Exception as e:
            return self.log_result("Get Existing Recurring Tasks", False, f"Exception: {str(e)}")

    def update_recurring_task(self, task_id):
        """Test updating a recurring task with the specified data"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Update data as specified in the review request
            update_data = {
                "title": "Updated Daily Standup Report",
                "description": "Updated description - Submit your daily standup report with details",
                "priority": "Medium",
                "recurrence_time": "10:00",
                "recurrence_interval": 2
            }
            
            response = self.session.put(f"{API_BASE}/recurring-tasks/{task_id}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['id', 'title', 'description', 'priority', 'recurrence_time', 'recurrence_interval']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Verify updated values
                    if (data.get('title') == update_data['title'] and
                        data.get('description') == update_data['description'] and
                        data.get('priority') == update_data['priority'] and
                        data.get('recurrence_time') == update_data['recurrence_time'] and
                        data.get('recurrence_interval') == update_data['recurrence_interval']):
                        
                        return self.log_result("Update Recurring Task", True, 
                                             "Successfully updated recurring task with all fields", 
                                             {"updated_task": data})
                    else:
                        return self.log_result("Update Recurring Task", False, 
                                             "Task updated but values don't match", 
                                             {"expected": update_data, "actual": data})
                else:
                    return self.log_result("Update Recurring Task", False, 
                                         f"Missing required fields in response: {missing_fields}")
            else:
                return self.log_result("Update Recurring Task", False, 
                                     f"HTTP {response.status_code}", response.text)
        except Exception as e:
            return self.log_result("Update Recurring Task", False, f"Exception: {str(e)}")

    def verify_update_in_database(self, task_id):
        """Verify the update persisted in database by getting the task again"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/recurring-tasks", headers=headers)
            
            if response.status_code == 200:
                tasks = response.json()
                updated_task = next((task for task in tasks if task.get('id') == task_id), None)
                
                if updated_task:
                    # Check if the updated values are correct
                    expected_values = {
                        "title": "Updated Daily Standup Report",
                        "description": "Updated description - Submit your daily standup report with details",
                        "priority": "Medium",
                        "recurrence_time": "10:00",
                        "recurrence_interval": 2
                    }
                    
                    all_correct = True
                    incorrect_fields = []
                    
                    for field, expected_value in expected_values.items():
                        actual_value = updated_task.get(field)
                        if actual_value != expected_value:
                            all_correct = False
                            incorrect_fields.append(f"{field}: expected {expected_value}, got {actual_value}")
                    
                    if all_correct:
                        return self.log_result("Verify Update in Database", True, 
                                             "All updated fields are correct in database", 
                                             {"verified_task": updated_task})
                    else:
                        return self.log_result("Verify Update in Database", False, 
                                             f"Some fields incorrect: {incorrect_fields}")
                else:
                    return self.log_result("Verify Update in Database", False, 
                                         f"Task with ID {task_id} not found")
            else:
                return self.log_result("Verify Update in Database", False, 
                                     f"HTTP {response.status_code}", response.text)
        except Exception as e:
            return self.log_result("Verify Update in Database", False, f"Exception: {str(e)}")

    def test_complete_update(self, task_id):
        """Test updating all fields of a recurring task"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Complete update data with all possible fields
            complete_update_data = {
                "title": "Complete Update Test Task",
                "description": "Testing complete field update functionality",
                "status": "active",
                "priority": "High",
                "assign_to_team": False,
                "assignee": "admin@millionaze.com",
                "recurrence_frequency": "weekly",
                "recurrence_interval": 3,
                "recurrence_time": "14:30"
            }
            
            response = self.session.put(f"{API_BASE}/recurring-tasks/{task_id}", 
                                      json=complete_update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify all fields are updated correctly
                all_correct = True
                incorrect_fields = []
                
                for field, expected_value in complete_update_data.items():
                    actual_value = data.get(field)
                    if actual_value != expected_value:
                        all_correct = False
                        incorrect_fields.append(f"{field}: expected {expected_value}, got {actual_value}")
                
                if all_correct:
                    return self.log_result("Test Complete Update", True, 
                                         "All fields updated correctly in complete update test", 
                                         {"updated_task": data})
                else:
                    return self.log_result("Test Complete Update", False, 
                                         f"Some fields incorrect in complete update: {incorrect_fields}")
            else:
                return self.log_result("Test Complete Update", False, 
                                     f"HTTP {response.status_code}", response.text)
        except Exception as e:
            return self.log_result("Test Complete Update", False, f"Exception: {str(e)}")

    def test_serialization_errors(self, task_id):
        """Test that there are no MongoDB ObjectId serialization errors"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Simple update to test serialization
            update_data = {"title": "Serialization Test Task"}
            
            response = self.session.put(f"{API_BASE}/recurring-tasks/{task_id}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                try:
                    data = response.json()  # This will fail if there are serialization issues
                    return self.log_result("Test Serialization", True, 
                                         "No MongoDB ObjectId serialization errors", 
                                         {"response_data": data})
                except json.JSONDecodeError as json_error:
                    return self.log_result("Test Serialization", False, 
                                         f"JSON decode error (serialization issue): {str(json_error)}")
            else:
                return self.log_result("Test Serialization", False, 
                                     f"HTTP {response.status_code}", response.text)
        except Exception as e:
            return self.log_result("Test Serialization", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all recurring task update tests"""
        print("🎯 RECURRING TASK UPDATE FUNCTIONALITY TESTING")
        print("=" * 60)
        
        # Step 1: Login as admin
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return False
        
        # Step 2: Get existing recurring tasks
        if not self.get_existing_recurring_tasks():
            print("❌ Cannot proceed without existing recurring tasks")
            return False
        
        # Get the task ID from the last successful result
        task_id = None
        for result in reversed(self.test_results):
            if result['test'] == "Get Existing Recurring Tasks" and result['success']:
                task_id = result['details']['task_id']
                break
        
        if not task_id:
            print("❌ No task ID found for testing")
            return False
        
        print(f"\n🎯 Testing with recurring task ID: {task_id}")
        
        # Step 3: Test the specific update from review request
        self.update_recurring_task(task_id)
        
        # Step 4: Verify update persisted in database
        self.verify_update_in_database(task_id)
        
        # Step 5: Test complete field update
        self.test_complete_update(task_id)
        
        # Step 6: Test serialization (no MongoDB ObjectId errors)
        self.test_serialization_errors(task_id)
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = RecurringTaskUpdateTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)