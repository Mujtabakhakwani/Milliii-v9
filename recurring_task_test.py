#!/usr/bin/env python3
"""
Recurring Task System Testing for Millionaze Project Management App
Focus: Testing timezone conversion and automatic task generation
"""

import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta
import pymongo

# Configuration
BACKEND_URL = "https://project-scanner-10.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Database connection for direct verification
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

class RecurringTaskTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
        # MongoDB connection for direct database verification
        try:
            self.mongo_client = pymongo.MongoClient(MONGO_URL)
            self.db = self.mongo_client[DB_NAME]
            print("✅ Connected to MongoDB for direct database verification")
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            self.mongo_client = None
            self.db = None
        
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
    
    def get_current_utc_time(self):
        """Get current UTC time and log it"""
        print("\n=== Getting Current UTC Time ===")
        
        current_utc = datetime.now(timezone.utc)
        current_utc_str = current_utc.strftime('%Y-%m-%d %H:%M:%S UTC')
        current_time_only = current_utc.strftime('%H:%M')
        
        self.log_result("Current UTC Time", True, f"Current UTC time: {current_utc_str}")
        self.log_result("Current Time (HH:MM)", True, f"Current time for scheduling: {current_time_only}")
        
        return current_utc, current_time_only
    
    def verify_existing_recurring_tasks(self):
        """Verify existing recurring tasks in database (should have 4 tasks)"""
        print("\n=== Verifying Existing Recurring Tasks ===")
        
        if not self.admin_token:
            self.log_result("Verify Recurring Tasks", False, "No admin token available")
            return []
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{API_BASE}/recurring-tasks", headers=headers)
            
            if response.status_code == 200:
                recurring_tasks = response.json()
                
                if isinstance(recurring_tasks, list):
                    task_count = len(recurring_tasks)
                    self.log_result("Recurring Tasks Count", True, f"Found {task_count} recurring tasks in database")
                    
                    # Log details of each task
                    for i, task in enumerate(recurring_tasks, 1):
                        task_info = f"Task {i}: '{task.get('title')}' (ID: {task.get('id')[:8]}...) - Schedule: {task.get('recurrence_time', 'N/A')} UTC, Frequency: {task.get('recurrence_frequency', 'N/A')}, Last Generated: {task.get('last_generated', 'Never')}"
                        self.log_result(f"Task {i} Details", True, task_info)
                    
                    # Verify we have the expected 4 tasks
                    if task_count == 4:
                        self.log_result("Expected Task Count", True, "Found exactly 4 recurring tasks as expected")
                    else:
                        self.log_result("Expected Task Count", False, f"Expected 4 recurring tasks, found {task_count}")
                    
                    return recurring_tasks
                else:
                    self.log_result("Recurring Tasks Response", False, f"Expected list, got {type(recurring_tasks)}")
                    return []
            else:
                self.log_result("Get Recurring Tasks", False, f"HTTP {response.status_code}", response.text)
                return []
                
        except Exception as e:
            self.log_result("Verify Recurring Tasks", False, f"Exception: {str(e)}")
            return []
    
    def update_recurring_task_schedule(self, recurring_tasks, current_utc):
        """Update one recurring task to trigger in the next 2-3 minutes"""
        print("\n=== Updating Recurring Task Schedule ===")
        
        if not recurring_tasks:
            self.log_result("Update Task Schedule", False, "No recurring tasks available to update")
            return None
        
        if not self.admin_token:
            self.log_result("Update Task Schedule", False, "No admin token available")
            return None
        
        # Select the first active recurring task
        target_task = None
        for task in recurring_tasks:
            if task.get('is_active', True):
                target_task = task
                break
        
        if not target_task:
            self.log_result("Select Target Task", False, "No active recurring task found")
            return None
        
        # Calculate trigger time (current UTC + 2 minutes)
        trigger_time = current_utc + timedelta(minutes=2)
        trigger_time_str = trigger_time.strftime('%H:%M')
        
        self.log_result("Target Task Selected", True, f"Selected task: '{target_task.get('title')}' (ID: {target_task.get('id')[:8]}...)")
        self.log_result("Trigger Time Calculated", True, f"Will trigger at: {trigger_time_str} UTC (in 2 minutes)")
        
        # Update the recurring task
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            updates = {
                "recurrence_time": trigger_time_str,
                "recurrence_frequency": "daily",  # Ensure it's set to daily for testing
                "is_active": True
            }
            
            response = self.session.put(
                f"{API_BASE}/recurring-tasks/{target_task['id']}", 
                json=updates, 
                headers=headers
            )
            
            if response.status_code == 200:
                updated_task = response.json()
                self.log_result("Update Task Schedule", True, f"Updated task schedule to {trigger_time_str} UTC")
                self.log_result("Updated Task Verification", True, f"Confirmed recurrence_time: {updated_task.get('recurrence_time')}")
                return {
                    'task': updated_task,
                    'trigger_time': trigger_time,
                    'trigger_time_str': trigger_time_str
                }
            else:
                self.log_result("Update Task Schedule", False, f"HTTP {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Update Task Schedule", False, f"Exception: {str(e)}")
            return None
    
    def monitor_scheduler_and_task_generation(self, updated_task_info):
        """Wait and monitor the scheduler to confirm task generation"""
        print("\n=== Monitoring Scheduler and Task Generation ===")
        
        if not updated_task_info:
            self.log_result("Monitor Scheduler", False, "No updated task info available")
            return False
        
        task = updated_task_info['task']
        trigger_time = updated_task_info['trigger_time']
        trigger_time_str = updated_task_info['trigger_time_str']
        
        # Get initial task count for comparison
        initial_task_count = self.get_tasks_count()
        initial_recurring_instances = self.get_recurring_instance_count(task['id'])
        
        self.log_result("Initial Task Count", True, f"Initial total tasks: {initial_task_count}")
        self.log_result("Initial Recurring Instances", True, f"Initial recurring instances for task {task['id'][:8]}...: {initial_recurring_instances}")
        
        # Wait until trigger time + 1 minute buffer
        current_time = datetime.now(timezone.utc)
        wait_until = trigger_time + timedelta(minutes=1)  # 1 minute buffer after trigger time
        wait_seconds = (wait_until - current_time).total_seconds()
        
        if wait_seconds > 0:
            self.log_result("Waiting for Trigger", True, f"Waiting {wait_seconds:.0f} seconds until {wait_until.strftime('%H:%M:%S')} UTC")
            
            # Wait in chunks and show progress
            while wait_seconds > 0:
                chunk_wait = min(30, wait_seconds)  # Wait in 30-second chunks
                time.sleep(chunk_wait)
                wait_seconds -= chunk_wait
                current_time = datetime.now(timezone.utc)
                self.log_result("Wait Progress", True, f"Current time: {current_time.strftime('%H:%M:%S')} UTC, remaining wait: {wait_seconds:.0f}s")
        
        # Check if tasks were generated
        self.log_result("Checking Task Generation", True, "Scheduler should have run, checking for generated tasks...")
        
        # Wait a bit more to ensure scheduler has completed
        time.sleep(30)
        
        # Get updated counts
        final_task_count = self.get_tasks_count()
        final_recurring_instances = self.get_recurring_instance_count(task['id'])
        
        self.log_result("Final Task Count", True, f"Final total tasks: {final_task_count}")
        self.log_result("Final Recurring Instances", True, f"Final recurring instances for task {task['id'][:8]}...: {final_recurring_instances}")
        
        # Check if tasks were generated
        tasks_generated = final_task_count > initial_task_count
        recurring_instances_generated = final_recurring_instances > initial_recurring_instances
        
        if tasks_generated:
            new_tasks = final_task_count - initial_task_count
            self.log_result("Task Generation Success", True, f"✅ {new_tasks} new tasks generated!")
        else:
            self.log_result("Task Generation Success", False, "❌ No new tasks were generated")
        
        if recurring_instances_generated:
            new_instances = final_recurring_instances - initial_recurring_instances
            self.log_result("Recurring Instance Generation", True, f"✅ {new_instances} new recurring instances generated!")
        else:
            self.log_result("Recurring Instance Generation", False, "❌ No new recurring instances were generated")
        
        return tasks_generated and recurring_instances_generated
    
    def get_tasks_count(self):
        """Get total count of tasks in the database"""
        try:
            if self.db:
                return self.db.tasks.count_documents({})
            else:
                # Fallback to API
                if self.admin_token:
                    headers = {"Authorization": f"Bearer {self.admin_token}"}
                    response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                    if response.status_code == 200:
                        tasks = response.json()
                        return len(tasks) if isinstance(tasks, list) else 0
                return 0
        except Exception as e:
            print(f"Error getting task count: {e}")
            return 0
    
    def get_recurring_instance_count(self, recurring_task_id):
        """Get count of tasks that are instances of a specific recurring task"""
        try:
            if self.db:
                return self.db.tasks.count_documents({
                    "is_recurring_instance": True,
                    "recurring_task_id": recurring_task_id
                })
            else:
                # Fallback to API (less efficient)
                if self.admin_token:
                    headers = {"Authorization": f"Bearer {self.admin_token}"}
                    response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                    if response.status_code == 200:
                        tasks = response.json()
                        if isinstance(tasks, list):
                            return len([t for t in tasks if t.get('is_recurring_instance') and t.get('recurring_task_id') == recurring_task_id])
                return 0
        except Exception as e:
            print(f"Error getting recurring instance count: {e}")
            return 0
    
    def verify_generated_tasks(self, updated_task_info):
        """Verify that generated tasks appear in the tasks collection with correct properties"""
        print("\n=== Verifying Generated Tasks ===")
        
        if not updated_task_info:
            self.log_result("Verify Generated Tasks", False, "No updated task info available")
            return False
        
        task = updated_task_info['task']
        recurring_task_id = task['id']
        
        try:
            # Get tasks that are instances of our recurring task
            if self.db:
                # Direct database query
                generated_tasks = list(self.db.tasks.find({
                    "is_recurring_instance": True,
                    "recurring_task_id": recurring_task_id
                }, {"_id": 0}))
            else:
                # API fallback
                if not self.admin_token:
                    self.log_result("Verify Generated Tasks", False, "No admin token available")
                    return False
                
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                response = self.session.get(f"{API_BASE}/tasks", headers=headers)
                if response.status_code != 200:
                    self.log_result("Verify Generated Tasks", False, f"Failed to get tasks: {response.status_code}")
                    return False
                
                all_tasks = response.json()
                generated_tasks = [t for t in all_tasks if t.get('is_recurring_instance') and t.get('recurring_task_id') == recurring_task_id]
            
            if generated_tasks:
                self.log_result("Generated Tasks Found", True, f"Found {len(generated_tasks)} generated tasks")
                
                # Verify properties of generated tasks
                all_valid = True
                for i, gen_task in enumerate(generated_tasks, 1):
                    # Check required fields
                    has_recurring_flag = gen_task.get('is_recurring_instance') == True
                    has_recurring_id = gen_task.get('recurring_task_id') == recurring_task_id
                    has_title = gen_task.get('title') == task.get('title')
                    
                    if has_recurring_flag and has_recurring_id and has_title:
                        self.log_result(f"Generated Task {i} Validation", True, f"Task {gen_task.get('id', 'N/A')[:8]}... has correct properties")
                    else:
                        self.log_result(f"Generated Task {i} Validation", False, f"Task {gen_task.get('id', 'N/A')[:8]}... missing properties: recurring_flag={has_recurring_flag}, recurring_id={has_recurring_id}, title_match={has_title}")
                        all_valid = False
                
                return all_valid
            else:
                self.log_result("Generated Tasks Found", False, "No generated tasks found with correct properties")
                return False
                
        except Exception as e:
            self.log_result("Verify Generated Tasks", False, f"Exception: {str(e)}")
            return False
    
    def verify_last_generated_timestamp(self, updated_task_info):
        """Check that last_generated timestamp is updated"""
        print("\n=== Verifying Last Generated Timestamp ===")
        
        if not updated_task_info:
            self.log_result("Verify Last Generated", False, "No updated task info available")
            return False
        
        task = updated_task_info['task']
        recurring_task_id = task['id']
        
        try:
            # Get the updated recurring task
            if self.admin_token:
                headers = {"Authorization": f"Bearer {self.admin_token}"}
                response = self.session.get(f"{API_BASE}/recurring-tasks", headers=headers)
                
                if response.status_code == 200:
                    recurring_tasks = response.json()
                    updated_task = next((t for t in recurring_tasks if t['id'] == recurring_task_id), None)
                    
                    if updated_task:
                        last_generated = updated_task.get('last_generated')
                        
                        if last_generated:
                            # Parse the timestamp
                            try:
                                last_gen_time = datetime.fromisoformat(last_generated.replace('Z', '+00:00'))
                                current_time = datetime.now(timezone.utc)
                                time_diff = (current_time - last_gen_time).total_seconds()
                                
                                # Should be updated within the last few minutes
                                if time_diff < 300:  # 5 minutes
                                    self.log_result("Last Generated Timestamp", True, f"last_generated updated to: {last_generated} ({time_diff:.0f}s ago)")
                                    return True
                                else:
                                    self.log_result("Last Generated Timestamp", False, f"last_generated timestamp too old: {last_generated} ({time_diff:.0f}s ago)")
                                    return False
                            except Exception as e:
                                self.log_result("Last Generated Timestamp", False, f"Error parsing timestamp: {e}")
                                return False
                        else:
                            self.log_result("Last Generated Timestamp", False, "last_generated is still null")
                            return False
                    else:
                        self.log_result("Last Generated Timestamp", False, "Recurring task not found")
                        return False
                else:
                    self.log_result("Last Generated Timestamp", False, f"Failed to get recurring tasks: {response.status_code}")
                    return False
            else:
                self.log_result("Last Generated Timestamp", False, "No admin token available")
                return False
                
        except Exception as e:
            self.log_result("Verify Last Generated", False, f"Exception: {str(e)}")
            return False
    
    def check_backend_logs(self):
        """Check backend logs for scheduler activity"""
        print("\n=== Checking Backend Logs ===")
        
        try:
            # Try to read supervisor logs
            import subprocess
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Look for scheduler-related log entries
                scheduler_logs = [line for line in log_content.split('\n') if 'Auto-scheduler' in line or 'Generated' in line or 'recurring' in line.lower()]
                
                if scheduler_logs:
                    self.log_result("Backend Logs Found", True, f"Found {len(scheduler_logs)} scheduler-related log entries")
                    for log_line in scheduler_logs[-5:]:  # Show last 5 entries
                        if log_line.strip():
                            self.log_result("Log Entry", True, log_line.strip())
                else:
                    self.log_result("Backend Logs Found", True, "No recent scheduler logs found (may be normal)")
            else:
                self.log_result("Backend Logs", False, f"Failed to read logs: {result.stderr}")
                
        except Exception as e:
            self.log_result("Backend Logs", False, f"Exception reading logs: {str(e)}")
    
    def run_comprehensive_test(self):
        """Run the complete recurring task system test"""
        print("🚀 Starting Comprehensive Recurring Task System Test")
        print("=" * 80)
        
        # Step 1: Setup
        if not self.setup_admin_user():
            print("❌ Failed to setup admin user, aborting test")
            return False
        
        # Step 2: Get current UTC time
        current_utc, current_time_str = self.get_current_utc_time()
        
        # Step 3: Verify existing recurring tasks (should have 4 tasks)
        recurring_tasks = self.verify_existing_recurring_tasks()
        
        # Step 4: Update one recurring task to trigger in next 2-3 minutes
        updated_task_info = self.update_recurring_task_schedule(recurring_tasks, current_utc)
        
        # Step 5: Wait and monitor scheduler for task generation
        generation_success = self.monitor_scheduler_and_task_generation(updated_task_info)
        
        # Step 6: Verify generated tasks appear in tasks collection
        tasks_verified = self.verify_generated_tasks(updated_task_info)
        
        # Step 7: Check that last_generated timestamp is updated
        timestamp_updated = self.verify_last_generated_timestamp(updated_task_info)
        
        # Step 8: Check backend logs
        self.check_backend_logs()
        
        # Summary
        print("\n" + "=" * 80)
        print("🏁 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Key results
        key_results = {
            "Recurring Tasks Found": len(recurring_tasks) == 4,
            "Task Schedule Updated": updated_task_info is not None,
            "Tasks Generated": generation_success,
            "Generated Tasks Verified": tasks_verified,
            "Timestamp Updated": timestamp_updated
        }
        
        print("\nKey Test Results:")
        for test_name, result in key_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status} {test_name}")
        
        overall_success = all(key_results.values())
        
        if overall_success:
            print("\n🎉 OVERALL RESULT: ✅ ALL CRITICAL TESTS PASSED")
            print("The recurring task system is working correctly!")
        else:
            print("\n⚠️  OVERALL RESULT: ❌ SOME CRITICAL TESTS FAILED")
            print("The recurring task system needs attention.")
        
        return overall_success

def main():
    """Main test execution"""
    tester = RecurringTaskTester()
    success = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()