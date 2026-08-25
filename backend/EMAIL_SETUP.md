# Email Configuration Setup Guide

## Why Emails Aren't Being Sent

Your application has full email functionality built-in, but it requires **GoHighLevel (GHL) API credentials** to send emails. Currently, these credentials are not configured, which is why team members don't receive email notifications.

## How Email Notifications Work

When you add a team member to a project, the system:
1. ✅ Creates an in-app notification (this works)
2. ✅ Broadcasts it via WebSocket (this works)
3. ❌ **Tries to send an email notification** (this fails silently because GHL credentials are missing)

## Setup Instructions

### Step 1: Create a `.env` file

In the `backend` folder, create a file named `.env` (note the dot at the beginning).

### Step 2: Add Required Configuration

Copy this template into your `.env` file:

```bash
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=millii

# JWT Configuration
JWT_SECRET=your-secret-key-here-change-this-in-production

# Encryption Configuration (32 bytes for AES-256)
ENCRYPTION_KEY=your-32-byte-encryption-key-here-change-this

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# CORS Configuration (comma-separated)
CORS_ORIGINS=http://localhost:3000,https://app.millii.ai

# GoHighLevel Email Configuration (REQUIRED FOR EMAIL NOTIFICATIONS)
GHL_API_KEY=your-ghl-api-key-here
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_SUB_ACCOUNT_ID=your-ghl-sub-account-id-here

# Email Defaults
DEFAULT_FROM_EMAIL=no-reply@millii.ai
DEFAULT_FROM_NAME=Millii

# Admin User Email
PRESERVE_USER_EMAIL=irfan@millionaze.com
```

### Step 3: Get GoHighLevel Credentials

To get your GHL credentials:

1. **Log in to GoHighLevel** (https://app.gohighlevel.com/)
2. **Navigate to Settings** → **API Keys**
3. **Create a new API key** with the following permissions:
   - ✅ Contacts (read/write)
   - ✅ Conversations/Messages (read/write)
4. **Copy the API Key** and paste it as `GHL_API_KEY` in your `.env` file
5. **Find your Sub-Account ID**:
   - Go to Settings → Business Profile
   - Or check the URL when logged in (the long ID in the URL)
6. **Copy the Sub-Account ID** and paste it as `GHL_SUB_ACCOUNT_ID` in your `.env` file

### Step 4: Restart Your Backend Server

After saving the `.env` file, restart your backend server:

```bash
# Stop the current server (Ctrl+C)
# Then restart it
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## Verification

When properly configured, you should see in the server logs:
- ✅ No warnings about missing GHL credentials
- ✅ "Email notification sent successfully to [email]" messages
- ✅ Team members receive email notifications

## Alternative: Use a Different Email Service

If you don't want to use GoHighLevel, you'll need to modify the code to use a different email service (like SendGrid, AWS SES, SMTP, etc.). The email sending logic is in:
- `backend/services/ghl_email_client.py`
- `backend/services/email_service.py`

## What Emails Are Sent

The application automatically sends emails for:
- 📧 **Team member additions to projects**
- 📧 **Task assignments**
- 📧 **Password reset requests**
- 📧 **User invitations**
- 📧 **Welcome emails for new users**
- 📧 **Time tracking reports**
- 📧 **General notifications**

## Troubleshooting

### Emails Still Not Sending?

1. **Check the server logs** for error messages about email sending
2. **Verify GHL credentials** are correct
3. **Ensure your GHL account is active** and has email sending permissions
4. **Check if the user has a valid email address** in the database
5. **Look for "Failed to send email notification" warnings** in the logs

### Where to Check Logs

Look at your terminal/console where the backend server is running. You should see:
- `INFO: Email notification sent successfully to [email]`
- Or: `WARNING: Failed to send email notification to [email]: [error]`

## Need Help?

If you continue to have issues:
1. Check the server logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure the `.env` file is in the `backend` folder (not the root)
4. Make sure there are no typos in the variable names

