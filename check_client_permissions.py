import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path('/app/backend')
load_dotenv(ROOT_DIR / '.env')

async def check_permissions():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Get all role configs
    configs = await db.role_configs.find({}, {"_id": 0}).to_list(100)
    
    print("=== ROLE CONFIGURATIONS IN DATABASE ===")
    for config in configs:
        print(f"\nRole: {config.get('role')}")
        print(f"Permissions: {config.get('permissions')}")
    
    # Check default permissions for client role
    print("\n=== DEFAULT PERMISSIONS (from code) ===")
    print("Client role should have:")
    print("  can_have_direct_chat: True")
    print("  can_chat_with_millii: False")
    
    # Check if there's a client user and their actual permissions
    client_users = await db.users.find({"role": "client"}, {"_id": 0}).to_list(5)
    print(f"\n=== CLIENT USERS ({len(client_users)} found) ===")
    for user in client_users[:2]:  # Show first 2
        print(f"\nUser: {user.get('name')} ({user.get('email')})")
        print(f"Role: {user.get('role')}")
        print(f"Permission Overrides: {user.get('permission_overrides')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_permissions())
