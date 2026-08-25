#!/usr/bin/env python3
"""
Team Members List Endpoint Testing
Testing the specific request about team members dropdown functionality
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class TeamMembersAPITester:
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
        if details and not success:
            print(f"   Details: {details}")
    
    def setup_admin_login(self):
        """Login as admin@millionaze.com / admin123"""
        print("\n=== Admin Login ===")
        
        admin_credentials = {
            "email": "admin@millionaze.com",
            "password": "admin123"
        }
        
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=admin_credentials)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Login", True, f"Successfully logged in as: {data['user']['name']} ({data['user']['email']})")
                return True
            else:
                self.log_result("Admin Login", False, f"Login failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception during login: {str(e)}")
            return False
    
    def test_get_all_users(self):
        """Test GET /api/users - Get all users (should show everyone including admins)"""
        print("\n=== Testing GET /api/users ===")
        
        if not self.admin_token:
            self.log_result("Get All Users", False, "No admin token available")
            return None
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/users", headers=headers)
            
            if response.status_code == 200:
                users = response.json()
                
                if isinstance(users, list):
                    total_count = len(users)
                    self.log_result("Get All Users", True, f"Successfully retrieved {total_count} users")
                    
                    print(f"\n📊 TOTAL COUNT FROM /api/users: {total_count}")
                    print("\n👥 ALL USERS FROM /api/users:")
                    print("=" * 60)
                    
                    maria_found = False
                    for i, user in enumerate(users, 1):
                        name = user.get('name', 'Unknown')
                        email = user.get('email', 'Unknown')
                        role = user.get('role', 'Unknown')
                        
                        print(f"{i:2d}. {name:<25} | {email:<30} | Role: {role}")
                        
                        # Check for Maria
                        if 'maria' in name.lower():
                            maria_found = True
                            print(f"    🔍 FOUND MARIA: Name='{name}', Role='{role}'")
                    
                    print("=" * 60)
                    
                    if maria_found:
                        self.log_result("Maria User Found", True, "Found user named 'Maria' in users list")
                    else:
                        self.log_result("Maria User Found", False, "No user named 'Maria' found in users list")
                    
                    return users
                else:
                    self.log_result("Get All Users", False, f"Expected array, got {type(users)}", users)
                    return None
            else:
                self.log_result("Get All Users", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Get All Users", False, f"Exception: {str(e)}")
            return None
    
    def test_get_team_members_list(self):
        """Test GET /api/team-members-list - Get the team members dropdown list (should show all non-admin users)"""
        print("\n=== Testing GET /api/team-members-list ===")
        
        if not self.admin_token:
            self.log_result("Get Team Members List", False, "No admin token available")
            return None
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/team-members-list", headers=headers)
            
            if response.status_code == 200:
                team_members = response.json()
                
                if isinstance(team_members, list):
                    total_count = len(team_members)
                    self.log_result("Get Team Members List", True, f"Successfully retrieved {total_count} team members")
                    
                    print(f"\n📊 TOTAL COUNT FROM /api/team-members-list: {total_count}")
                    print("\n👥 ALL TEAM MEMBERS FROM /api/team-members-list:")
                    print("=" * 60)
                    
                    maria_found = False
                    admin_found = False
                    
                    for i, member in enumerate(team_members, 1):
                        name = member.get('name', 'Unknown')
                        email = member.get('email', 'Unknown')
                        role = member.get('role', 'Unknown')
                        
                        print(f"{i:2d}. {name:<25} | {email:<30} | Role: {role}")
                        
                        # Check for Maria
                        if 'maria' in name.lower():
                            maria_found = True
                            print(f"    🔍 FOUND MARIA: Name='{name}', Role='{role}'")
                        
                        # Check if any admin users are included (they shouldn't be)
                        if role.lower() == 'admin':
                            admin_found = True
                            print(f"    ⚠️  ADMIN USER FOUND: {name} (should not be in team members list)")
                    
                    print("=" * 60)
                    
                    if maria_found:
                        self.log_result("Maria in Team Members", True, "Found user named 'Maria' in team members list")
                    else:
                        self.log_result("Maria in Team Members", False, "No user named 'Maria' found in team members list")
                    
                    if not admin_found:
                        self.log_result("Admin Users Excluded", True, "No admin users found in team members list (correct behavior)")
                    else:
                        self.log_result("Admin Users Excluded", False, "Admin users found in team members list (should be excluded)")
                    
                    return team_members
                else:
                    self.log_result("Get Team Members List", False, f"Expected array, got {type(team_members)}", team_members)
                    return None
            elif response.status_code == 403:
                self.log_result("Get Team Members List", False, "Access denied (403) - Admin access required", response.text)
                return None
            else:
                self.log_result("Get Team Members List", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Get Team Members List", False, f"Exception: {str(e)}")
            return None
    
    def compare_lists(self, all_users, team_members):
        """Compare the two lists and analyze differences"""
        print("\n=== COMPARISON ANALYSIS ===")
        
        if not all_users or not team_members:
            print("❌ Cannot compare - one or both lists are empty/None")
            return
        
        # Count by role in all users
        all_users_by_role = {}
        for user in all_users:
            role = user.get('role', 'Unknown')
            all_users_by_role[role] = all_users_by_role.get(role, 0) + 1
        
        # Count by role in team members
        team_members_by_role = {}
        for member in team_members:
            role = member.get('role', 'Unknown')
            team_members_by_role[role] = team_members_by_role.get(role, 0) + 1
        
        print(f"\n📊 ROLE DISTRIBUTION:")
        print(f"All Users ({len(all_users)} total):")
        for role, count in all_users_by_role.items():
            print(f"  - {role}: {count}")
        
        print(f"\nTeam Members List ({len(team_members)} total):")
        for role, count in team_members_by_role.items():
            print(f"  - {role}: {count}")
        
        # Find users in all_users but not in team_members
        all_users_emails = {user.get('email') for user in all_users}
        team_members_emails = {member.get('email') for member in team_members}
        
        missing_from_team_list = all_users_emails - team_members_emails
        
        if missing_from_team_list:
            print(f"\n🔍 USERS MISSING FROM TEAM MEMBERS LIST ({len(missing_from_team_list)}):")
            for email in missing_from_team_list:
                user = next((u for u in all_users if u.get('email') == email), None)
                if user:
                    print(f"  - {user.get('name', 'Unknown')} ({email}) - Role: {user.get('role', 'Unknown')}")
        else:
            print(f"\n✅ All users from /api/users are present in /api/team-members-list")
        
        # Check if the difference is exactly the admin users
        admin_users = [u for u in all_users if u.get('role', '').lower() == 'admin']
        admin_emails = {u.get('email') for u in admin_users}
        
        if missing_from_team_list == admin_emails:
            self.log_result("Correct Filtering", True, f"Team members list correctly excludes {len(admin_users)} admin user(s)")
        elif len(missing_from_team_list) == 0:
            self.log_result("Correct Filtering", False, "Team members list includes admin users (should exclude them)")
        else:
            self.log_result("Correct Filtering", False, f"Unexpected filtering - {len(missing_from_team_list)} users missing, but not just admins")
    
    def find_maria_details(self, all_users, team_members):
        """Find and report details about Maria user"""
        print("\n=== MARIA USER ANALYSIS ===")
        
        # Find Maria in all users
        maria_in_all = None
        for user in all_users or []:
            if 'maria' in user.get('name', '').lower():
                maria_in_all = user
                break
        
        # Find Maria in team members
        maria_in_team = None
        for member in team_members or []:
            if 'maria' in member.get('name', '').lower():
                maria_in_team = member
                break
        
        if maria_in_all:
            print(f"✅ Maria found in /api/users:")
            print(f"   Name: {maria_in_all.get('name')}")
            print(f"   Email: {maria_in_all.get('email')}")
            print(f"   Role: {maria_in_all.get('role')}")
            print(f"   ID: {maria_in_all.get('id')}")
        else:
            print("❌ Maria NOT found in /api/users")
        
        if maria_in_team:
            print(f"✅ Maria found in /api/team-members-list:")
            print(f"   Name: {maria_in_team.get('name')}")
            print(f"   Email: {maria_in_team.get('email')}")
            print(f"   Role: {maria_in_team.get('role')}")
            print(f"   ID: {maria_in_team.get('id')}")
        else:
            print("❌ Maria NOT found in /api/team-members-list")
        
        # Analysis
        if maria_in_all and not maria_in_team:
            role = maria_in_all.get('role', 'Unknown')
            if role.lower() == 'admin':
                print(f"💡 EXPLANATION: Maria is not in team members list because she has 'admin' role")
                print(f"   The /api/team-members-list endpoint excludes admin users by design")
            else:
                print(f"⚠️  ISSUE: Maria should be in team members list (role: {role}) but is missing")
        elif maria_in_all and maria_in_team:
            print(f"✅ Maria appears in both lists as expected")
        elif not maria_in_all:
            print(f"❌ Maria doesn't exist in the system at all")
    
    def run_tests(self):
        """Run all tests"""
        print("🚀 Starting Team Members List Endpoint Testing")
        print("=" * 60)
        
        # Step 1: Login as admin
        if not self.setup_admin_login():
            print("❌ Cannot proceed without admin login")
            return
        
        # Step 2: Test GET /api/users
        all_users = self.test_get_all_users()
        
        # Step 3: Test GET /api/team-members-list
        team_members = self.test_get_team_members_list()
        
        # Step 4: Compare and analyze
        self.compare_lists(all_users, team_members)
        
        # Step 5: Find Maria specifically
        self.find_maria_details(all_users, team_members)
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        print(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed")
        
        if all_users and team_members:
            print(f"\n📊 FINAL COUNTS:")
            print(f"   Total users (/api/users): {len(all_users)}")
            print(f"   Team members (/api/team-members-list): {len(team_members)}")
            print(f"   Difference: {len(all_users) - len(team_members)} users")

if __name__ == "__main__":
    tester = TeamMembersAPITester()
    tester.run_tests()