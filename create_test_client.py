import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv
import os
from pathlib import Path
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path('/app/backend')
load_dotenv(ROOT_DIR / '.env')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_test_client():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Create or update test client user
    email = "testclient@millii.com"
    password = "client123"
    
    existing = await db.users.find_one({"email": email})
    
    if existing:
        # Update password
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "password_hash": pwd_context.hash(password),
                "role": "client"
            }}
        )
        print(f"✅ Updated existing user: {email}")
        print(f"   Password: {password}")
        print(f"   Role: client")
    else:
        # Create new user
        user_data = {
            "id": str(uuid.uuid4()),
            "name": "Test Client User",
            "email": email,
            "role": "client",
            "password_hash": pwd_context.hash(password),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_data)
        print(f"✅ Created new user: {email}")
        print(f"   Password: {password}")
        print(f"   Role: client")
        print(f"   ID: {user_data['id']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_client())
