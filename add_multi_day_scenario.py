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

async def add_multi_day_task_scenario():
    """Add a specific scenario: one user working on same task for 5 consecutive days"""
    
    # Get a user and a task
    users = await db.users.find({}, {"_id": 0}).to_list(10)
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(10)
    
    if not users or not tasks:
        print("No users or tasks found")
        return
    
    user = users[0]
    task = tasks[0]
    
    print(f"Creating multi-day scenario:")
    print(f"  User: {user['name']}")
    print(f"  Task: {task['title']}")
    print(f"  Duration: 1 hour per day for 5 consecutive days\n")
    
    today = datetime.now(timezone.utc)
    
    placeholder_images = [
        "https://via.placeholder.com/1920x1080/1e3a8a/ffffff?text=VS+Code+-+Day+1",
        "https://via.placeholder.com/1920x1080/dc2626/ffffff?text=Testing+-+Day+2",
        "https://via.placeholder.com/1920x1080/059669/ffffff?text=Documentation+-+Day+3",
        "https://via.placeholder.com/1920x1080/7c3aed/ffffff?text=Code+Review+-+Day+4",
        "https://via.placeholder.com/1920x1080/ea580c/ffffff?text=Bug+Fixes+-+Day+5"
    ]
    
    for day_num in range(5):
        work_day = today - timedelta(days=(4 - day_num))  # 5 days ago to today
        
        # Clock in at 10 AM each day
        clock_in = work_day.replace(hour=10, minute=0, second=0, microsecond=0)
        
        # Work exactly 1 hour
        duration_seconds = 3600  # 1 hour
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
        
        # Create 3 screenshots per session (every 20 minutes)
        for screenshot_num in range(3):
            screenshot_time = clock_in + timedelta(minutes=20 * screenshot_num)
            screenshot = {
                "id": str(uuid.uuid4()),
                "time_entry_id": time_entry_id,
                "user_id": user["id"],
                "task_id": task["id"],
                "project_id": task.get("project_id", "unknown"),
                "screenshot_url": placeholder_images[day_num],
                "timestamp": screenshot_time.isoformat(),
                "created_at": screenshot_time.isoformat()
            }
            await db.time_screenshots.insert_one(screenshot)
        
        # Create 2 activity logs per session
        for activity_num in range(2):
            activity_time = clock_in + timedelta(minutes=30 * activity_num)
            
            activity_log = {
                "id": str(uuid.uuid4()),
                "time_entry_id": time_entry_id,
                "user_id": user["id"],
                "task_id": task["id"],
                "project_id": task.get("project_id", "unknown"),
                "mouse_clicks": random.randint(150, 300),
                "keyboard_strokes": random.randint(300, 600),
                "active_window_title": f"Day {day_num + 1} - Working on {task['title']}",
                "timestamp": activity_time.isoformat(),
                "interval_seconds": 300,
                "created_at": activity_time.isoformat()
            }
            await db.activity_logs.insert_one(activity_log)
        
        print(f"  Day {day_num + 1}: {work_day.strftime('%Y-%m-%d')} - 1 hour (10:00 AM - 11:00 AM)")
    
    print(f"\n✅ Multi-day scenario created!")
    print(f"   - 5 time entries (1 per day)")
    print(f"   - 15 screenshots (3 per day)")
    print(f"   - 10 activity logs (2 per day)")
    print(f"\n📊 When you click the clock icon on '{task['title']}':")
    print(f"   - Total time: 5h 0m")
    print(f"   - 5 work sessions across 5 different days")
    print(f"   - Each session shows: {user['name']} - 1h 0m")
    print(f"   - All screenshots grouped by day")

if __name__ == "__main__":
    asyncio.run(add_multi_day_task_scenario())
