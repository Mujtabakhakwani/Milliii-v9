import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid
import random

async def create_sample_data():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.millionaze
    
    print("Creating sample data for Reports page...")
    
    # Create users
    users = [
        {
            "id": str(uuid.uuid4()),
            "name": "Sarah Johnson",
            "email": "sarah@millionaze.com",
            "role": "user",
            "password_hash": "$2b$12$test",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Michael Chen",
            "email": "michael@millionaze.com",
            "role": "user",
            "password_hash": "$2b$12$test",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Emma Williams",
            "email": "emma@millionaze.com",
            "role": "user",
            "password_hash": "$2b$12$test",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "David Rodriguez",
            "email": "david@millionaze.com",
            "role": "user",
            "password_hash": "$2b$12$test",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Lisa Anderson",
            "email": "lisa@millionaze.com",
            "role": "user",
            "password_hash": "$2b$12$test",
            "created_at": datetime.now().isoformat()
        }
    ]
    
    await db.users.insert_many(users)
    print(f"✅ Created {len(users)} users")
    
    # Create projects
    projects = [
        {
            "id": str(uuid.uuid4()),
            "name": "E-commerce Platform",
            "client_name": "TechCorp Inc",
            "description": "Building modern e-commerce platform",
            "status": "active",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Mobile App Redesign",
            "client_name": "StartupHub",
            "description": "Redesigning mobile application",
            "status": "active",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "AI Integration Project",
            "client_name": "DataFlow Solutions",
            "description": "Integrating AI features",
            "status": "active",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Website Maintenance",
            "client_name": "TechCorp Inc",
            "description": "Ongoing website maintenance",
            "status": "active",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Cloud Migration",
            "client_name": "Enterprise Systems",
            "description": "Migrating to cloud infrastructure",
            "status": "active",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "CRM Implementation",
            "client_name": "StartupHub",
            "description": "Implementing CRM system",
            "status": "active",
            "created_at": datetime.now().isoformat()
        }
    ]
    
    await db.projects.insert_many(projects)
    print(f"✅ Created {len(projects)} projects")
    
    # Create tasks for each project
    task_titles = [
        "Frontend Development",
        "Backend API Development",
        "Database Design",
        "UI/UX Design",
        "Testing & QA",
        "Code Review",
        "Documentation",
        "Client Meeting",
        "Bug Fixes",
        "Performance Optimization"
    ]
    
    tasks = []
    for project in projects:
        for i in range(5):  # 5 tasks per project
            tasks.append({
                "id": str(uuid.uuid4()),
                "title": random.choice(task_titles),
                "project_id": project["id"],
                "description": f"Task for {project['name']}",
                "status": "in_progress",
                "created_at": datetime.now().isoformat()
            })
    
    await db.tasks.insert_many(tasks)
    print(f"✅ Created {len(tasks)} tasks")
    
    # Create time entries for the current month
    time_entries = []
    current_date = datetime.now()
    start_of_month = datetime(current_date.year, current_date.month, 1)
    
    for day in range(20):  # 20 days of data
        entry_date = start_of_month + timedelta(days=day)
        
        for user in users:
            # Each user works on 2-4 entries per day
            num_entries = random.randint(2, 4)
            
            for _ in range(num_entries):
                project = random.choice(projects)
                project_tasks = [t for t in tasks if t["project_id"] == project["id"]]
                task = random.choice(project_tasks) if project_tasks else random.choice(tasks)
                
                # Random work duration between 1-4 hours
                duration_hours = random.randint(1, 4)
                duration_seconds = duration_hours * 3600 + random.randint(0, 3600)
                
                # Random start time during work hours (9 AM - 5 PM)
                start_hour = random.randint(9, 16)
                clock_in = entry_date.replace(hour=start_hour, minute=random.randint(0, 59))
                clock_out = clock_in + timedelta(seconds=duration_seconds)
                
                time_entries.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user["id"],
                    "project_id": project["id"],
                    "task_id": task["id"],
                    "clock_in_time": clock_in.isoformat(),
                    "clock_out_time": clock_out.isoformat(),
                    "duration_seconds": duration_seconds,
                    "is_active": False,
                    "is_break": False,
                    "created_at": datetime.now().isoformat()
                })
    
    await db.time_entries.insert_many(time_entries)
    print(f"✅ Created {len(time_entries)} time entries")
    
    print("\n✅ Sample data creation complete!")
    print(f"   Users: {len(users)}")
    print(f"   Projects: {len(projects)}")
    print(f"   Tasks: {len(tasks)}")
    print(f"   Time Entries: {len(time_entries)}")
    print("\nYou can now test the Reports page with real data!")

if __name__ == "__main__":
    asyncio.run(create_sample_data())
