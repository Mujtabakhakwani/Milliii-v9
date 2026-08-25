#!/usr/bin/env python3
"""
Recurring Tasks Schedule Mode Feature Testing
Focus: Testing the new SCHEDULE MODE feature for recurring tasks
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class RecurringTasksScheduleModeTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        self.test_recurring_task_immediate_id = None
        self.test_recurring_task_scheduled_id = None
        
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
            print(f"   Details: {details}")
    
    def setup_admin_user(self):
        """Login as admin user for testing"""
        print("\n=== Setting up Admin User ===")
        
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Login", True, f"Logged in as admin: {data['user']['name']}")
                return True
            else:
                self.log_result("Admin Login", False, f"Failed to login: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception during admin login: {str(e)}")
            return False
    
    def test_create_recurring_task_schedule_mode_off(self):
        """Test creating recurring task with schedule_mode: false (immediate creation)"""
        print("\n=== Test 1: Create Recurring Task with Schedule Mode OFF ===")
        
        if not self.admin_token:
            self.log_result("Schedule Mode OFF Test", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            task_data = {
                "title": "Test Immediate Task",
                "description": "This should create tasks immediately",
                "status": "Not Started",
                "priority": "High",
                "assign_to_team": True,
                "recurrence_frequency": "daily",
                "recurrence_interval": 1,
                "recurrence_time": "09:00",
                "schedule_mode": False
            }
            
            response = self.session.post(f"{API_BASE}/recurring-tasks", json=task_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_recurring_task_immediate_id = data.get('id')
                
                # Verify response includes generated_count > 0
                generated_count = data.get('generated_count', 0)
                if generated_count > 0:
                    self.log_result("Immediate Task Creation - Generated Count", True, 
                                  f"Generated {generated_count} tasks immediately")
                else:
                    self.log_result("Immediate Task Creation - Generated Count", False, 
                                  f"Expected generated_count > 0, got {generated_count}")
                
                # Verify recurring task template was saved
                if data.get('id') and data.get('title') == task_data['title']:
                    self.log_result("Immediate Task Creation - Template Saved", True, 
                                  f"Recurring task template saved with ID: {data.get('id')}")
                else:
                    self.log_result("Immediate Task Creation - Template Saved", False, 
                                  "Recurring task template not saved properly")
                
                # Verify actual tasks were created in tasks collection
                tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                if tasks_response.status_code == 200:
                    tasks = tasks_response.json()
                    # Find tasks created from this recurring template
                    created_tasks = [t for t in tasks if t.get('recurring_task_id') == self.test_recurring_task_immediate_id]
                    
                    if len(created_tasks) > 0:
                        self.log_result("Immediate Task Creation - Tasks in DB", True, 
                                      f"Found {len(created_tasks)} tasks created in database")
                        
                        # Verify task properties
                        sample_task = created_tasks[0]
                        if (sample_task.get('title') == task_data['title'] and 
                            sample_task.get('is_recurring_instance') == True):
                            self.log_result("Immediate Task Creation - Task Properties", True, 
                                          "Created tasks have correct properties")
                        else:
                            self.log_result("Immediate Task Creation - Task Properties", False, 
                                          "Created tasks missing expected properties")
                    else:
                        self.log_result("Immediate Task Creation - Tasks in DB", False, 
                                      "No tasks found in database for this recurring template")
                else:
                    self.log_result("Immediate Task Creation - Tasks Check", False, 
                                  f"Failed to retrieve tasks: {tasks_response.status_code}")
                
            else:
                self.log_result("Immediate Task Creation", False, 
                              f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Immediate Task Creation", False, f"Exception: {str(e)}")
    
    def test_create_recurring_task_schedule_mode_on(self):
        """Test creating recurring task with schedule_mode: true (scheduled for later)"""
        print("\n=== Test 2: Create Recurring Task with Schedule Mode ON ===")
        
        if not self.admin_token:
            self.log_result("Schedule Mode ON Test", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            task_data = {
                "title": "Test Scheduled Task Monday 8AM",
                "description": "This should NOT create tasks immediately - wait for scheduled time",
                "status": "Not Started",
                "priority": "Medium",
                "assign_to_team": True,
                "recurrence_frequency": "weekly",
                "recurrence_interval": 1,
                "recurrence_days": ["Monday"],
                "recurrence_time": "08:00",
                "schedule_mode": True
            }
            
            response = self.session.post(f"{API_BASE}/recurring-tasks", json=task_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_recurring_task_scheduled_id = data.get('id')
                
                # Verify response includes generated_count = 0
                generated_count = data.get('generated_count', -1)
                if generated_count == 0:
                    self.log_result("Scheduled Task Creation - Generated Count", True, 
                                  f"Generated count is 0 as expected (schedule mode)")
                else:
                    self.log_result("Scheduled Task Creation - Generated Count", False, 
                                  f"Expected generated_count = 0, got {generated_count}")
                
                # Verify recurring task template was saved with schedule_mode: true
                if data.get('id') and data.get('title') == task_data['title']:
                    self.log_result("Scheduled Task Creation - Template Saved", True, 
                                  f"Recurring task template saved with ID: {data.get('id')}")
                else:
                    self.log_result("Scheduled Task Creation - Template Saved", False, 
                                  "Recurring task template not saved properly")
                
                # Verify NO tasks were created in tasks collection yet
                tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                if tasks_response.status_code == 200:
                    tasks = tasks_response.json()
                    # Find tasks created from this recurring template
                    created_tasks = [t for t in tasks if t.get('recurring_task_id') == self.test_recurring_task_scheduled_id]
                    
                    if len(created_tasks) == 0:
                        self.log_result("Scheduled Task Creation - No Tasks in DB", True, 
                                      "No tasks created in database (scheduled mode)")
                    else:
                        self.log_result("Scheduled Task Creation - No Tasks in DB", False, 
                                      f"Found {len(created_tasks)} tasks in database, expected 0")
                else:
                    self.log_result("Scheduled Task Creation - Tasks Check", False, 
                                  f"Failed to retrieve tasks: {tasks_response.status_code}")
                
                # Verify the recurring task template has schedule_mode: true
                recurring_tasks_response = self.session.get(f"{API_BASE}/recurring-tasks", headers=headers)
                if recurring_tasks_response.status_code == 200:
                    recurring_tasks = recurring_tasks_response.json()
                    scheduled_task = next((rt for rt in recurring_tasks if rt.get('id') == self.test_recurring_task_scheduled_id), None)
                    
                    if scheduled_task and scheduled_task.get('schedule_mode') == True:
                        self.log_result("Scheduled Task Creation - Schedule Mode Flag", True, 
                                      "Recurring task saved with schedule_mode: true")
                    else:
                        self.log_result("Scheduled Task Creation - Schedule Mode Flag", False, 
                                      f"Schedule mode flag not set correctly: {scheduled_task.get('schedule_mode') if scheduled_task else 'Task not found'}")
                else:
                    self.log_result("Scheduled Task Creation - Template Check", False, 
                                  f"Failed to retrieve recurring tasks: {recurring_tasks_response.status_code}")
                
            else:
                self.log_result("Scheduled Task Creation", False, 
                              f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Scheduled Task Creation", False, f"Exception: {str(e)}")
    
    def test_manually_generate_scheduled_tasks(self):
        """Test manually generating tasks from scheduled recurring task"""
        print("\n=== Test 3: Manually Generate Scheduled Tasks ===")
        
        if not self.admin_token or not self.test_recurring_task_scheduled_id:
            self.log_result("Manual Generation Test", False, "Missing admin token or scheduled task ID")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Use the recurring task ID from test 2
            response = self.session.post(f"{API_BASE}/recurring-tasks/{self.test_recurring_task_scheduled_id}/generate", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify it generates tasks successfully
                generated_count = data.get('count', 0)
                if generated_count > 0:
                    self.log_result("Manual Generation - Task Count", True, 
                                  f"Generated {generated_count} tasks manually")
                    
                    # Verify task_ids are returned
                    task_ids = data.get('task_ids', [])
                    if len(task_ids) == generated_count:
                        self.log_result("Manual Generation - Task IDs", True, 
                                      f"Returned {len(task_ids)} task IDs")
                    else:
                        self.log_result("Manual Generation - Task IDs", False, 
                                      f"Expected {generated_count} task IDs, got {len(task_ids)}")
                else:
                    self.log_result("Manual Generation - Task Count", False, 
                                  f"Expected generated count > 0, got {generated_count}")
                
                # Verify tasks appear in tasks collection
                tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                if tasks_response.status_code == 200:
                    tasks = tasks_response.json()
                    # Find tasks created from this recurring template
                    created_tasks = [t for t in tasks if t.get('recurring_task_id') == self.test_recurring_task_scheduled_id]
                    
                    if len(created_tasks) > 0:
                        self.log_result("Manual Generation - Tasks in DB", True, 
                                      f"Found {len(created_tasks)} tasks in database after manual generation")
                        
                        # Verify task properties
                        sample_task = created_tasks[0]
                        if (sample_task.get('title') == "Test Scheduled Task Monday 8AM" and 
                            sample_task.get('is_recurring_instance') == True):
                            self.log_result("Manual Generation - Task Properties", True, 
                                          "Generated tasks have correct properties")
                        else:
                            self.log_result("Manual Generation - Task Properties", False, 
                                          "Generated tasks missing expected properties")
                    else:
                        self.log_result("Manual Generation - Tasks in DB", False, 
                                      "No tasks found in database after manual generation")
                else:
                    self.log_result("Manual Generation - Tasks Check", False, 
                                  f"Failed to retrieve tasks: {tasks_response.status_code}")
                
            else:
                self.log_result("Manual Generation", False, 
                              f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Manual Generation", False, f"Exception: {str(e)}")
    
    def test_generate_all_with_mixed_mode(self):
        """Test generate-all endpoint with mixed schedule modes"""
        print("\n=== Test 4: Generate All with Mixed Mode ===")
        
        if not self.admin_token:
            self.log_result("Generate All Test", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Get count of tasks before generate-all
            tasks_before_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
            tasks_before_count = 0
            if tasks_before_response.status_code == 200:
                tasks_before_count = len(tasks_before_response.json())
            
            # Call generate-all endpoint
            response = self.session.post(f"{API_BASE}/recurring-tasks/generate-all", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify it processes all templates regardless of schedule_mode
                total_generated = data.get('total_generated', 0)
                results = data.get('results', [])
                
                self.log_result("Generate All - Response Structure", True, 
                              f"Generated {total_generated} tasks from {len(results)} templates")
                
                # Verify count returned
                if isinstance(total_generated, int) and total_generated >= 0:
                    self.log_result("Generate All - Count Type", True, 
                                  f"Total generated count is valid integer: {total_generated}")
                else:
                    self.log_result("Generate All - Count Type", False, 
                                  f"Invalid total_generated value: {total_generated}")
                
                # Verify results structure
                if isinstance(results, list):
                    self.log_result("Generate All - Results Structure", True, 
                                  f"Results is array with {len(results)} entries")
                    
                    # Check if our test templates are in results
                    template_ids = [r.get('template_id') for r in results]
                    
                    # Look for our immediate mode template
                    if self.test_recurring_task_immediate_id in template_ids:
                        immediate_result = next((r for r in results if r.get('template_id') == self.test_recurring_task_immediate_id), None)
                        if immediate_result:
                            self.log_result("Generate All - Immediate Mode Template", True, 
                                          f"Processed immediate mode template: {immediate_result.get('generated_count', 0)} tasks")
                    
                    # Look for our scheduled mode template
                    if self.test_recurring_task_scheduled_id in template_ids:
                        scheduled_result = next((r for r in results if r.get('template_id') == self.test_recurring_task_scheduled_id), None)
                        if scheduled_result:
                            self.log_result("Generate All - Scheduled Mode Template", True, 
                                          f"Processed scheduled mode template: {scheduled_result.get('generated_count', 0)} tasks")
                else:
                    self.log_result("Generate All - Results Structure", False, 
                                  f"Results should be array, got {type(results)}")
                
                # Verify tasks were actually created (check database)
                tasks_after_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                if tasks_after_response.status_code == 200:
                    tasks_after_count = len(tasks_after_response.json())
                    
                    if tasks_after_count >= tasks_before_count:
                        self.log_result("Generate All - Tasks Created", True, 
                                      f"Task count increased: {tasks_before_count} -> {tasks_after_count}")
                    else:
                        self.log_result("Generate All - Tasks Created", False, 
                                      f"Task count decreased: {tasks_before_count} -> {tasks_after_count}")
                else:
                    self.log_result("Generate All - Tasks Check", False, 
                                  f"Failed to retrieve tasks after generate-all: {tasks_after_response.status_code}")
                
            else:
                self.log_result("Generate All", False, 
                              f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Generate All", False, f"Exception: {str(e)}")
    
    def test_schedule_mode_field_verification(self):
        """Additional verification of schedule_mode field behavior"""
        print("\n=== Test 5: Schedule Mode Field Verification ===")
        
        if not self.admin_token:
            self.log_result("Schedule Mode Verification", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Get all recurring tasks to verify schedule_mode field
            response = self.session.get(f"{API_BASE}/recurring-tasks", headers=headers)
            
            if response.status_code == 200:
                recurring_tasks = response.json()
                
                # Find our test tasks
                immediate_task = next((rt for rt in recurring_tasks if rt.get('id') == self.test_recurring_task_immediate_id), None)
                scheduled_task = next((rt for rt in recurring_tasks if rt.get('id') == self.test_recurring_task_scheduled_id), None)
                
                if immediate_task:
                    # Verify immediate task has schedule_mode: false (or undefined/null)
                    schedule_mode = immediate_task.get('schedule_mode')
                    if schedule_mode == False or schedule_mode is None:
                        self.log_result("Schedule Mode Field - Immediate Task", True, 
                                      f"Immediate task schedule_mode: {schedule_mode}")
                    else:
                        self.log_result("Schedule Mode Field - Immediate Task", False, 
                                      f"Expected False/None, got: {schedule_mode}")
                else:
                    self.log_result("Schedule Mode Field - Immediate Task", False, 
                                  "Immediate task not found in recurring tasks list")
                
                if scheduled_task:
                    # Verify scheduled task has schedule_mode: true
                    schedule_mode = scheduled_task.get('schedule_mode')
                    if schedule_mode == True:
                        self.log_result("Schedule Mode Field - Scheduled Task", True, 
                                      f"Scheduled task schedule_mode: {schedule_mode}")
                    else:
                        self.log_result("Schedule Mode Field - Scheduled Task", False, 
                                      f"Expected True, got: {schedule_mode}")
                else:
                    self.log_result("Schedule Mode Field - Scheduled Task", False, 
                                  "Scheduled task not found in recurring tasks list")
                
                # Verify all recurring tasks have the schedule_mode field
                tasks_with_schedule_mode = [rt for rt in recurring_tasks if 'schedule_mode' in rt]
                self.log_result("Schedule Mode Field - All Tasks", True, 
                              f"{len(tasks_with_schedule_mode)}/{len(recurring_tasks)} tasks have schedule_mode field")
                
            else:
                self.log_result("Schedule Mode Verification", False, 
                              f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Schedule Mode Verification", False, f"Exception: {str(e)}")
    
    def cleanup_test_data(self):
        """Clean up test recurring tasks and generated tasks"""
        print("\n=== Cleaning Up Test Data ===")
        
        if not self.admin_token:
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Delete test recurring tasks
        for task_id in [self.test_recurring_task_immediate_id, self.test_recurring_task_scheduled_id]:
            if task_id:
                try:
                    response = self.session.delete(f"{API_BASE}/recurring-tasks/{task_id}", headers=headers)
                    if response.status_code == 200:
                        self.log_result("Cleanup", True, f"Deleted recurring task: {task_id}")
                    else:
                        self.log_result("Cleanup", False, f"Failed to delete recurring task {task_id}: {response.status_code}")
                except Exception as e:
                    self.log_result("Cleanup", False, f"Exception deleting recurring task {task_id}: {str(e)}")
        
        # Delete generated tasks
        try:
            tasks_response = self.session.get(f"{API_BASE}/tasks", headers=headers)
            if tasks_response.status_code == 200:
                tasks = tasks_response.json()
                test_tasks = [t for t in tasks if t.get('recurring_task_id') in [self.test_recurring_task_immediate_id, self.test_recurring_task_scheduled_id]]
                
                for task in test_tasks:
                    try:
                        delete_response = self.session.delete(f"{API_BASE}/tasks/{task['id']}", headers=headers)
                        if delete_response.status_code == 200:
                            self.log_result("Cleanup", True, f"Deleted generated task: {task['id']}")
                    except Exception as e:
                        self.log_result("Cleanup", False, f"Exception deleting task {task['id']}: {str(e)}")
        except Exception as e:
            self.log_result("Cleanup", False, f"Exception during task cleanup: {str(e)}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("RECURRING TASKS SCHEDULE MODE FEATURE TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result['success']:
                print(f"  - {result['test']}: {result['message']}")
        
        return failed_tests == 0
    
    def run_all_tests(self):
        """Run all recurring tasks schedule mode tests"""
        print("Starting Recurring Tasks Schedule Mode Feature Testing...")
        
        # Setup
        if not self.setup_admin_user():
            print("❌ Failed to setup admin user. Aborting tests.")
            return False
        
        # Run tests in sequence
        self.test_create_recurring_task_schedule_mode_off()
        self.test_create_recurring_task_schedule_mode_on()
        self.test_manually_generate_scheduled_tasks()
        self.test_generate_all_with_mixed_mode()
        self.test_schedule_mode_field_verification()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        return self.print_summary()

def main():
    """Main function"""
    tester = RecurringTasksScheduleModeTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Schedule Mode feature is working correctly.")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed. Please check the results above.")
        sys.exit(1)

if __name__ == "__main__":
    main()