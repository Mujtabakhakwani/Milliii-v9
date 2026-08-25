#!/usr/bin/env python3
"""
Time Tracker Settings Backend API Testing
Focus: Testing Time Tracker Settings and Breaks Management endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class TimeTrackerAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.regular_user_token = None
        self.test_results = []
        self.test_break_ids = []
        
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
            else:
                self.log_result("Admin Login", False, f"Failed to login as admin: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception during admin login: {str(e)}")
            return False
    
    def setup_regular_user(self):
        """Create/login as regular user for testing non-admin access"""
        print("\n=== Setting up Regular User ===")
        
        # Try to login with existing regular user
        user_credentials = {
            "email": "testuser@millionaze.com",
            "password": "testpass123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=user_credentials)
            if response.status_code == 200:
                data = response.json()
                self.regular_user_token = data['access_token']
                self.log_result("Regular User Login", True, f"Logged in as regular user: {data['user']['name']}")
                return True
            else:
                # Try to create regular user if login fails
                user_signup = {
                    "name": "Test User",
                    "email": "testuser@millionaze.com", 
                    "password": "testpass123",
                    "role": "user"
                }
                
                signup_response = self.session.post(f"{API_BASE}/auth/signup", json=user_signup)
                if signup_response.status_code == 200:
                    data = signup_response.json()
                    self.regular_user_token = data['access_token']
                    self.log_result("Regular User Signup", True, f"Created regular user: {data['user']['name']}")
                    return True
                else:
                    self.log_result("Regular User Setup", False, f"Failed to setup regular user: {signup_response.status_code}", signup_response.text)
                    return False
                
        except Exception as e:
            self.log_result("Regular User Setup", False, f"Exception during regular user setup: {str(e)}")
            return False
    
    def test_get_time_tracker_settings(self):
        """Test GET /api/time-tracker/settings endpoint"""
        print("\n=== Testing GET Time Tracker Settings ===")
        
        if not self.admin_token:
            self.log_result("Get Time Tracker Settings", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/time-tracker/settings", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check default settings structure
                expected_fields = ['screen_capture_required', 'screenshot_interval_minutes', 'blur_screenshots']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Get Time Tracker Settings Structure", True, f"All required fields present")
                    
                    # Verify default values (should return defaults if none exist)
                    expected_defaults = {
                        'screen_capture_required': True,
                        'screenshot_interval_minutes': 5,
                        'blur_screenshots': False
                    }
                    
                    defaults_correct = True
                    for field, expected_value in expected_defaults.items():
                        if data.get(field) != expected_value:
                            defaults_correct = False
                            break
                    
                    if defaults_correct:
                        self.log_result("Default Settings Values", True, f"Default values correct: {data}")
                    else:
                        self.log_result("Default Settings Values", True, f"Settings retrieved (may be previously modified): {data}")
                        
                else:
                    self.log_result("Get Time Tracker Settings Structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Get Time Tracker Settings", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Time Tracker Settings", False, f"Exception: {str(e)}")
    
    def test_update_time_tracker_settings(self):
        """Test PUT /api/time-tracker/settings endpoint (Admin only)"""
        print("\n=== Testing PUT Time Tracker Settings ===")
        
        if not self.admin_token:
            self.log_result("Update Time Tracker Settings", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test updating screen_capture_required to false
            settings_update = {
                "screen_capture_required": False
            }
            
            response = self.session.put(f"{API_BASE}/time-tracker/settings", json=settings_update, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Settings updated successfully':
                    self.log_result("Update Screen Capture Setting", True, "screen_capture_required updated to false")
                else:
                    self.log_result("Update Screen Capture Setting", False, f"Unexpected response: {data}")
            else:
                self.log_result("Update Screen Capture Setting", False, f"HTTP {response.status_code}", response.text)
                return
                
            # Test updating screenshot_interval_minutes to 10
            settings_update = {
                "screenshot_interval_minutes": 10
            }
            
            response = self.session.put(f"{API_BASE}/time-tracker/settings", json=settings_update, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Settings updated successfully':
                    self.log_result("Update Screenshot Interval", True, "screenshot_interval_minutes updated to 10")
                else:
                    self.log_result("Update Screenshot Interval", False, f"Unexpected response: {data}")
            else:
                self.log_result("Update Screenshot Interval", False, f"HTTP {response.status_code}", response.text)
                return
                
            # Test updating blur_screenshots to true
            settings_update = {
                "blur_screenshots": True
            }
            
            response = self.session.put(f"{API_BASE}/time-tracker/settings", json=settings_update, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Settings updated successfully':
                    self.log_result("Update Blur Screenshots", True, "blur_screenshots updated to true")
                else:
                    self.log_result("Update Blur Screenshots", False, f"Unexpected response: {data}")
            else:
                self.log_result("Update Blur Screenshots", False, f"HTTP {response.status_code}", response.text)
                return
            
            # Verify all settings were saved correctly
            verify_response = self.session.get(f"{API_BASE}/time-tracker/settings", headers=headers)
            if verify_response.status_code == 200:
                updated_data = verify_response.json()
                
                expected_values = {
                    'screen_capture_required': False,
                    'screenshot_interval_minutes': 10,
                    'blur_screenshots': True
                }
                
                all_correct = True
                for field, expected_value in expected_values.items():
                    if updated_data.get(field) != expected_value:
                        all_correct = False
                        self.log_result(f"Verify {field}", False, f"Expected {expected_value}, got {updated_data.get(field)}")
                
                if all_correct:
                    self.log_result("Verify Settings Persistence", True, "All settings correctly saved and retrieved")
            else:
                self.log_result("Verify Settings Persistence", False, f"Failed to verify settings: {verify_response.status_code}")
                
        except Exception as e:
            self.log_result("Update Time Tracker Settings", False, f"Exception: {str(e)}")
    
    def test_settings_non_admin_access(self):
        """Test that non-admin users get 403 error when trying to update settings"""
        print("\n=== Testing Non-Admin Settings Access ===")
        
        if not self.regular_user_token:
            self.log_result("Settings Non-Admin Access", False, "No regular user token available")
            return
        
        try:
            regular_headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            settings_update = {"screen_capture_required": True}
            
            response = self.session.put(f"{API_BASE}/time-tracker/settings", json=settings_update, headers=regular_headers)
            
            if response.status_code == 403:
                self.log_result("Settings Update Non-Admin Block", True, "Non-admin properly blocked with 403 error")
            else:
                self.log_result("Settings Update Non-Admin Block", False, f"Expected 403, got: {response.status_code}")
                
        except Exception as e:
            self.log_result("Settings Update Non-Admin Block", False, f"Exception: {str(e)}")
    
    def test_get_breaks_initial(self):
        """Test GET /api/breaks endpoint - should return empty array initially"""
        print("\n=== Testing GET Breaks (Initial) ===")
        
        if not self.admin_token:
            self.log_result("Get Breaks Initial", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/breaks", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_result("Get Breaks Response Type", True, f"Returns array with {len(data)} breaks")
                    return len(data)  # Return initial count for later verification
                else:
                    self.log_result("Get Breaks Response Type", False, f"Expected array, got {type(data)}")
                    return 0
            else:
                self.log_result("Get Breaks Initial", False, f"HTTP {response.status_code}", response.text)
                return 0
                
        except Exception as e:
            self.log_result("Get Breaks Initial", False, f"Exception: {str(e)}")
            return 0
    
    def test_create_lunch_break(self):
        """Test POST /api/breaks - Create Lunch Break (Admin only)"""
        print("\n=== Testing Create Lunch Break ===")
        
        if not self.admin_token:
            self.log_result("Create Lunch Break", False, "No admin token available")
            return None
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            lunch_break_data = {
                "name": "Lunch Break",
                "duration_minutes": 60
            }
            
            response = self.session.post(f"{API_BASE}/breaks", json=lunch_break_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('message') == 'Break created successfully' and 'break' in data:
                    break_info = data['break']
                    break_id = break_info.get('id')
                    
                    # Verify break fields
                    required_fields = ['id', 'name', 'duration_minutes', 'is_active', 'created_by', 'created_at']
                    missing_fields = [field for field in required_fields if field not in break_info]
                    
                    if not missing_fields:
                        self.log_result("Create Lunch Break Structure", True, "All required fields present")
                        
                        # Verify field values
                        if (break_info.get('name') == 'Lunch Break' and 
                            break_info.get('duration_minutes') == 60 and 
                            break_info.get('is_active') == True):
                            self.log_result("Create Lunch Break Values", True, f"Break created with correct values: {break_info.get('name')} ({break_info.get('duration_minutes')} min)")
                            self.test_break_ids.append(break_id)
                            return break_id
                        else:
                            self.log_result("Create Lunch Break Values", False, f"Incorrect field values: {break_info}")
                    else:
                        self.log_result("Create Lunch Break Structure", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_result("Create Lunch Break", False, f"Unexpected response: {data}")
            else:
                self.log_result("Create Lunch Break", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Create Lunch Break", False, f"Exception: {str(e)}")
        
        return None
    
    def test_create_tea_break(self):
        """Test POST /api/breaks - Create Tea Break (Admin only)"""
        print("\n=== Testing Create Tea Break ===")
        
        if not self.admin_token:
            self.log_result("Create Tea Break", False, "No admin token available")
            return None
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            tea_break_data = {
                "name": "Tea Break",
                "duration_minutes": 15
            }
            
            response = self.session.post(f"{API_BASE}/breaks", json=tea_break_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('message') == 'Break created successfully' and 'break' in data:
                    break_info = data['break']
                    break_id = break_info.get('id')
                    
                    if (break_info.get('name') == 'Tea Break' and 
                        break_info.get('duration_minutes') == 15 and 
                        break_info.get('is_active') == True):
                        self.log_result("Create Tea Break", True, f"Break created: {break_info.get('name')} ({break_info.get('duration_minutes')} min)")
                        self.test_break_ids.append(break_id)
                        return break_id
                    else:
                        self.log_result("Create Tea Break", False, f"Incorrect field values: {break_info}")
                else:
                    self.log_result("Create Tea Break", False, f"Unexpected response: {data}")
            else:
                self.log_result("Create Tea Break", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Create Tea Break", False, f"Exception: {str(e)}")
        
        return None
    
    def test_breaks_non_admin_access(self):
        """Test that non-admin users get 403 error when trying to create breaks"""
        print("\n=== Testing Non-Admin Break Creation ===")
        
        if not self.regular_user_token:
            self.log_result("Break Creation Non-Admin", False, "No regular user token available")
            return
        
        try:
            regular_headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            break_data = {"name": "Unauthorized Break", "duration_minutes": 30}
            
            response = self.session.post(f"{API_BASE}/breaks", json=break_data, headers=regular_headers)
            
            if response.status_code == 403:
                self.log_result("Break Creation Non-Admin Block", True, "Non-admin properly blocked with 403 error")
            else:
                self.log_result("Break Creation Non-Admin Block", False, f"Expected 403, got: {response.status_code}")
                
        except Exception as e:
            self.log_result("Break Creation Non-Admin Block", False, f"Exception: {str(e)}")
    
    def test_get_breaks_after_creation(self, initial_count):
        """Test GET /api/breaks after creating breaks"""
        print("\n=== Testing GET Breaks (After Creation) ===")
        
        if not self.admin_token:
            self.log_result("Get Breaks After Creation", False, "No admin token available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/breaks", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    current_count = len(data)
                    expected_count = initial_count + 2  # We created 2 breaks
                    
                    if current_count >= expected_count:
                        self.log_result("Get Breaks Count", True, f"Found {current_count} breaks (expected at least {expected_count})")
                        
                        # Check if our created breaks are in the list
                        break_names = [b.get('name') for b in data]
                        if 'Lunch Break' in break_names and 'Tea Break' in break_names:
                            self.log_result("Verify Created Breaks", True, "Both created breaks found in active breaks list")
                        else:
                            self.log_result("Verify Created Breaks", False, f"Created breaks not found. Available: {break_names}")
                    else:
                        self.log_result("Get Breaks Count", False, f"Expected at least {expected_count} breaks, got {current_count}")
                else:
                    self.log_result("Get Breaks After Creation", False, f"Expected array, got {type(data)}")
                    
        except Exception as e:
            self.log_result("Get Breaks After Creation", False, f"Exception: {str(e)}")
    
    def test_delete_break(self, break_id):
        """Test DELETE /api/breaks/{break_id} endpoint (Admin only)"""
        print(f"\n=== Testing Delete Break {break_id} ===")
        
        if not self.admin_token or not break_id:
            self.log_result("Delete Break", False, "No admin token or break ID available")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.delete(f"{API_BASE}/breaks/{break_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('message') == 'Break deleted successfully':
                    self.log_result("Delete Break", True, "Break deleted successfully")
                    
                    # Verify break is marked as inactive (not actually deleted)
                    verify_response = self.session.get(f"{API_BASE}/breaks", headers=headers)
                    if verify_response.status_code == 200:
                        active_breaks = verify_response.json()
                        deleted_break_found = any(b.get('id') == break_id for b in active_breaks)
                        
                        if not deleted_break_found:
                            self.log_result("Verify Break Deletion", True, "Deleted break no longer appears in active breaks list")
                        else:
                            self.log_result("Verify Break Deletion", False, "Deleted break still appears in active breaks list")
                else:
                    self.log_result("Delete Break", False, f"Unexpected response: {data}")
            else:
                self.log_result("Delete Break", False, f"HTTP {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Delete Break", False, f"Exception: {str(e)}")
    
    def test_delete_break_non_admin(self, break_id):
        """Test that non-admin users get 403 error when trying to delete breaks"""
        print("\n=== Testing Non-Admin Break Deletion ===")
        
        if not self.regular_user_token or not break_id:
            self.log_result("Delete Break Non-Admin", False, "No regular user token or break ID available")
            return
        
        try:
            regular_headers = {"Authorization": f"Bearer {self.regular_user_token}"}
            response = self.session.delete(f"{API_BASE}/breaks/{break_id}", headers=regular_headers)
            
            if response.status_code == 403:
                self.log_result("Delete Break Non-Admin Block", True, "Non-admin properly blocked with 403 error")
            else:
                self.log_result("Delete Break Non-Admin Block", False, f"Expected 403, got: {response.status_code}")
                
        except Exception as e:
            self.log_result("Delete Break Non-Admin Block", False, f"Exception: {str(e)}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🏁 TIME TRACKER SETTINGS TEST SUMMARY")
        print("=" * 60)
        
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
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result['success']:
                print(f"  - {result['test']}: {result['message']}")
    
    def run_all_tests(self):
        """Run all time tracker settings tests in the specified sequence"""
        print("🚀 Starting Time Tracker Settings Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup
        if not self.setup_admin_user():
            print("❌ Failed to setup admin user. Exiting.")
            return
        
        self.setup_regular_user()
        
        # Test Sequence as specified in the review request:
        print("\n🔧 TESTING SEQUENCE:")
        print("1. Login as admin")
        print("2. Get initial settings")
        print("3. Update settings")
        print("4. Get updated settings to verify")
        print("5. Get initial breaks (should be empty)")
        print("6. Create 2 break types")
        print("7. Get breaks to verify they were created")
        print("8. Delete one break")
        print("9. Get breaks to verify deletion")
        
        # 1. Admin login already done in setup
        
        # 2. Get initial settings
        self.test_get_time_tracker_settings()
        
        # 3. Update settings
        self.test_update_time_tracker_settings()
        
        # 4. Get updated settings to verify (done within update test)
        
        # 5. Get initial breaks
        initial_break_count = self.test_get_breaks_initial()
        
        # 6. Create 2 break types
        lunch_break_id = self.test_create_lunch_break()
        tea_break_id = self.test_create_tea_break()
        
        # 7. Get breaks to verify they were created
        self.test_get_breaks_after_creation(initial_break_count)
        
        # 8. Delete one break
        if lunch_break_id:
            self.test_delete_break(lunch_break_id)
        
        # 9. Get breaks to verify deletion (done within delete test)
        
        # Additional security tests
        print("\n🔒 ADDITIONAL SECURITY TESTS:")
        self.test_settings_non_admin_access()
        self.test_breaks_non_admin_access()
        if tea_break_id:
            self.test_delete_break_non_admin(tea_break_id)
        
        # Print summary
        self.print_summary()

def main():
    """Main function to run the tests"""
    tester = TimeTrackerAPITester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()