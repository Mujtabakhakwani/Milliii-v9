#!/usr/bin/env python3
"""
Backend API Testing for Millionaze Project Management App
Focus: Break Tracking Functionality Testing
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class BreakTrackingTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        self.test_project_id = None
        self.test_break_id = None
        self.test_time_entry_id = None
        
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
        """Create or login as admin user for testing"""
        print("\n=== Setting up Admin User ===")
        
        # Try to login with existing admin
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
        except Exception as e:
            pass
        
        # Try to create admin user
        try:
            admin_signup = {
                "name": "Admin User",
                "email": "admin@millionaze.com", 
                "password": "admin123",
                "role": "admin"
            }
            
            response = self.session.post(f"{API_BASE}/auth/signup", json=admin_signup)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Signup", True, f"Created admin user: {data['user']['name']}")
                return True
            else:
                self.log_result("Admin Setup", False, f"Failed to create admin: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Admin Setup", False, f"Exception during admin setup: {str(e)}")
            return False
    
    def create_test_project(self):
        """Create a test project for testing"""
        print("\n=== Creating Test Project ===")
        
        if not self.admin_token:
            self.log_result("Create Test Project", False, "No admin token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            project_data = {
                "name": "Break Tracking Test Project",
                "company_name": "Test Company",
                "business_name": "Test Business",
                "client_name": "John Doe",
                "client_email": "john.doe@testclient.com",
                "status": "Getting Started",
                "description": "This is a test project for break tracking functionality",
                "team_members": []
            }
            
            response = self.session.post(f"{API_BASE}/projects", json=project_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_project_id = data.get('id')
                self.log_result("Create Test Project", True, f"Created test project: {data.get('name')}")
                return True
            else:
                self.log_result("Create Test Project", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Create Test Project", False, f"Exception: {str(e)}")
            return False
    
    def create_break_type(self):
        """Create a break type for testing"""
        print("\n--- Creating Break Type ---")
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            break_data = {
                "name": "Coffee Break",
                "duration_minutes": 15
            }
            
            response = self.session.post(f"{API_BASE}/breaks", json=break_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_break_id = data['break']['id']
                self.log_result("Create Break Type", True, f"Created break type: {data['break']['name']} ({data['break']['duration_minutes']} min)")
                return True
            else:
                self.log_result("Create Break Type", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Create Break Type", False, f"Exception: {str(e)}")
            return False
    
    def test_clock_in_to_break(self):
        """Test Scenario 1: Clock in to a Break (New Endpoint)"""
        print("\n--- Testing Clock In to Break ---")
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test POST /api/time-entries/clock-in-break?break_id={break_id}
            response = self.session.post(
                f"{API_BASE}/time-entries/clock-in-break",
                headers=headers,
                params={"break_id": self.test_break_id}
            )
            
            if response.status_code == 200:
                data = response.json()
                time_entry = data.get('time_entry', {})
                
                # Verify required fields
                required_checks = [
                    ('is_break', True, "is_break field should be True"),
                    ('break_id', self.test_break_id, "break_id should match requested break"),
                    ('task_id', None, "task_id should be None for breaks"),
                    ('project_id', None, "project_id should be None for breaks"),
                    ('is_active', True, "is_active should be True")
                ]
                
                all_checks_passed = True
                for field, expected_value, description in required_checks:
                    actual_value = time_entry.get(field)
                    if actual_value != expected_value:
                        self.log_result(f"Clock In Break - {field}", False, f"{description}. Got: {actual_value}, Expected: {expected_value}")
                        all_checks_passed = False
                    else:
                        self.log_result(f"Clock In Break - {field}", True, description)
                
                # Check if break info is included in response
                if 'break' in time_entry:
                    self.log_result("Clock In Break - Break Info", True, "Break info included in response")
                else:
                    self.log_result("Clock In Break - Break Info", False, "Break info missing from response")
                    all_checks_passed = False
                
                if all_checks_passed:
                    self.test_time_entry_id = time_entry.get('id')
                    self.log_result("Clock In to Break", True, "Successfully clocked in to break with all required fields")
                else:
                    self.log_result("Clock In to Break", False, "Some required fields missing or incorrect")
                    
            else:
                self.log_result("Clock In to Break", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Clock In to Break", False, f"Exception: {str(e)}")
    
    def test_cannot_clock_in_multiple_breaks(self):
        """Test that user cannot clock in to another break while one is active"""
        print("\n--- Testing Cannot Clock In Multiple Breaks ---")
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to clock in to the same break again (should fail)
            response = self.session.post(
                f"{API_BASE}/time-entries/clock-in-break",
                headers=headers,
                params={"break_id": self.test_break_id}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "already have an active time entry" in data.get('detail', ''):
                    self.log_result("Prevent Multiple Break Clock-ins", True, "Correctly prevents clocking in to another break while one is active")
                else:
                    self.log_result("Prevent Multiple Break Clock-ins", False, f"Wrong error message: {data.get('detail')}")
            else:
                self.log_result("Prevent Multiple Break Clock-ins", False, f"Should return 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Prevent Multiple Break Clock-ins", False, f"Exception: {str(e)}")
    
    def test_clock_out_from_break(self):
        """Test Scenario 2: Clock Out from Break"""
        print("\n--- Testing Clock Out from Break ---")
        
        if not self.test_time_entry_id:
            self.log_result("Clock Out from Break", False, "No active time entry ID available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test POST /api/time-entries/clock-out
            clock_out_data = {
                "time_entry_id": self.test_time_entry_id
            }
            
            response = self.session.post(f"{API_BASE}/time-entries/clock-out", json=clock_out_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if 'message' in data and 'duration_seconds' in data:
                    self.log_result("Clock Out from Break - Response", True, f"Successfully clocked out, duration: {data['duration_seconds']} seconds")
                    
                    # Verify the time entry is now inactive
                    # Get the time entry to verify is_active is False and duration is calculated
                    entries_response = self.session.get(f"{API_BASE}/time-entries", headers=headers)
                    if entries_response.status_code == 200:
                        entries = entries_response.json()
                        updated_entry = next((e for e in entries if e['id'] == self.test_time_entry_id), None)
                        
                        if updated_entry:
                            if updated_entry.get('is_active') == False:
                                self.log_result("Clock Out - is_active", True, "is_active correctly set to False")
                            else:
                                self.log_result("Clock Out - is_active", False, f"is_active should be False, got {updated_entry.get('is_active')}")
                            
                            if updated_entry.get('duration_seconds') is not None and updated_entry.get('duration_seconds') > 0:
                                self.log_result("Clock Out - duration_seconds", True, f"duration_seconds calculated: {updated_entry.get('duration_seconds')}")
                            else:
                                self.log_result("Clock Out - duration_seconds", False, f"duration_seconds not calculated properly: {updated_entry.get('duration_seconds')}")
                        else:
                            self.log_result("Clock Out - Verification", False, "Could not find updated time entry")
                    
                    self.log_result("Clock Out from Break", True, "Successfully clocked out from break")
                else:
                    self.log_result("Clock Out from Break", False, f"Missing required response fields: {data}")
                    
            else:
                self.log_result("Clock Out from Break", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Clock Out from Break", False, f"Exception: {str(e)}")
    
    def test_break_entry_in_weekly_summary(self):
        """Test Scenario 3: Break Entry in Weekly Summary"""
        print("\n--- Testing Break Entry in Weekly Summary ---")
        
        # First, create a new break entry for testing
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Clock in to break
            clock_in_response = self.session.post(
                f"{API_BASE}/time-entries/clock-in-break",
                headers=headers,
                params={"break_id": self.test_break_id}
            )
            
            if clock_in_response.status_code == 200:
                clock_in_data = clock_in_response.json()
                new_time_entry_id = clock_in_data['time_entry']['id']
                
                # Wait 2-3 seconds as requested
                print("   Waiting 3 seconds...")
                time.sleep(3)
                
                # Clock out
                clock_out_data = {"time_entry_id": new_time_entry_id}
                clock_out_response = self.session.post(f"{API_BASE}/time-entries/clock-out", json=clock_out_data, headers=headers)
                
                if clock_out_response.status_code == 200:
                    # Test GET /api/time-entries/weekly-summary
                    from datetime import datetime, timedelta
                    
                    # Get current week range
                    today = datetime.now()
                    start_of_week = today - timedelta(days=today.weekday())
                    end_of_week = start_of_week + timedelta(days=6)
                    
                    start_date = start_of_week.strftime("%Y-%m-%dT00:00:00Z")
                    end_date = end_of_week.strftime("%Y-%m-%dT23:59:59Z")
                    
                    summary_response = self.session.get(
                        f"{API_BASE}/time-entries/weekly-summary",
                        headers=headers,
                        params={"start_date": start_date, "end_date": end_date}
                    )
                    
                    if summary_response.status_code == 200:
                        summary_data = summary_response.json()
                        
                        # Check if break entry appears in summary
                        users = summary_data.get('users', [])
                        admin_user_summary = next((u for u in users if u.get('user_email') == 'admin@millionaze.com'), None)
                        
                        if admin_user_summary:
                            total_seconds = admin_user_summary.get('total_seconds', 0)
                            if total_seconds > 0:
                                self.log_result("Break in Weekly Summary - Duration", True, f"Break time tracked in weekly summary: {total_seconds} seconds")
                            else:
                                self.log_result("Break in Weekly Summary - Duration", False, "Break time not tracked in weekly summary")
                            
                            self.log_result("Break Entry in Weekly Summary", True, "Break entry appears in weekly summary")
                        else:
                            self.log_result("Break Entry in Weekly Summary", False, "Admin user not found in weekly summary")
                    else:
                        self.log_result("Break Entry in Weekly Summary", False, f"Weekly summary failed: {summary_response.status_code}")
                else:
                    self.log_result("Break Entry in Weekly Summary", False, "Failed to clock out from test break")
            else:
                self.log_result("Break Entry in Weekly Summary", False, "Failed to clock in to test break")
                
        except Exception as e:
            self.log_result("Break Entry in Weekly Summary", False, f"Exception: {str(e)}")
    
    def test_task_break_task_flow(self):
        """Test Scenario 4: Task → Break → Task Flow"""
        print("\n--- Testing Task → Break → Task Flow ---")
        
        if not self.test_project_id:
            self.log_result("Task Break Task Flow", False, "No test project available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create a test task first
            task_data = {
                "project_id": self.test_project_id,
                "title": "Test Task for Break Flow",
                "description": "Testing task-break-task flow",
                "status": "In Progress"
            }
            
            task_response = self.session.post(f"{API_BASE}/tasks", json=task_data, headers=headers)
            
            if task_response.status_code == 200:
                task_id = task_response.json()['id']
                
                # Step 1: Clock in to regular task
                clock_in_task_data = {
                    "task_id": task_id,
                    "project_id": self.test_project_id
                }
                
                task_clock_in_response = self.session.post(f"{API_BASE}/time-entries/clock-in", json=clock_in_task_data, headers=headers)
                
                if task_clock_in_response.status_code == 200:
                    task_entry_id = task_clock_in_response.json()['time_entry']['id']
                    self.log_result("Task Break Flow - Task Clock In", True, "Successfully clocked in to task")
                    
                    # Step 2: Clock out from task
                    clock_out_data = {"time_entry_id": task_entry_id}
                    task_clock_out_response = self.session.post(f"{API_BASE}/time-entries/clock-out", json=clock_out_data, headers=headers)
                    
                    if task_clock_out_response.status_code == 200:
                        self.log_result("Task Break Flow - Task Clock Out", True, "Successfully clocked out from task")
                        
                        # Step 3: Clock in to break
                        break_clock_in_response = self.session.post(
                            f"{API_BASE}/time-entries/clock-in-break",
                            headers=headers,
                            params={"break_id": self.test_break_id}
                        )
                        
                        if break_clock_in_response.status_code == 200:
                            break_entry_id = break_clock_in_response.json()['time_entry']['id']
                            self.log_result("Task Break Flow - Break Clock In", True, "Successfully clocked in to break")
                            
                            # Step 4: Clock out from break
                            break_clock_out_data = {"time_entry_id": break_entry_id}
                            break_clock_out_response = self.session.post(f"{API_BASE}/time-entries/clock-out", json=break_clock_out_data, headers=headers)
                            
                            if break_clock_out_response.status_code == 200:
                                self.log_result("Task Break Flow - Break Clock Out", True, "Successfully clocked out from break")
                                
                                # Step 5: Clock in to another task
                                task2_clock_in_response = self.session.post(f"{API_BASE}/time-entries/clock-in", json=clock_in_task_data, headers=headers)
                                
                                if task2_clock_in_response.status_code == 200:
                                    task2_entry_id = task2_clock_in_response.json()['time_entry']['id']
                                    self.log_result("Task Break Flow - Task 2 Clock In", True, "Successfully clocked in to second task")
                                    
                                    # Step 6: Verify all three entries are separate in time_entries collection
                                    entries_response = self.session.get(f"{API_BASE}/time-entries", headers=headers)
                                    
                                    if entries_response.status_code == 200:
                                        entries = entries_response.json()
                                        
                                        # Find our three entries
                                        task_entry = next((e for e in entries if e['id'] == task_entry_id), None)
                                        break_entry = next((e for e in entries if e['id'] == break_entry_id), None)
                                        task2_entry = next((e for e in entries if e['id'] == task2_entry_id), None)
                                        
                                        if task_entry and break_entry and task2_entry:
                                            # Verify each has correct is_break flag
                                            if (task_entry.get('is_break') == False and 
                                                break_entry.get('is_break') == True and 
                                                task2_entry.get('is_break') == False):
                                                self.log_result("Task Break Flow - is_break Flags", True, "All entries have correct is_break flags")
                                            else:
                                                self.log_result("Task Break Flow - is_break Flags", False, 
                                                              f"Incorrect is_break flags: task1={task_entry.get('is_break')}, break={break_entry.get('is_break')}, task2={task2_entry.get('is_break')}")
                                            
                                            self.log_result("Task → Break → Task Flow", True, "All three entries are separate and correctly flagged")
                                        else:
                                            self.log_result("Task → Break → Task Flow", False, "Could not find all three time entries")
                                    
                                    # Clean up - clock out from second task
                                    self.session.post(f"{API_BASE}/time-entries/clock-out", json={"time_entry_id": task2_entry_id}, headers=headers)
                                    
                                else:
                                    self.log_result("Task Break Flow - Task 2 Clock In", False, f"Failed to clock in to second task: {task2_clock_in_response.status_code}")
                            else:
                                self.log_result("Task Break Flow - Break Clock Out", False, f"Failed to clock out from break: {break_clock_out_response.status_code}")
                        else:
                            self.log_result("Task Break Flow - Break Clock In", False, f"Failed to clock in to break: {break_clock_in_response.status_code}")
                    else:
                        self.log_result("Task Break Flow - Task Clock Out", False, f"Failed to clock out from task: {task_clock_out_response.status_code}")
                else:
                    self.log_result("Task Break Flow - Task Clock In", False, f"Failed to clock in to task: {task_clock_in_response.status_code}")
            else:
                self.log_result("Task Break Task Flow", False, f"Failed to create test task: {task_response.status_code}")
                
        except Exception as e:
            self.log_result("Task → Break → Task Flow", False, f"Exception: {str(e)}")
    
    def test_invalid_break_id(self):
        """Test Scenario 5: Invalid Break ID"""
        print("\n--- Testing Invalid Break ID ---")
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to clock in with non-existent break_id
            fake_break_id = "non-existent-break-id-12345"
            
            response = self.session.post(
                f"{API_BASE}/time-entries/clock-in-break",
                headers=headers,
                params={"break_id": fake_break_id}
            )
            
            if response.status_code == 404:
                data = response.json()
                if "Break type not found" in data.get('detail', ''):
                    self.log_result("Invalid Break ID", True, "Correctly returns 404 for non-existent break ID")
                else:
                    self.log_result("Invalid Break ID", False, f"Wrong error message: {data.get('detail')}")
            else:
                self.log_result("Invalid Break ID", False, f"Should return 404, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Invalid Break ID", False, f"Exception: {str(e)}")

    def test_break_tracking_functionality(self):
        """Test the complete break tracking functionality as requested"""
        print("\n=== Testing Break Tracking Functionality ===")
        
        if not self.admin_token:
            self.log_result("Break Tracking Test", False, "No admin token available")
            return
        
        # Step 1: Create a break type first
        if not self.create_break_type():
            self.log_result("Break Tracking Test", False, "Failed to create break type")
            return
        
        # Step 2: Test all break tracking scenarios
        self.test_clock_in_to_break()
        self.test_cannot_clock_in_multiple_breaks()
        self.test_clock_out_from_break()
        self.test_break_entry_in_weekly_summary()
        self.test_task_break_task_flow()
        self.test_invalid_break_id()

    def run_all_tests(self):
        """Run all break tracking tests"""
        print("🚀 Starting Break Tracking Functionality Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup
        if not self.setup_admin_user():
            print("❌ Failed to setup admin user. Exiting.")
            return
        
        # Create test data
        if not self.create_test_project():
            print("❌ Failed to create test project. Exiting.")
            return
        
        # Focus on break tracking functionality as requested
        self.test_break_tracking_functionality()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "=" * 60)
        print("📊 BREAK TRACKING TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = BreakTrackingTester()
    tester.run_all_tests()