"""
Migration script to add RBAC permissions to existing users
- Sets all existing users to 'admin' role (as per user requirement)
- Adds permission_overrides field (set to None by default)
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def migrate():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Starting RBAC migration...")
    
    # Get all users
    users = await db.users.find({}).to_list(1000)
    print(f"📊 Found {len(users)} users to migrate")
    
    updated_count = 0
    for user in users:
        update_fields = {}
        
        # Add permission_overrides field if it doesn't exist
        if "permission_overrides" not in user:
            update_fields["permission_overrides"] = None
        
        # Set existing users to admin role (as per requirement: "Keep them as admin role for now")
        if user.get("role") not in ["admin", "manager", "user", "client", "guest"]:
            update_fields["role"] = "admin"
            print(f"  ⚠️  User {user.get('email')} had invalid role, setting to admin")
        
        # If user has no role, set to admin
        if "role" not in user or not user["role"]:
            update_fields["role"] = "admin"
            print(f"  ⚠️  User {user.get('email')} had no role, setting to admin")
        
        # Update user if there are changes
        if update_fields:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": update_fields}
            )
            updated_count += 1
    
    print(f"✅ Migration complete! Updated {updated_count} users")
    
    # Display summary
    role_counts = {}
    all_users = await db.users.find({}).to_list(1000)
    for user in all_users:
        role = user.get("role", "unknown")
        role_counts[role] = role_counts.get(role, 0) + 1
    
    print("\n📈 User Role Distribution:")
    for role, count in sorted(role_counts.items()):
        print(f"  {role}: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
