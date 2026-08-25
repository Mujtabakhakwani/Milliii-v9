import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone, timedelta
import uuid
from dotenv import load_dotenv
from pathlib import Path
import random

# Load environment variables
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def create_fake_time_data():
    """Create fake time tracking data for testing"""
    
    # Get all users
    users = await db.users.find({}, {"_id": 0}).to_list(100)
    if not users:
        print("No users found in database")
        return
    
    # Get all tasks
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(100)
    if not tasks:
        print("No tasks found in database")
        return
    
    print(f"Found {len(users)} users and {len(tasks)} tasks")
    
    # Generate time entries for the current week and last week
    today = datetime.now(timezone.utc)
    monday = today - timedelta(days=today.weekday())
    last_monday = monday - timedelta(days=7)
    
    time_entries_created = 0
    screenshots_created = 0
    activity_logs_created = 0
    
    # Use placeholder image service for screenshots
    placeholder_images = [
        "https://via.placeholder.com/1920x1080/1e3a8a/ffffff?text=VS+Code",
        "https://via.placeholder.com/1920x1080/dc2626/ffffff?text=Chrome+Browser",
        "https://via.placeholder.com/1920x1080/059669/ffffff?text=Terminal",
        "https://via.placeholder.com/1920x1080/7c3aed/ffffff?text=Figma+Design",
        "https://via.placeholder.com/1920x1080/ea580c/ffffff?text=Slack+Messages",
        "https://via.placeholder.com/1920x1080/0891b2/ffffff?text=Documentation",
        "https://via.placeholder.com/1920x1080/be123c/ffffff?text=Email+Client",
        "https://via.placeholder.com/1920x1080/4f46e5/ffffff?text=Database+Tool"
    ]
    
    for user in users[:5]:  # Use first 5 users
        print(f"Creating data for user: {user['name']}")
        
        # Create entries for last 2 weeks
        for week_offset in [0, 7]:  # This week and last week
            week_start = monday - timedelta(days=week_offset)
            
            # Create 3-5 time entries per user per week
            num_entries = random.randint(3, 5)
            for entry_num in range(num_entries):
                # Random day of the week
                day_offset = random.randint(0, 4)  # Monday to Friday
                if week_offset == 0 and day_offset > today.weekday():  # Don't create future entries
                    continue
                
                day = week_start + timedelta(days=day_offset)
                
                # Pick a random task
                task = random.choice(tasks)
                
                # Create realistic clock in/out times
                clock_in_hour = random.choice([9, 10, 13, 14, 15])  # Various start times
                clock_in = day.replace(hour=clock_in_hour, minute=random.randint(0, 59), second=0, microsecond=0)
                
                # Random duration between 1-5 hours
                duration_hours = random.randint(1, 5)
                duration_minutes = random.randint(0, 59)
                duration_seconds = (duration_hours * 3600) + (duration_minutes * 60)
                clock_out = clock_in + timedelta(seconds=duration_seconds)
                
                time_entry_id = str(uuid.uuid4())
                time_entry = {
                    "id": time_entry_id,
                    "user_id": user["id"],
                    "task_id": task["id"],
                    "project_id": task.get("project_id", "unknown"),
                    "clock_in_time": clock_in.isoformat(),
                    "clock_out_time": clock_out.isoformat(),
                    "duration_seconds": duration_seconds,
                    "is_active": False,
                    "created_at": clock_in.isoformat()
                }
                
                await db.time_entries.insert_one(time_entry)
                time_entries_created += 1
                
                # Create 4-8 screenshots per time entry
                num_screenshots = random.randint(4, 8)
                interval_minutes = duration_hours * 60 // num_screenshots
                
                for screenshot_num in range(num_screenshots):
                    screenshot_time = clock_in + timedelta(minutes=interval_minutes * screenshot_num)
                    screenshot = {
                        "id": str(uuid.uuid4()),
                        "time_entry_id": time_entry_id,
                        "user_id": user["id"],
                        "task_id": task["id"],
                        "project_id": task.get("project_id", "unknown"),
                        "screenshot_url": random.choice(placeholder_images),  # Use placeholder image
                        "timestamp": screenshot_time.isoformat(),
                        "created_at": screenshot_time.isoformat()
                    }
                    await db.time_screenshots.insert_one(screenshot)
                    screenshots_created += 1
                
                # Create 3-6 activity logs per time entry
                num_activities = random.randint(3, 6)
                activity_interval = duration_hours * 60 // num_activities
                
                for activity_num in range(num_activities):
                    activity_time = clock_in + timedelta(minutes=activity_interval * activity_num)
                    
                    # Random activity levels
                    mouse_clicks = random.randint(100, 500)
                    keyboard_strokes = random.randint(200, 800)
                    
                    activity_log = {
                        "id": str(uuid.uuid4()),
                        "time_entry_id": time_entry_id,
                        "user_id": user["id"],
                        "task_id": task["id"],
                        "project_id": task.get("project_id", "unknown"),
                        "mouse_clicks": mouse_clicks,
                        "keyboard_strokes": keyboard_strokes,
                        "active_window_title": random.choice([
                            f"VS Code - {task['title']}",
                            f"Chrome - {task['title']}",
                            "Slack - Team Chat",
                            "Terminal - Running Tests",
                            "Figma - UI Design",
                            "Postman - API Testing"
                        ]),
                        "timestamp": activity_time.isoformat(),
                        "interval_seconds": 300,
                        "created_at": activity_time.isoformat()
                    }
                    await db.activity_logs.insert_one(activity_log)
                    activity_logs_created += 1
    
    print(f"\n✅ Fake data created successfully!")
    print(f"   - Time entries: {time_entries_created}")
    print(f"   - Screenshots: {screenshots_created}")
    print(f"   - Activity logs: {activity_logs_created}")

async def cleanup_fake_data():
    """Remove all time tracking data"""
    result1 = await db.time_entries.delete_many({})
    result2 = await db.time_screenshots.delete_many({})
    result3 = await db.activity_logs.delete_many({})
    print(f"Deleted {result1.deleted_count} time entries")
    print(f"Deleted {result2.deleted_count} screenshots")
    print(f"Deleted {result3.deleted_count} activity logs")

if __name__ == "__main__":
    async def main():
        print("Cleaning existing time tracking data...")
        await cleanup_fake_data()
        print("\nCreating enhanced fake time tracking data...")
        await create_fake_time_data()
    
    asyncio.run(main())
