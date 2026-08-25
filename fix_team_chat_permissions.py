"""
Script to ensure all team members (user role) have chat permissions enabled
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def fix_permissions():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Fixing team member chat permissions...")
    
    # Get all users with 'user' role (team members)
    users = await db.users.find({"role": "user"}).to_list(1000)
    print(f"📊 Found {len(users)} team members")
    
    updated_count = 0
    for user in users:
        email = user.get('email', 'unknown')
        
        # Check if user has permission_overrides that restrict chat
        permission_overrides = user.get('permission_overrides')
        
        if permission_overrides:
            # User has custom permissions - check if chat is disabled
            needs_update = False
            updates = {}
            
            if permission_overrides.get('can_chat_with_millii') == False:
                print(f"  ⚠️  {email} has can_chat_with_millii=False in overrides")
                needs_update = True
            
            if permission_overrides.get('can_have_direct_chat') == False:
                print(f"  ⚠️  {email} has can_have_direct_chat=False in overrides")
                needs_update = True
            
            if needs_update:
                # Remove the chat restrictions from permission_overrides
                new_overrides = {k: v for k, v in permission_overrides.items() 
                               if k not in ['can_chat_with_millii', 'can_have_direct_chat']}
                
                if not new_overrides:
                    # If no other overrides, set to None
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"permission_overrides": None}}
                    )
                else:
                    # Keep other overrides
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"permission_overrides": new_overrides}}
                    )
                
                print(f"  ✅ Enabled chat permissions for {email}")
                updated_count += 1
        else:
            print(f"  ✓ {email} - using default permissions (chat enabled)")
    
    print(f"\n✅ Fix complete! Updated {updated_count} team members")
    
    # Verify
    print("\n🔍 Verifying permissions...")
    users_after = await db.users.find({"role": "user"}).to_list(1000)
    for user in users_after:
        email = user.get('email', 'unknown')
        overrides = user.get('permission_overrides')
        if overrides and (overrides.get('can_chat_with_millii') == False or overrides.get('can_have_direct_chat') == False):
            print(f"  ⚠️  {email} still has chat restrictions!")
        else:
            print(f"  ✓ {email} - chat enabled")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_permissions())
