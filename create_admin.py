import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
import uuid
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.test_database
    
    # Admin account details
    admin_email = "admin@millionaze.com"
    admin_password = "admin123"
    admin_name = "Admin User"
    
    # Check if admin already exists
    existing_admin = await db.users.find_one({"email": admin_email})
    if existing_admin:
        print(f"⚠️  Admin account already exists: {admin_email}")
        client.close()
        return
    
    # Create admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "name": admin_name,
        "email": admin_email,
        "password_hash": pwd_context.hash(admin_password),
        "role": "admin",
        "profile_image_url": None,
        "timezone": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_user)
    
    print("=" * 60)
    print("✅ Admin account created successfully!")
    print("=" * 60)
    print(f"📧 Email:    {admin_email}")
    print(f"🔑 Password: {admin_password}")
    print(f"👤 Name:     {admin_name}")
    print(f"🎭 Role:     admin")
    print("=" * 60)
    print("\n🚀 You can now login at: http://localhost:3000")
    print("\n⚠️  IMPORTANT: Please change the password after first login!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
