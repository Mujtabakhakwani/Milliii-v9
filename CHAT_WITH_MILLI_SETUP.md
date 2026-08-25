# Chat with Milli - AI Workspace Assistant Setup Guide

## ✅ Feature Status: FULLY IMPLEMENTED

The "Chat with Milli" AI assistant feature is already fully implemented in your codebase! This guide will help you configure and use it.

---

## 🎯 What is Milli?

Milli is your AI-powered workspace assistant that can:
- Answer questions about your tasks, projects, and team
- Provide insights about deadlines and priorities
- Help you understand project status and progress
- Give you data-driven recommendations
- Answer questions about meeting notes, documents, and KPIs

Milli uses OpenAI's GPT-4 to provide intelligent, context-aware responses based on your actual workspace data.

---

## 🏗️ Architecture

### Frontend (`frontend/src/pages/Chats.jsx`)
- **Thread-based conversations**: Each conversation with Milli is organized into threads
- **Real-time messaging**: Live typing indicators and instant responses
- **Markdown support**: Milli's responses support rich formatting including code blocks
- **Message history**: All conversations are saved to your database

### Backend (`backend/server.py`)
- **`GET /api/milli/channel`**: Creates or retrieves the Milli channel for the current user
- **`POST /api/milli/chat`**: Sends messages to Milli and returns AI-generated responses

### AI Integration
- Uses **OpenAI GPT-4o-mini** for fast, cost-effective responses
- **Smart context loading**: Only fetches relevant data based on your question
  - Questions about "team" → loads team member data
  - Questions about "tasks" → loads your task list
  - Questions about "projects" → loads project information
  - General questions → loads tasks and projects by default

---

## ⚙️ Configuration Required

### 1. OpenAI API Key

You need to configure an OpenAI API key in your backend `.env` file:

```bash
# Backend .env file location:
# Milliii-v9-main/backend/.env

# Add ONE of the following:

# Option 1: Use OpenAI directly
OPENAI_API_KEY=sk-your-openai-api-key-here

# Option 2: Use Emergent LLM service (if you have one)
EMERGENT_LLM_KEY=your-emergent-key-here
```

**To get an OpenAI API key:**
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Add it to your `.env` file

### 2. Install Dependencies

The OpenAI package has been added to `requirements.txt`. Make sure to install it:

```bash
# Navigate to backend directory
cd Milliii-v9-main/backend

# Activate virtual environment (if using one)
# On Windows:
.\venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# OR if using uv:
uv pip sync requirements.txt
```

### 3. Database Configuration

Milli stores conversations in MongoDB. Ensure your MongoDB connection is configured:

```bash
# In backend/.env
MONGO_URL=mongodb://localhost:27017  # or your MongoDB Atlas URL
DB_NAME=milliii
```

### 4. Permissions

The feature respects user permissions. Users need the `can_chat_with_millii` permission to access Milli.

---

## 🚀 How to Use

### Starting a Conversation

1. **Navigate to Chats**: Click on "Chats" in the sidebar
2. **Select Milli**: Click on "Chat with Milli" at the top of the channels list
3. **Start Chatting**: Click "Start New Conversation" or select an existing thread
4. **Ask Questions**: Type your question and press Enter

### Example Questions

```
# About Your Tasks
- "What are my pending tasks?"
- "Show me all overdue tasks"
- "What's my priority task list?"

# About Projects
- "What projects am I working on?"
- "What's the status of the XYZ project?"
- "Which projects have the highest priority?"

# About Team
- "Who is on my team?"
- "Who is assigned to task ABC?"
- "Show me all team members"

# About Meetings & Documents
- "What were the key points from the last meeting?"
- "Show me recent meeting notes"
- "What documents do we have for Project X?"

# General Workspace Questions
- "What should I work on today?"
- "Give me a summary of my workspace"
- "What deadlines are coming up?"
```

---

## 📊 What Data Milli Can Access

Milli has access to your workspace data including:
- ✅ Your profile (name, email, role, timezone)
- ✅ Team members (names, roles, emails)
- ✅ Your tasks (title, status, priority, due dates, descriptions)
- ✅ Your projects (name, client, status, description)
- ✅ Project tasks (all tasks across your projects)
- ✅ Meeting notes (summaries, dates, recording links)
- ✅ Shared documents (names, descriptions, URLs)
- ✅ KPIs and metrics (if configured)

**Privacy Note**: Milli only accesses data you have permission to see. Each user gets their own private Milli channel.

---

## 🎨 UI Features

### Thread Management
- Create multiple conversation threads
- Each thread maintains its own context
- Rename or delete threads
- Search through past conversations

### Rich Responses
- **Markdown formatting**: Bold, italic, lists, links
- **Code blocks**: Syntax-highlighted code snippets
- **Tables**: Structured data presentation
- **Links**: Clickable URLs and references

### Typing Indicators
- See when Milli is "typing"
- Real-time response streaming (coming soon)

---

## 🔧 Troubleshooting

### "LLM API key not configured" Error

**Problem**: No OpenAI API key found

**Solution**:
1. Check your `backend/.env` file
2. Add `OPENAI_API_KEY=sk-...` or `EMERGENT_LLM_KEY=...`
3. Restart the backend server

### No Response from Milli

**Problem**: Messages sent but no response

**Solution**:
1. Check backend server logs for errors
2. Verify OpenAI API key is valid
3. Check your OpenAI account has available credits
4. Verify MongoDB connection is working

### "Permission Denied" Error

**Problem**: User cannot access Milli

**Solution**:
1. Check user permissions in database
2. Ensure user has `can_chat_with_millii` permission
3. Admin users should have this permission by default

### Slow Response Times

**Problem**: Milli takes too long to respond

**Current Optimizations**:
- Smart context loading (only fetches relevant data)
- Limits on data fetched (max 50 projects, 50 tasks per query)
- Parallel data fetching (uses `asyncio.gather`)

**Further Optimization**:
- The backend is already optimized to fetch only relevant data
- Consider upgrading to GPT-4o-mini (already configured - fastest model)
- Check your database indexes for performance

---

## 💰 Cost Considerations

### OpenAI Pricing (as of 2024)
- **GPT-4o-mini**: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Average conversation**: ~$0.001 - $0.005 per message

### Cost Optimization
1. **Already Implemented**:
   - Uses GPT-4o-mini (cheapest model)
   - Smart context loading (only fetches what's needed)
   - Limits on data size

2. **Additional Options**:
   - Set usage limits in OpenAI dashboard
   - Monitor usage via OpenAI dashboard
   - Consider caching common responses (not yet implemented)

---

## 🔐 Security & Privacy

### Data Security
- ✅ User-specific channels (each user has their own Milli)
- ✅ Permission-based data access
- ✅ JWT authentication required
- ✅ HTTPS encryption (in production)

### Data Privacy
- ✅ Conversations stored in your MongoDB
- ⚠️ Questions and context sent to OpenAI
- ⚠️ OpenAI retains data for 30 days (per OpenAI policy)
- ✅ No data shared between users

**Important**: Be aware that workspace data is sent to OpenAI for processing. Ensure this complies with your organization's data policies.

---

## 📈 Future Enhancements

Potential improvements for the Milli feature:

1. **Streaming Responses**: Real-time token-by-token responses
2. **Conversation Memory**: Milli remembers previous messages in thread
3. **Action Capabilities**: Create tasks, schedule meetings via chat
4. **Voice Input**: Speak to Milli instead of typing
5. **Suggested Prompts**: Smart suggestions based on context
6. **Analytics Dashboard**: Track Milli usage and insights

---

## 🛠️ Technical Details

### Model Configuration
```python
model="gpt-4o-mini"  # Fast, cost-effective
temperature=0.7  # Balanced creativity/accuracy
max_tokens=1500  # Reasonable response length
```

### Context Window
- **User Profile**: Always included
- **Team Data**: Loaded when question mentions team/people
- **Task Data**: Loaded when question mentions tasks/work
- **Project Data**: Loaded when question mentions projects/clients
- **Detailed Data**: Meeting notes, documents (only for specific queries)

### Database Schema
```javascript
// Channels collection
{
  id: "milli-{user_id}",
  name: "Chat with Milli",
  type: "milli_ai",
  members: [user_id],
  created_by: "system",
  created_at: ISODate
}

// Messages collection
{
  id: UUID,
  channel_id: "milli-{user_id}",
  content: "message text",
  sender_id: user_id or "milli-ai",
  sender_name: "User Name" or "Milli",
  created_at: ISODate,
  mentions: [],
  attachments: []
}
```

---

## 📞 Support

If you encounter issues:

1. **Check Logs**: Look at backend console output
2. **Verify Config**: Double-check `.env` file settings
3. **Test API**: Use curl/Postman to test `/api/milli/chat` endpoint
4. **Database**: Verify MongoDB connection and collections

---

## ✨ Summary

The "Chat with Milli" feature is **production-ready** and just needs:
1. ✅ OpenAI API key configured in `.env`
2. ✅ Dependencies installed (`pip install -r requirements.txt`)
3. ✅ Backend server running
4. ✅ MongoDB connected

That's it! Your users can now chat with Milli and get intelligent assistance with their workspace tasks.

---

**Last Updated**: November 16, 2025
**Feature Version**: v9 (Fully Implemented)

