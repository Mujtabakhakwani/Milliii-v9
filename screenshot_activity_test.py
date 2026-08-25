#!/usr/bin/env python3
"""
Focused test for screenshot and activity log functionality as requested in review
"""

import requests
import json
import base64
import os
from datetime import datetime, timezone
from pathlib import Path

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class ScreenshotActivityTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        self.test_project_id = None
        self.test_task_id = None
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
    
    def login_admin(self):
        """1. Login with admin@millionaze.com / admin123"""
        print("\n=== 1. Admin Login ===")
        
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Login", True, f"Successfully logged in as: {data['user']['name']}")
                return True
            else:
                self.log_result("Admin Login", False, f"Login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def create_time_entry_for_testing(self):
        """2. Create a time entry for testing"""
        print("\n=== 2. Create Time Entry for Testing ===")
        
        if not self.admin_token:
            self.log_result("Create Time Entry", False, "No admin token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First create a test project if needed
        try:
            project_data = {
                "name": "Screenshot Test Project",
                "client_name": "Test Client",
                "status": "Getting Started"
            }
            
            response = self.session.post(f"{API_BASE}/projects", json=project_data, headers=headers)
            if response.status_code == 200:
                project = response.json()
                self.test_project_id = project.get('id')
                self.log_result("Create Test Project", True, f"Created project: {project.get('name')}")
            else:
                self.log_result("Create Test Project", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Create Test Project", False, f"Exception: {str(e)}")
            return False
        
        # Create a test task
        try:
            task_data = {
                "project_id": self.test_project_id,
                "title": "Screenshot Test Task",
                "description": "Task for testing screenshot functionality",
                "assignee": "admin@millionaze.com",
                "status": "In Progress"
            }
            
            response = self.session.post(f"{API_BASE}/tasks", json=task_data, headers=headers)
            if response.status_code == 200:
                task = response.json()
                self.test_task_id = task.get('id')
                self.log_result("Create Test Task", True, f"Created task: {task.get('title')}")
            else:
                self.log_result("Create Test Task", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Create Test Task", False, f"Exception: {str(e)}")
            return False
        
        # Clock in to create time entry
        try:
            clock_in_data = {
                "task_id": self.test_task_id,
                "project_id": self.test_project_id
            }
            
            response = self.session.post(f"{API_BASE}/time-entries/clock-in", json=clock_in_data, headers=headers)
            if response.status_code == 200:
                data = response.json()
                time_entry = data.get('time_entry', {})
                self.test_time_entry_id = time_entry.get('id')
                self.log_result("Create Time Entry", True, f"Created time entry: {self.test_time_entry_id}")
                return True
            else:
                self.log_result("Create Time Entry", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Create Time Entry", False, f"Exception: {str(e)}")
            return False
    
    def generate_small_base64_image(self):
        """Generate a small test image in base64 format"""
        # Create a minimal PNG image (1x1 pixel, red)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x00\x00\x00\x03\x00\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        return base64.b64encode(png_data).decode('utf-8')
    
    def test_screenshot_upload(self):
        """3. Test Screenshot Upload using POST /api/time-screenshots/upload"""
        print("\n=== 3. Test Screenshot Upload ===")
        
        if not self.admin_token or not self.test_time_entry_id:
            self.log_result("Screenshot Upload Test", False, "Missing admin token or time entry ID")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            # Generate small base64 image
            screenshot_base64 = self.generate_small_base64_image()
            
            upload_data = {
                "time_entry_id": self.test_time_entry_id,
                "screenshot_base64": screenshot_base64,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.session.post(f"{API_BASE}/time-screenshots/upload", json=upload_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                screenshot = data.get('screenshot', {})
                
                # Verify screenshot was saved to database
                if screenshot.get('id'):
                    self.log_result("Screenshot Database Record", True, f"Screenshot record created with ID: {screenshot.get('id')}")
                else:
                    self.log_result("Screenshot Database Record", False, "No screenshot ID in response")
                
                # Verify screenshot_url is provided
                screenshot_url = screenshot.get('screenshot_url')
                if screenshot_url:
                    self.log_result("Screenshot URL Generated", True, f"Screenshot URL: {screenshot_url}")
                    
                    # Test if screenshot file exists on disk
                    file_path = Path(f"/app/backend{screenshot_url}")
                    if file_path.exists():
                        self.log_result("Screenshot File on Disk", True, f"Screenshot file exists: {file_path}")
                        
                        # Check file permissions
                        if os.access(file_path, os.R_OK):
                            self.log_result("Screenshot File Permissions", True, "Screenshot file is readable")
                        else:
                            self.log_result("Screenshot File Permissions", False, "Screenshot file is not readable")
                    else:
                        self.log_result("Screenshot File on Disk", False, f"Screenshot file not found: {file_path}")
                else:
                    self.log_result("Screenshot URL Generated", False, "No screenshot_url in response")
                
                self.log_result("Screenshot Upload", True, "Screenshot upload completed successfully")
            else:
                self.log_result("Screenshot Upload", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Screenshot Upload", False, f"Exception: {str(e)}")
    
    def test_screenshot_retrieval(self):
        """4. Test Screenshot Retrieval using GET /api/time-screenshots"""
        print("\n=== 4. Test Screenshot Retrieval ===")
        
        if not self.admin_token or not self.test_time_entry_id:
            self.log_result("Screenshot Retrieval Test", False, "Missing admin token or time entry ID")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            # Test retrieval by time_entry_id
            params = {"time_entry_id": self.test_time_entry_id}
            response = self.session.get(f"{API_BASE}/time-screenshots", params=params, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    if len(data) > 0:
                        screenshot = data[0]
                        
                        # Verify all required fields are present
                        required_fields = ['id', 'time_entry_id', 'user_id', 'task_id', 'project_id', 'screenshot_url', 'timestamp']
                        missing_fields = [field for field in required_fields if field not in screenshot]
                        
                        if not missing_fields:
                            self.log_result("Screenshot Retrieval Fields", True, "All required fields present in retrieved screenshot")
                        else:
                            self.log_result("Screenshot Retrieval Fields", False, f"Missing fields: {missing_fields}")
                        
                        # Verify time_entry_id matches
                        if screenshot.get('time_entry_id') == self.test_time_entry_id:
                            self.log_result("Screenshot Time Entry Match", True, "Retrieved screenshot matches time entry ID")
                        else:
                            self.log_result("Screenshot Time Entry Match", False, "Time entry ID mismatch")
                        
                        self.log_result("Screenshot Retrieval", True, f"Successfully retrieved {len(data)} screenshot(s)")
                    else:
                        self.log_result("Screenshot Retrieval", False, "No screenshots found for time entry")
                else:
                    self.log_result("Screenshot Retrieval", False, f"Expected array, got {type(data)}")
            else:
                self.log_result("Screenshot Retrieval", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Screenshot Retrieval", False, f"Exception: {str(e)}")
    
    def test_activity_logs_upload(self):
        """5. Test Activity Logs Upload using POST /api/activity-logs"""
        print("\n=== 5. Test Activity Logs Upload ===")
        
        if not self.admin_token or not self.test_time_entry_id:
            self.log_result("Activity Logs Upload Test", False, "Missing admin token or time entry ID")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            activity_data = {
                "time_entry_id": self.test_time_entry_id,
                "mouse_clicks": 250,
                "keyboard_strokes": 150,
                "active_window_title": "Test Application - Screenshot Testing",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            response = self.session.post(f"{API_BASE}/activity-logs", json=activity_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                activity_log = data.get('activity_log', {})
                
                # Verify activity log was saved to database
                if activity_log.get('id'):
                    self.log_result("Activity Log Database Record", True, f"Activity log record created with ID: {activity_log.get('id')}")
                else:
                    self.log_result("Activity Log Database Record", False, "No activity log ID in response")
                
                # Verify field values
                if (activity_log.get('mouse_clicks') == 250 and 
                    activity_log.get('keyboard_strokes') == 150):
                    self.log_result("Activity Log Values", True, "Mouse clicks and keyboard strokes correctly stored")
                else:
                    self.log_result("Activity Log Values", False, 
                                  f"Incorrect values - mouse: {activity_log.get('mouse_clicks')}, keyboard: {activity_log.get('keyboard_strokes')}")
                
                self.log_result("Activity Logs Upload", True, "Activity log upload completed successfully")
            else:
                self.log_result("Activity Logs Upload", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Activity Logs Upload", False, f"Exception: {str(e)}")
    
    def test_activity_logs_retrieval(self):
        """6. Test Activity Logs Retrieval using GET /api/activity-logs"""
        print("\n=== 6. Test Activity Logs Retrieval ===")
        
        if not self.admin_token or not self.test_time_entry_id:
            self.log_result("Activity Logs Retrieval Test", False, "Missing admin token or time entry ID")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            # Test retrieval by time_entry_id
            params = {"time_entry_id": self.test_time_entry_id}
            response = self.session.get(f"{API_BASE}/activity-logs", params=params, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    if len(data) > 0:
                        activity_log = data[0]
                        
                        # Verify all required fields are present
                        required_fields = ['id', 'time_entry_id', 'user_id', 'task_id', 'project_id', 'mouse_clicks', 'keyboard_strokes', 'timestamp']
                        missing_fields = [field for field in required_fields if field not in activity_log]
                        
                        if not missing_fields:
                            self.log_result("Activity Log Retrieval Fields", True, "All required fields present in retrieved activity log")
                        else:
                            self.log_result("Activity Log Retrieval Fields", False, f"Missing fields: {missing_fields}")
                        
                        # Verify time_entry_id matches
                        if activity_log.get('time_entry_id') == self.test_time_entry_id:
                            self.log_result("Activity Log Time Entry Match", True, "Retrieved activity log matches time entry ID")
                        else:
                            self.log_result("Activity Log Time Entry Match", False, "Time entry ID mismatch")
                        
                        self.log_result("Activity Logs Retrieval", True, f"Successfully retrieved {len(data)} activity log(s)")
                    else:
                        self.log_result("Activity Logs Retrieval", False, "No activity logs found for time entry")
                else:
                    self.log_result("Activity Logs Retrieval", False, f"Expected array, got {type(data)}")
            else:
                self.log_result("Activity Logs Retrieval", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Activity Logs Retrieval", False, f"Exception: {str(e)}")
    
    def test_time_entry_user_detail(self):
        """7. Test Time Entry User Detail includes screenshots and activity_logs"""
        print("\n=== 7. Test Time Entry User Detail ===")
        
        if not self.admin_token:
            self.log_result("Time Entry User Detail Test", False, "No admin token available")
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        try:
            # Get current user ID
            me_response = self.session.get(f"{API_BASE}/auth/me", headers=headers)
            if me_response.status_code != 200:
                self.log_result("Get User ID", False, "Failed to get current user")
                return
            
            user_data = me_response.json()
            user_id = user_data.get('id')
            
            # Get today's date
            today = datetime.now().strftime('%Y-%m-%d')
            
            # Get user detail for today
            params = {"user_id": user_id, "date": today}
            response = self.session.get(f"{API_BASE}/time-entries/user-detail", params=params, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                if 'user' in data and 'time_entries' in data:
                    time_entries = data.get('time_entries', [])
                    
                    # Find our test time entry
                    our_entry = next((e for e in time_entries if e.get('id') == self.test_time_entry_id), None)
                    
                    if our_entry:
                        self.log_result("User Detail Entry Found", True, "Test time entry found in user detail response")
                        
                        # Verify screenshots array is included
                        if 'screenshots' in our_entry:
                            screenshots = our_entry['screenshots']
                            if len(screenshots) > 0:
                                self.log_result("User Detail Screenshots", True, f"Screenshots array included with {len(screenshots)} item(s)")
                            else:
                                self.log_result("User Detail Screenshots", True, "Screenshots array included (empty)")
                        else:
                            self.log_result("User Detail Screenshots", False, "Screenshots array missing from time entry")
                        
                        # Verify activity_logs array is included
                        if 'activity_logs' in our_entry:
                            activity_logs = our_entry['activity_logs']
                            if len(activity_logs) > 0:
                                self.log_result("User Detail Activity Logs", True, f"Activity logs array included with {len(activity_logs)} item(s)")
                            else:
                                self.log_result("User Detail Activity Logs", True, "Activity logs array included (empty)")
                        else:
                            self.log_result("User Detail Activity Logs", False, "Activity logs array missing from time entry")
                        
                        # Verify calculated totals
                        if 'total_mouse_clicks' in our_entry and 'total_keyboard_strokes' in our_entry:
                            total_mouse = our_entry.get('total_mouse_clicks', 0)
                            total_keyboard = our_entry.get('total_keyboard_strokes', 0)
                            self.log_result("User Detail Calculated Totals", True, 
                                          f"Totals calculated - mouse: {total_mouse}, keyboard: {total_keyboard}")
                        else:
                            self.log_result("User Detail Calculated Totals", False, "Total mouse clicks or keyboard strokes missing")
                        
                        self.log_result("Time Entry User Detail", True, "User detail endpoint includes all required data")
                    else:
                        self.log_result("User Detail Entry Found", False, "Test time entry not found in user detail response")
                else:
                    self.log_result("Time Entry User Detail", False, "Missing user or time_entries in response")
            else:
                self.log_result("Time Entry User Detail", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Time Entry User Detail", False, f"Exception: {str(e)}")
    
    def check_file_system(self):
        """8. Check File System - List files and check permissions"""
        print("\n=== 8. Check File System ===")
        
        screenshots_dir = Path("/app/backend/uploads/screenshots/")
        
        try:
            if screenshots_dir.exists():
                self.log_result("Screenshots Directory Exists", True, f"Directory found: {screenshots_dir}")
                
                # List screenshot files
                screenshot_files = list(screenshots_dir.glob("*.png"))
                if screenshot_files:
                    self.log_result("Screenshot Files Exist", True, f"Found {len(screenshot_files)} screenshot files")
                    
                    # Check permissions on first few files
                    for i, file_path in enumerate(screenshot_files[:3]):
                        if file_path.is_file():
                            file_size = file_path.stat().st_size
                            readable = os.access(file_path, os.R_OK)
                            
                            if readable and file_size > 0:
                                self.log_result(f"File {i+1} Permissions", True, f"{file_path.name} - Size: {file_size} bytes, Readable: {readable}")
                            else:
                                self.log_result(f"File {i+1} Permissions", False, f"{file_path.name} - Size: {file_size} bytes, Readable: {readable}")
                else:
                    self.log_result("Screenshot Files Exist", False, "No screenshot files found in directory")
            else:
                self.log_result("Screenshots Directory Exists", False, f"Directory not found: {screenshots_dir}")
                
        except Exception as e:
            self.log_result("Check File System", False, f"Exception: {str(e)}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("SCREENSHOT AND ACTIVITY LOG TESTING SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
                    if result['details']:
                        print(f"    Details: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result['success']:
                print(f"  - {result['test']}: {result['message']}")
        
        print("\n" + "="*80)
    
    def run_all_tests(self):
        """Run all screenshot and activity log tests as requested"""
        print("🚀 Starting Screenshot and Activity Log Testing")
        print("Testing as requested in review:")
        print("1. Login with admin@millionaze.com / admin123")
        print("2. Create time entry for testing")
        print("3. Upload test screenshot using POST /api/time-screenshots/upload")
        print("4. Verify screenshot saved to /app/backend/uploads/screenshots/")
        print("5. Verify screenshot record in database")
        print("6. Test retrieval using GET /api/time-screenshots?time_entry_id={id}")
        print("7. Upload activity log using POST /api/activity-logs")
        print("8. Verify activity log saved to database")
        print("9. Test retrieval using GET /api/activity-logs?time_entry_id={id}")
        print("10. Test GET /api/time-entries/user-detail includes screenshots and activity_logs")
        print("11. Check file system and permissions")
        print("="*80)
        
        # Run tests in sequence
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return
        
        if not self.create_time_entry_for_testing():
            print("❌ Cannot proceed without time entry")
            return
        
        self.test_screenshot_upload()
        self.test_screenshot_retrieval()
        self.test_activity_logs_upload()
        self.test_activity_logs_retrieval()
        self.test_time_entry_user_detail()
        self.check_file_system()
        
        # Print summary
        self.print_summary()

if __name__ == "__main__":
    tester = ScreenshotActivityTester()
    tester.run_all_tests()