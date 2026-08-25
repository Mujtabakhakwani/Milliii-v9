#!/usr/bin/env python3
"""
OTP Password Reset Flow Testing for Millionaze Project Management App
Tests the complete OTP-based password reset functionality
"""

import requests
import json
import sys
import time
from datetime import datetime
from pymongo import MongoClient

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

class OTPPasswordResetTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.test_email = "admin@millionaze.com"
        self.original_password = "admin123"
        self.new_password = "newpassword123"
        self.otp_code = None
        
        # MongoDB connection
        try:
            self.mongo_client = MongoClient(MONGO_URL)
            self.db = self.mongo_client[DB_NAME]
            print(f"✅ Connected to MongoDB: {DB_NAME}")
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {str(e)}")
            sys.exit(1)
        
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
    
    def test_step_1_verify_user_exists(self):
        """Step 1: Verify the test user exists and can login with original password"""
        print("\n=== Step 1: Verify User Exists ===")
        
        try:
            login_data = {
                "email": self.test_email,
                "password": self.original_password
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("User Exists and Can Login", True, 
                              f"User {self.test_email} exists and can login with original password")
                return True
            else:
                self.log_result("User Exists and Can Login", False, 
                              f"Failed to login with original password: {response.status_code}", 
                              response.text)
                return False
                
        except Exception as e:
            self.log_result("User Exists and Can Login", False, f"Exception: {str(e)}")
            return False
    
    def test_step_2_request_otp(self):
        """Step 2: Request OTP via POST /api/auth/forgot-password"""
        print("\n=== Step 2: Request Password Reset OTP ===")
        
        try:
            request_data = {
                "email": self.test_email
            }
            
            response = self.session.post(f"{API_BASE}/auth/forgot-password", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if data.get('success') == True and 'message' in data:
                    self.log_result("Request OTP", True, 
                                  f"OTP request successful: {data.get('message')}")
                    return True
                else:
                    self.log_result("Request OTP", False, 
                                  f"Unexpected response structure", data)
                    return False
            else:
                self.log_result("Request OTP", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Request OTP", False, f"Exception: {str(e)}")
            return False
    
    def test_step_3_retrieve_otp_from_database(self):
        """Step 3: Retrieve OTP from MongoDB password_reset_otps collection"""
        print("\n=== Step 3: Retrieve OTP from Database ===")
        
        try:
            # Query the password_reset_otps collection
            otp_entry = self.db.password_reset_otps.find_one(
                {"email": self.test_email},
                sort=[("created_at", -1)]  # Get the most recent OTP
            )
            
            if otp_entry:
                self.otp_code = otp_entry.get('otp')
                
                if self.otp_code:
                    self.log_result("Retrieve OTP from Database", True, 
                                  f"OTP retrieved from database: {self.otp_code}")
                    
                    # Verify OTP structure
                    if len(self.otp_code) == 6 and self.otp_code.isdigit():
                        self.log_result("OTP Format Validation", True, 
                                      "OTP is 6-digit numeric code")
                    else:
                        self.log_result("OTP Format Validation", False, 
                                      f"OTP format incorrect: {self.otp_code}")
                    
                    # Check other fields
                    required_fields = ['user_id', 'email', 'otp', 'expires_at', 'verified']
                    missing_fields = [field for field in required_fields if field not in otp_entry]
                    
                    if not missing_fields:
                        self.log_result("OTP Database Fields", True, 
                                      "All required fields present in database")
                    else:
                        self.log_result("OTP Database Fields", False, 
                                      f"Missing fields: {missing_fields}")
                    
                    # Check verified status
                    if otp_entry.get('verified') == False:
                        self.log_result("OTP Initial Verified Status", True, 
                                      "OTP verified status is False (as expected)")
                    else:
                        self.log_result("OTP Initial Verified Status", False, 
                                      f"OTP verified status is {otp_entry.get('verified')}, expected False")
                    
                    return True
                else:
                    self.log_result("Retrieve OTP from Database", False, 
                                  "OTP field is empty in database")
                    return False
            else:
                self.log_result("Retrieve OTP from Database", False, 
                              f"No OTP entry found for {self.test_email}")
                return False
                
        except Exception as e:
            self.log_result("Retrieve OTP from Database", False, f"Exception: {str(e)}")
            return False
    
    def test_step_4_verify_otp(self):
        """Step 4: Verify OTP via POST /api/auth/verify-otp"""
        print("\n=== Step 4: Verify OTP ===")
        
        if not self.otp_code:
            self.log_result("Verify OTP", False, "No OTP code available")
            return False
        
        try:
            verify_data = {
                "email": self.test_email,
                "otp": self.otp_code
            }
            
            response = self.session.post(f"{API_BASE}/auth/verify-otp", json=verify_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if data.get('verified') == True and data.get('message') == "OTP verified successfully":
                    self.log_result("Verify OTP", True, 
                                  f"OTP verified successfully: {data.get('message')}")
                    
                    # Verify in database that verified flag is now True
                    otp_entry = self.db.password_reset_otps.find_one(
                        {"email": self.test_email, "otp": self.otp_code}
                    )
                    
                    if otp_entry and otp_entry.get('verified') == True:
                        self.log_result("OTP Verified Flag in Database", True, 
                                      "OTP verified flag updated to True in database")
                    else:
                        self.log_result("OTP Verified Flag in Database", False, 
                                      "OTP verified flag not updated in database")
                    
                    return True
                else:
                    self.log_result("Verify OTP", False, 
                                  f"Unexpected response", data)
                    return False
            else:
                self.log_result("Verify OTP", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Verify OTP", False, f"Exception: {str(e)}")
            return False
    
    def test_step_5_reset_password(self):
        """Step 5: Reset password via POST /api/auth/reset-password-otp"""
        print("\n=== Step 5: Reset Password with OTP ===")
        
        if not self.otp_code:
            self.log_result("Reset Password", False, "No OTP code available")
            return False
        
        try:
            reset_data = {
                "email": self.test_email,
                "otp": self.otp_code,
                "new_password": self.new_password
            }
            
            response = self.session.post(f"{API_BASE}/auth/reset-password-otp", json=reset_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if data.get('success') == True and 'message' in data:
                    self.log_result("Reset Password", True, 
                                  f"Password reset successful: {data.get('message')}")
                    
                    # Verify OTP is deleted from database after successful reset
                    otp_entry = self.db.password_reset_otps.find_one(
                        {"email": self.test_email, "otp": self.otp_code}
                    )
                    
                    if not otp_entry:
                        self.log_result("OTP Cleanup After Reset", True, 
                                      "OTP deleted from database after successful reset")
                    else:
                        self.log_result("OTP Cleanup After Reset", False, 
                                      "OTP still exists in database after reset")
                    
                    return True
                else:
                    self.log_result("Reset Password", False, 
                                  f"Unexpected response", data)
                    return False
            else:
                self.log_result("Reset Password", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Reset Password", False, f"Exception: {str(e)}")
            return False
    
    def test_step_6_login_with_new_password(self):
        """Step 6: Test login with new password"""
        print("\n=== Step 6: Login with New Password ===")
        
        try:
            login_data = {
                "email": self.test_email,
                "password": self.new_password
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if 'access_token' in data and 'user' in data:
                    self.log_result("Login with New Password", True, 
                                  f"Successfully logged in with new password")
                    
                    # Verify user data
                    user = data.get('user', {})
                    if user.get('email') == self.test_email:
                        self.log_result("User Data After Password Reset", True, 
                                      "User data correct after password reset")
                    else:
                        self.log_result("User Data After Password Reset", False, 
                                      f"User email mismatch: {user.get('email')}")
                    
                    return True
                else:
                    self.log_result("Login with New Password", False, 
                                  f"Missing access_token or user in response", data)
                    return False
            else:
                self.log_result("Login with New Password", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Login with New Password", False, f"Exception: {str(e)}")
            return False
    
    def test_step_7_verify_old_password_fails(self):
        """Step 7: Verify old password no longer works"""
        print("\n=== Step 7: Verify Old Password No Longer Works ===")
        
        try:
            login_data = {
                "email": self.test_email,
                "password": self.original_password
            }
            
            response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 401 or response.status_code == 400:
                self.log_result("Old Password Rejected", True, 
                              "Old password correctly rejected after reset")
                return True
            elif response.status_code == 200:
                self.log_result("Old Password Rejected", False, 
                              "Old password still works - password not updated correctly!")
                return False
            else:
                self.log_result("Old Password Rejected", False, 
                              f"Unexpected status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Old Password Rejected", False, f"Exception: {str(e)}")
            return False
    
    def test_step_8_reset_password_back(self):
        """Step 8: Reset password back to original for cleanup"""
        print("\n=== Step 8: Reset Password Back to Original (Cleanup) ===")
        
        try:
            # Request new OTP
            request_data = {"email": self.test_email}
            response = self.session.post(f"{API_BASE}/auth/forgot-password", json=request_data)
            
            if response.status_code != 200:
                self.log_result("Cleanup - Request OTP", False, 
                              f"Failed to request OTP: {response.status_code}")
                return False
            
            time.sleep(1)  # Wait for OTP to be created
            
            # Get new OTP from database
            otp_entry = self.db.password_reset_otps.find_one(
                {"email": self.test_email},
                sort=[("created_at", -1)]
            )
            
            if not otp_entry:
                self.log_result("Cleanup - Retrieve OTP", False, "No OTP found in database")
                return False
            
            new_otp = otp_entry.get('otp')
            
            # Verify OTP
            verify_data = {"email": self.test_email, "otp": new_otp}
            response = self.session.post(f"{API_BASE}/auth/verify-otp", json=verify_data)
            
            if response.status_code != 200:
                self.log_result("Cleanup - Verify OTP", False, 
                              f"Failed to verify OTP: {response.status_code}")
                return False
            
            # Reset password back to original
            reset_data = {
                "email": self.test_email,
                "otp": new_otp,
                "new_password": self.original_password
            }
            response = self.session.post(f"{API_BASE}/auth/reset-password-otp", json=reset_data)
            
            if response.status_code == 200:
                self.log_result("Cleanup - Reset Password Back", True, 
                              "Password reset back to original")
                
                # Verify login with original password works
                login_data = {"email": self.test_email, "password": self.original_password}
                response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
                
                if response.status_code == 200:
                    self.log_result("Cleanup - Verify Original Password Works", True, 
                                  "Original password restored successfully")
                    return True
                else:
                    self.log_result("Cleanup - Verify Original Password Works", False, 
                                  f"Failed to login with original password: {response.status_code}")
                    return False
            else:
                self.log_result("Cleanup - Reset Password Back", False, 
                              f"Failed to reset password: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Cleanup - Reset Password Back", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all OTP password reset tests in sequence"""
        print("\n" + "="*80)
        print("OTP PASSWORD RESET FLOW - COMPREHENSIVE TESTING")
        print("="*80)
        
        # Run tests in sequence
        step1_success = self.test_step_1_verify_user_exists()
        if not step1_success:
            print("\n❌ CRITICAL: User doesn't exist or can't login. Stopping tests.")
            return False
        
        step2_success = self.test_step_2_request_otp()
        if not step2_success:
            print("\n❌ CRITICAL: Failed to request OTP. Stopping tests.")
            return False
        
        time.sleep(1)  # Wait for OTP to be created in database
        
        step3_success = self.test_step_3_retrieve_otp_from_database()
        if not step3_success:
            print("\n❌ CRITICAL: Failed to retrieve OTP from database. Stopping tests.")
            return False
        
        step4_success = self.test_step_4_verify_otp()
        if not step4_success:
            print("\n❌ CRITICAL: Failed to verify OTP. Stopping tests.")
            return False
        
        step5_success = self.test_step_5_reset_password()
        if not step5_success:
            print("\n❌ CRITICAL: Failed to reset password. Stopping tests.")
            return False
        
        step6_success = self.test_step_6_login_with_new_password()
        if not step6_success:
            print("\n❌ CRITICAL: Failed to login with new password. Password reset may not have worked!")
            return False
        
        step7_success = self.test_step_7_verify_old_password_fails()
        
        # Always try cleanup
        step8_success = self.test_step_8_reset_password_back()
        
        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"\nTotal Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n" + "="*80)
        print("DETAILED RESULTS")
        print("="*80)
        
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        # Overall result
        all_critical_passed = (step1_success and step2_success and step3_success and 
                              step4_success and step5_success and step6_success)
        
        print("\n" + "="*80)
        if all_critical_passed:
            print("✅ OTP PASSWORD RESET FLOW: ALL CRITICAL TESTS PASSED")
            print("="*80)
            print("\n✅ The password reset flow is working correctly!")
            print("✅ Password field name mismatch issue is FIXED!")
            return True
        else:
            print("❌ OTP PASSWORD RESET FLOW: SOME CRITICAL TESTS FAILED")
            print("="*80)
            print("\n❌ There are issues with the password reset flow.")
            return False

def main():
    """Main test execution"""
    tester = OTPPasswordResetTester()
    success = tester.run_all_tests()
    
    # Close MongoDB connection
    tester.mongo_client.close()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
