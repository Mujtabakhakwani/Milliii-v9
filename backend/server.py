from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Depends,
    status,
    File,
    UploadFile,
    Request,
    WebSocket,
    WebSocketDisconnect,
    Response,
    Form,
)
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import base64
import httpx
from cryptography.fernet import Fernet
import json
import asyncio
import secrets
from contextlib import asynccontextmanager

# Import config
from config import settings

# Import email routes
from routes.email_routes import router as email_router
from services.email_service import EmailService
from services.ghl_email_client import ghl_email_client
from models.email import NotificationEmail, EmailRecipient
import traceback

# Import performance utilities
from utils.pagination import (
    PaginationParams,
    paginate_response,
    USER_LIST_FIELDS,
    PROJECT_LIST_FIELDS,
    TASK_LIST_FIELDS,
    MESSAGE_LIST_FIELDS,
    TIME_ENTRY_LIST_FIELDS
)
from utils.cache import cache, user_list_cache_key, project_list_cache_key
from utils.cache_invalidation import invalidate_user_cache, invalidate_project_cache, invalidate_task_cache

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# MongoDB connection with optimized settings for performance
client = AsyncIOMotorClient(
    "mongodb+srv://irfan_atlas_001:sA2cUm5tialL3Gll@cluster0.ct21ouz.mongodb.net/?appName=Cluster0",
    maxPoolSize=50,  # Increased from default 100 to handle more concurrent connections
    minPoolSize=10,  # Keep 10 connections ready
    maxIdleTimeMS=45000,  # Close idle connections after 45 seconds
    serverSelectionTimeoutMS=5000,  # Timeout for server selection
    connectTimeoutMS=10000,  # 10 seconds connection timeout
    socketTimeoutMS=20000  # 20 seconds socket timeout for long queries
)
db = client[settings.db_name]


# JWT Configuration
SECRET_KEY = settings.jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(
    auto_error=False
)  # Don't auto-error, we'll handle it in get_current_user

# Encryption for API keys
ENCRYPTION_KEY = settings.encryption_key
cipher_suite = Fernet(
    ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY
)


# Lifespan context manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup logic
    # Start the background task scheduler
    asyncio.create_task(auto_generate_scheduled_tasks())
    logging.info(
        "🚀 Started automatic recurring task scheduler (runs every 1 minute for precise scheduling)"
    )


    try:
        # Project indexes
        await db.projects.create_index("id")
        await db.projects.create_index("created_by")
        await db.projects.create_index([("team_members", 1)])
        await db.projects.create_index([("archived", 1)])

        # Task indexes
        await db.tasks.create_index("id")
        await db.tasks.create_index("project_id")
        await db.tasks.create_index([("assignee", 1)])
        await db.tasks.create_index([("archived", 1)])

        # User indexes
        await db.users.create_index("id")
        await db.users.create_index("email", unique=True)

        # Other collection indexes
        await db.internal_notes.create_index("project_id")
        await db.useful_links.create_index("project_id")
        await db.meeting_notes.create_index("project_id")
        await db.documents.create_index("project_id")
        await db.guest_links.create_index("project_id")
        await db.guest_links.create_index("token", unique=True)

        # Chat & Notification indexes
        await db.channels.create_index("id")
        await db.channels.create_index([("members", 1)])
        await db.channels.create_index("project_id")
        await db.messages.create_index("id")
        await db.messages.create_index("channel_id")
        await db.messages.create_index([("created_at", -1)])
        await db.notifications.create_index("id")
        await db.notifications.create_index([("user_id", 1)])
        await db.notifications.create_index([("read", 1)])
        await db.notifications.create_index([("created_at", -1)])

        # Channel unread counts indexes
        await db.channel_unreads.create_index(
            [("user_id", 1), ("channel_id", 1)], unique=True
        )
        await db.channel_unreads.create_index([("user_id", 1)])

        # Time tracking indexes (optimized with compound indexes)
        await db.time_entries.create_index("id")
        await db.time_entries.create_index([("user_id", 1)])
        await db.time_entries.create_index([("task_id", 1)])
        await db.time_entries.create_index([("project_id", 1)])
        await db.time_entries.create_index([("is_active", 1)])
        await db.time_entries.create_index([("clock_in_time", -1)])
        # Compound indexes for common queries (PERFORMANCE BOOST)
        await db.time_entries.create_index([("user_id", 1), ("clock_in_time", -1)])
        await db.time_entries.create_index([("user_id", 1), ("is_active", 1)])
        await db.time_entries.create_index([("project_id", 1), ("clock_in_time", -1)])

        await db.time_screenshots.create_index("id")
        await db.time_screenshots.create_index([("time_entry_id", 1)])
        await db.time_screenshots.create_index([("user_id", 1)])
        await db.time_screenshots.create_index([("task_id", 1)])
        await db.time_screenshots.create_index([("timestamp", -1)])
        # Compound index for fetching screenshots by entry
        await db.time_screenshots.create_index([("time_entry_id", 1), ("timestamp", -1)])

        await db.activity_logs.create_index("id")
        await db.activity_logs.create_index([("time_entry_id", 1)])
        await db.activity_logs.create_index([("user_id", 1)])
        await db.activity_logs.create_index([("task_id", 1)])
        await db.activity_logs.create_index([("timestamp", -1)])
        # Compound index for activity aggregation
        await db.activity_logs.create_index([("time_entry_id", 1), ("minute_start", 1)])

        logger.info("Database indexes created successfully")

        # Create default team channel if it doesn't exist
        general_channel = await db.channels.find_one(
            {"name": "General", "type": "team"}
        )
        if not general_channel:
            # Get all users
            users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(length=None)
            user_ids = [u["id"] for u in users]

            if user_ids:
                channel = Channel(
                    name="General",
                    type="team",
                    members=user_ids,
                    created_by=user_ids[0] if user_ids else "system",
                )
                await db.channels.insert_one(channel.model_dump())
                logger.info("Created default 'General' team channel")

        # Create project channels for existing projects without channels
        projects = await db.projects.find({}, {"_id": 0}).to_list(length=None)
        for project in projects:
            existing_channel = await db.channels.find_one(
                {"project_id": project["id"], "type": "project"}
            )
            if not existing_channel:
                channel_members = list(
                    set([project["created_by"]] + project.get("team_members", []))
                )
                channel = Channel(
                    name=f"#{project['name']}",
                    type="project",
                    project_id=project["id"],
                    members=channel_members,
                    created_by=project["created_by"],
                )
                await db.channels.insert_one(channel.model_dump())
                logger.info(f"Created project channel for project: {project['name']}")

    except Exception as e:
        logger.warning(f"Failed to create some indexes (may already exist): {str(e)}")

    yield  # Application is running

    # Shutdown logic
    client.close()
# Ensure uploads directory exists
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Create the main FastAPI app
app = FastAPI(lifespan=lifespan)

# Create the main FastAPI app
app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# Mount static files for screenshots
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# WebSocket Connection Manager for real-time chat
from typing import Dict, Set
import json


class ConnectionManager:
    def __init__(self):
        # Store active connections: {user_id: {connection_id: WebSocket}}
        self.active_connections: Dict[str, Dict[str, Any]] = {}
        # Store channel memberships: {channel_id: Set[user_id]}
        self.channel_members: Dict[str, Set[str]] = {}
        # Store typing indicators: {channel_id: Set[user_id]}
        self.typing_users: Dict[str, Set[str]] = {}

    async def connect(self, websocket, user_id: str, connection_id: str):
        """Store a WebSocket connection (connection should already be accepted)"""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        self.active_connections[user_id][connection_id] = {
            "websocket": websocket,
            "channels": set(),
        }
        logging.info(f"User {user_id} connected with connection {connection_id}")

    def disconnect(self, user_id: str, connection_id: str):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            if connection_id in self.active_connections[user_id]:
                # Remove from all channels
                channels = self.active_connections[user_id][connection_id][
                    "channels"
                ].copy()
                for channel_id in channels:
                    self.leave_channel(user_id, connection_id, channel_id)

                del self.active_connections[user_id][connection_id]
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                logging.info(
                    f"User {user_id} disconnected (connection {connection_id})"
                )

    def join_channel(self, user_id: str, connection_id: str, channel_id: str):
        """Add user to a channel"""
        if (
            user_id in self.active_connections
            and connection_id in self.active_connections[user_id]
        ):
            self.active_connections[user_id][connection_id]["channels"].add(channel_id)
            if channel_id not in self.channel_members:
                self.channel_members[channel_id] = set()
            self.channel_members[channel_id].add(user_id)
            logging.info(f"User {user_id} joined channel {channel_id}")

    def leave_channel(self, user_id: str, connection_id: str, channel_id: str):
        """Remove user from a channel"""
        if (
            user_id in self.active_connections
            and connection_id in self.active_connections[user_id]
        ):
            self.active_connections[user_id][connection_id]["channels"].discard(
                channel_id
            )
            if channel_id in self.channel_members:
                self.channel_members[channel_id].discard(user_id)
                if not self.channel_members[channel_id]:
                    del self.channel_members[channel_id]

    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user (all their connections)"""
        if user_id in self.active_connections:
            for conn_data in self.active_connections[user_id].values():
                try:
                    await conn_data["websocket"].send_json(message)
                except:
                    pass

    async def broadcast_to_channel(
        self, message: dict, channel_id: str, exclude_user: str = None
    ):
        """Broadcast message to all users in a channel"""
        if channel_id in self.channel_members:
            for user_id in self.channel_members[channel_id]:
                if exclude_user and user_id == exclude_user:
                    continue
                await self.send_personal_message(message, user_id)

    async def broadcast_channel_update(self):
        """Broadcast channel list update to all connected users"""
        message = {
            "type": "channels_updated",
            "message": "Channel list has been updated",
        }
        for user_id in self.active_connections.keys():
            await self.send_personal_message(message, user_id)

    async def broadcast_permission_change(self, user_ids: list):
        """Broadcast permission change notification to specific users"""
        message = {
            "type": "permissions_changed",
            "message": "Your permissions have been updated. Please log out and log back in.",
        }
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

    def set_typing(self, user_id: str, channel_id: str, is_typing: bool):
        """Update typing status for a user in a channel"""
        if channel_id not in self.typing_users:
            self.typing_users[channel_id] = set()

        if is_typing:
            self.typing_users[channel_id].add(user_id)
        else:
            self.typing_users[channel_id].discard(user_id)

    def get_online_users(self) -> List[str]:
        """Get list of online user IDs"""
        return list(self.active_connections.keys())


manager = ConnectionManager()

# ============ MODELS ============


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    role: str  # admin, manager, team member, user (client)
    profile_image_url: Optional[str] = None
    timezone: Optional[str] = None  # Auto-detected by frontend, can be overridden
    permission_overrides: Optional[Dict[str, bool]] = (
        None  # User-specific permission overrides
    )
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    is_online: Optional[bool] = None  # Computed field for online status


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


class GoogleSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: str  # ISO format datetime string
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class GoogleSessionRequest(BaseModel):
    session_id: str


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company_name: str = ""
    business_name: str = ""
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    budget: float = 0.0
    project_owner: Optional[str] = None
    status: str  # Getting Started, Onetime Setup, Agency Setup, Service, Under Review, Completed
    priority: str = "Medium"  # Low, Medium, High
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    created_by: str
    team_members: List[str] = []
    guests: List[str] = []  # Guest user IDs
    guest_link: Optional[str] = None  # Unique token for guest access
    guest_link_created_at: Optional[str] = None  # When guest link was created
    archived: bool = False
    internal_notes: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    # Section visibility settings
    section_visibility: dict = Field(
        default_factory=lambda: {
            "tasks": {"team": True, "client": True},
            "links_documents": {"team": True, "client": True},
            "meeting_notes": {"team": True, "client": False},
            "internal_notes": {"team": True, "client": False},
            "deliverables": {"team": True, "client": True},
            "team_members": {"team": True, "client": False},
            "timesheet": {"team": True, "client": False},
        }
    )


class ProjectCreate(BaseModel):
    name: str
    company_name: str = ""
    business_name: str = ""
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    budget: float = 0.0
    project_owner: Optional[str] = None
    status: str = "Getting Started"
    priority: str = "Medium"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    internal_notes: Optional[str] = None
    team_members: List[str] = []


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: Optional[str] = None  # Optional for standalone tasks
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "Medium"  # Low, Medium, High
    status: str = "Not Started"  # Not Started, In Progress, Under Review, Completed
    approved_by_guest: bool = False
    approved_by: Optional[str] = None  # Guest name who approved
    approved_at: Optional[str] = None  # When approved
    # Admin/Client approval fields
    approval_status: str = "none"  # none, approved, rejected
    approval_by: Optional[str] = None  # User ID who approved/rejected
    approval_by_name: Optional[str] = None  # User name who approved/rejected
    approval_at: Optional[str] = None  # When approved/rejected
    rejection_comment: Optional[str] = None  # Rejection reason
    archived: bool = False
    # Recurring task fields
    is_recurring_instance: bool = (
        False  # Is this task generated from a recurring template?
    )
    recurring_task_id: Optional[str] = None  # ID of the recurring task template
    created_by: Optional[str] = None  # User ID who created the task
    # Enhanced Trello-style fields
    labels: List[str] = []  # Task labels/tags
    members: List[str] = []  # Assigned members (can be multiple)
    checklist_items: List[dict] = []  # Checklist items
    attachment_count: int = 0  # Count of attachments
    comment_count: int = 0  # Count of comments
    cover_attachment_id: Optional[str] = None  # ID of cover image attachment
    position: float = 0.0  # Position for ordering within status column
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class TaskCreate(BaseModel):
    project_id: Optional[str] = None  # Optional for standalone tasks
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "Medium"
    status: str = "Not Started"
    labels: List[str] = []
    members: List[str] = []


class TaskApprovalRequest(BaseModel):
    comment: Optional[str] = None


class TaskRejectionRequest(BaseModel):
    comment: str  # Rejection reason is required


class TaskComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    user_id: str
    user_name: str
    content: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Optional[str] = None


class TaskCommentCreate(BaseModel):
    content: str


class TaskAttachment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    uploaded_by: str
    uploaded_by_name: str
    file_path: str  # Path to uploaded file
    is_cover: bool = False  # Whether this is the cover image
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class TaskActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    user_id: str
    user_name: str
    action_type: str  # created, updated, commented, moved, archived, etc.
    action_details: dict  # Additional details about the action
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class TaskLabel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str  # Hex color code
    project_id: Optional[str] = None  # Project-specific labels, null for global
    created_by: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class TaskLabelCreate(BaseModel):
    name: str
    color: str
    project_id: Optional[str] = None


class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    type: str  # docs_links, meeting_summaries, deliverables
    title: str
    url: str
    description: Optional[str] = None
    uploaded_by: str
    approved_by_guest: bool = False
    approved_by: Optional[str] = None  # Guest name who approved
    approved_at: Optional[str] = None  # When approved
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class DocumentCreate(BaseModel):
    project_id: str
    type: str
    title: str
    url: str
    description: Optional[str] = None


class InternalNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    content: str  # Rich text HTML
    created_by: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class InternalNoteCreate(BaseModel):
    project_id: str
    content: str


class UsefulLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    name: str
    url: str
    description: Optional[str] = None
    created_by: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class UsefulLinkCreate(BaseModel):
    project_id: str
    name: str
    url: str
    description: Optional[str] = None


class MeetingNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    meeting_name: str
    meeting_date: str
    summary: str
    recording_link: Optional[str] = None
    created_by: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class MeetingNoteCreate(BaseModel):
    project_id: str
    meeting_name: str
    meeting_date: str
    summary: str
    recording_link: Optional[str] = None


class GuestLink(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    all_tasks_approved: bool = False
    satisfaction_confirmed: bool = False
    satisfaction_confirmed_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class GuestLinkCreate(BaseModel):
    project_id: str


class GuestAccessRequest(BaseModel):
    guest_name: str
    guest_email: EmailStr


class UserSettingsUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    profile_image_url: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    profile_image_url: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class BusinessSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_name: str
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    company_logo_url: Optional[str] = None
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_by: Optional[str] = None


class BusinessSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_email: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    company_logo_url: Optional[str] = None


class Integration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # jibble, gohighlevel
    is_connected: bool = False
    credentials: Optional[Dict[str, str]] = None  # Encrypted storage
    config: Optional[Dict[str, Any]] = None  # pipeline_id, stage_id, etc.
    webhook_url: Optional[str] = None
    connected_at: Optional[str] = None
    connected_by: Optional[str] = None


class JibbleConnectRequest(BaseModel):
    client_id: str
    secret_key: str


class GHLConnectRequest(BaseModel):
    api_key: str
    location_id: str
    pipeline_id: str
    stage_id: str
    current_origin: Optional[str] = None  # Frontend URL for webhook generation


class GHLTestConnectionRequest(BaseModel):
    api_key: str
    location_id: str


class GHLFetchPipelinesRequest(BaseModel):
    api_key: str
    location_id: str


# ============ CHAT & NOTIFICATION MODELS ============


class Channel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # project, direct, team, company, announcement
    project_id: Optional[str] = None  # For project channels
    members: List[str] = []  # User IDs
    created_by: str
    description: Optional[str] = None  # Channel description
    is_private: bool = False  # Public (team-wide) or private (invite-only)

    # Channel permissions
    permissions: Dict[str, bool] = {
        "can_send_messages": True,  # Who can send messages
        "can_invite_members": False,  # Who can invite new members (besides admin/manager)
        "can_edit_channel": False,  # Who can edit channel settings (besides admin/manager)
        "can_delete_messages": False,  # Who can delete messages (besides admin/manager)
        "read_only": False,  # Announcement-style channels
    }

    # Channel category for organization
    category: str = "general"  # general, company, project, announcement

    # Slug for unique, URL-safe identifier (unique index exists on this field)
    # We default to a UUID-based slug to guarantee uniqueness without relying on name.
    slug: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Auto-generated for direct messages
    dm_participants: List[str] = []  # For direct message channels only

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Optional[str] = None


class ChannelCreate(BaseModel):
    name: str
    type: str  # project, direct, team, company, announcement
    project_id: Optional[str] = None
    members: List[str] = []
    description: Optional[str] = None
    is_private: bool = False
    permissions: Dict[str, bool] = {
        "can_send_messages": True,
        "can_invite_members": False,
        "can_edit_channel": False,
        "can_delete_messages": False,
        "read_only": False,
    }
    category: str = "general"
    # Optional slug from client; if not provided, backend will generate one.
    slug: Optional[str] = None


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None
    permissions: Optional[Dict[str, bool]] = None
    category: Optional[str] = None


class ChannelMember(BaseModel):
    user_id: str
    channel_id: str
    role: str = "member"  # member, moderator (future use)
    joined_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ChannelMemberAction(BaseModel):
    user_ids: List[str]
    action: str  # add, remove


class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    sender_id: str
    sender_name: str
    content: str
    mentions: List[str] = []  # User IDs mentioned in message
    reply_to: Optional[str] = None  # Message ID for threaded replies
    attachments: List[Dict[str, str]] = []  # [{name, url, type}]
    reactions: Dict[str, List[str]] = {}  # {emoji: [user_ids]}
    read_by: List[str] = []  # User IDs who have read this message
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: Optional[str] = None


class MessageCreate(BaseModel):
    content: str
    mentions: List[str] = []
    reply_to: Optional[str] = None
    attachments: List[Dict[str, str]] = []


class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Recipient
    type: str  # mention, task_assigned, task_completed, task_under_review, project_completed, project_created, new_message, task_approved, task_rejected
    title: str
    message: str
    link: Optional[str] = None  # URL to navigate to
    read: bool = False
    priority: str = "normal"  # urgent, normal, low
    metadata: Dict[str, Any] = {}  # Additional data (task_id, project_id, etc.)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    message: str
    link: Optional[str] = None
    priority: str = "normal"  # urgent, normal, low
    metadata: Dict[str, Any] = {}


# ============ TIME TRACKING MODELS ============


class TimeEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    task_id: Optional[str] = None  # None for break entries
    project_id: Optional[str] = None  # None for break entries
    break_id: Optional[str] = None  # Break type ID if this is a break entry
    is_break: bool = False  # True if this is a break time entry
    clock_in_time: str  # ISO format
    clock_out_time: Optional[str] = None  # ISO format, None if still clocked in
    duration_seconds: Optional[int] = None  # Total seconds worked
    is_active: bool = True  # False if clocked out
    clock_out_note: Optional[str] = (
        None  # Note for why timer was stopped (e.g., inactivity)
    )
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class TimeScreenshot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    time_entry_id: str
    user_id: str
    task_id: str
    project_id: str
    screenshot_url: str
    file_hash: str  # SHA-256 hash for deduplication
    width: int
    height: int
    display_surface: str  # monitor, window, browser
    captured_at: str  # ISO format - when screenshot was taken
    timestamp: str  # ISO format - legacy field for compatibility
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    time_entry_id: str
    user_id: str
    task_id: str
    project_id: str
    minute_start: str  # ISO format - start of the minute bucket
    mouse_distance_px: int = 0  # Total mouse distance moved in pixels
    mouse_clicks: int = 0
    keystrokes: int = 0  # Unique keydowns only (no repeats)
    timestamp: str  # ISO format - for compatibility
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ClockInRequest(BaseModel):
    task_id: str
    project_id: str


class ClockOutRequest(BaseModel):
    time_entry_id: str
    note: Optional[str] = None  # Optional note for clock-out reason (e.g., inactivity)


class UploadScreenshotRequest(BaseModel):
    time_entry_id: str
    captured_at: str  # ISO format
    width: int
    height: int
    display_surface: str  # monitor, window, browser
    file_hash: str  # SHA-256 hash for deduplication


class ActivityLogRequest(BaseModel):
    time_entry_id: str
    minute_start: str  # ISO format
    mouse_distance_px: int
    mouse_clicks: int
    keystrokes: int


# ============ TIME TRACKER SETTINGS MODELS ============


class TimeTrackerSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    screen_capture_required: bool = True
    screenshot_interval_minutes: int = 2  # Changed from 5 to 2 minutes
    blur_screenshots: bool = False
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_by: str


class Break(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    duration_minutes: int
    is_active: bool = True
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    created_by: str


class BreakCreate(BaseModel):
    name: str
    duration_minutes: int


class SettingsUpdate(BaseModel):
    screen_capture_required: Optional[bool] = None
    screenshot_interval_minutes: Optional[int] = None
    blur_screenshots: Optional[bool] = None


# ============ RBAC (Role-Based Access Control) MODELS ============


class Permissions(BaseModel):
    """Individual permission flags"""

    can_view_team_tab: bool = False
    can_view_time_sheet_tab: bool = False
    can_view_reports_tab: bool = False
    can_complete_project_tasks: bool = False
    can_edit_workspace_settings: bool = False
    can_create_recurring_tasks: bool = False
    can_create_new_projects: bool = False
    can_chat_with_millii: bool = False
    can_have_direct_chat: bool = False


class RoleConfig(BaseModel):
    """Role-level permission configuration"""

    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str  # admin, manager, user, client
    permissions: Permissions
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_by: Optional[str] = None


class RoleConfigUpdate(BaseModel):
    """Update role-level permissions"""

    role: str
    permissions: Permissions


class UserPermissionsUpdate(BaseModel):
    """Update user-specific permission overrides"""

    user_id: str
    permission_overrides: Optional[Permissions] = None  # None = use role defaults


# Default role permissions based on user requirements
DEFAULT_ROLE_PERMISSIONS = {
    "admin": Permissions(
        can_view_team_tab=True,
        can_view_time_sheet_tab=True,
        can_view_reports_tab=True,
        can_complete_project_tasks=True,
        can_edit_workspace_settings=True,
        can_create_recurring_tasks=True,
        can_create_new_projects=True,
        can_chat_with_millii=True,
        can_have_direct_chat=True,
    ),
    "manager": Permissions(
        can_view_team_tab=True,
        can_view_time_sheet_tab=False,
        can_view_reports_tab=False,
        can_complete_project_tasks=True,
        can_edit_workspace_settings=False,
        can_create_recurring_tasks=True,
        can_create_new_projects=True,
        can_chat_with_millii=True,
        can_have_direct_chat=True,
    ),
    "user": Permissions(
        can_view_team_tab=False,
        can_view_time_sheet_tab=False,
        can_view_reports_tab=False,
        can_complete_project_tasks=False,
        can_edit_workspace_settings=False,
        can_create_recurring_tasks=False,
        can_create_new_projects=False,
        can_chat_with_millii=True,
        can_have_direct_chat=True,
    ),
    "team member": Permissions(
        can_view_team_tab=False,
        can_view_time_sheet_tab=False,
        can_view_reports_tab=False,
        can_complete_project_tasks=False,
        can_edit_workspace_settings=False,
        can_create_recurring_tasks=False,
        can_create_new_projects=False,
        can_chat_with_millii=True,
        can_have_direct_chat=True,
    ),
    "client": Permissions(
        can_view_team_tab=False,
        can_view_time_sheet_tab=False,
        can_view_reports_tab=False,
        can_complete_project_tasks=False,
        can_edit_workspace_settings=False,
        can_create_recurring_tasks=False,
        can_create_new_projects=False,
        can_chat_with_millii=False,
        can_have_direct_chat=True,  # Enable for project chats only
    ),
}

# ============ HELPER FUNCTIONS ============


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def encrypt_data(data: str) -> str:
    """Encrypt sensitive data like API keys"""
    return cipher_suite.encrypt(data.encode()).decode()


def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data"""
    return cipher_suite.decrypt(encrypted_data.encode()).decode()


def get_frontend_url() -> str:
    """
    Get frontend URL dynamically from environment or .env file.
    This ensures all generated links (guest links, email links, etc.)
    use the correct domain when deployed to production.
    """
    # Get from config
    frontend_url = settings.frontend_url
    if frontend_url:
        return frontend_url.rstrip("/")

    # Fallback: Try to read from frontend/.env file
    try:
        frontend_env_path = Path(__file__).parent.parent / "frontend" / ".env"
        if frontend_env_path.exists():
            with open(frontend_env_path, "r") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        backend_url = line.split("=")[1].strip().strip('"').strip("'")
                        # Extract domain from backend URL (remove /api if present)
                        return backend_url.replace("/api", "").rstrip("/")
    except Exception as e:
        logging.warning(f"Could not read frontend URL from .env: {e}")

    # Final fallback - but this should be set in production
    return "http://localhost:3000"


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Get current user from either session_token cookie or Authorization header.
    Checks cookie first, then falls back to Authorization header.
    """
    user_id = None

    # First, try to get session_token from cookie
    session_token = request.cookies.get("session_token")
    if session_token:
        # Look up session in database
        session = await db.google_sessions.find_one(
            {"session_token": session_token}, {"_id": 0}
        )
        if session:
            # Check if session is expired
            expires_at = datetime.fromisoformat(session["expires_at"])
            if expires_at > datetime.now(timezone.utc):
                user_id = session["user_id"]
            else:
                # Session expired, delete it
                await db.google_sessions.delete_one({"session_token": session_token})

    # If no valid session from cookie, try Authorization header
    if not user_id and credentials:
        try:
            token = credentials.credentials
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except Exception as e:
            logging.error(f"JWT decode error: {e}")
            raise HTTPException(status_code=401, detail="Invalid token")

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication")

    # Get user from database
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return User(**user)


async def optional_get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Optional version of get_current_user - returns None instead of raising exception
    Useful for endpoints that work with or without authentication
    """
    try:
        return await get_current_user(request, credentials)
    except:
        return None


async def get_user_from_token(token: str) -> Optional[User]:
    """Helper to get user from JWT token for WebSocket authentication"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            return None
        return User(**user)
    except:
        return None


async def create_notification(notification_data: NotificationCreate):
    """Helper function to create notification, broadcast it via WebSocket, and send email"""
    notification = Notification(**notification_data.model_dump())
    await db.notifications.insert_one(notification.model_dump())

    # Broadcast notification to user via WebSocket
    await manager.send_personal_message(
        {"type": "new_notification", "notification": notification.model_dump()},
        notification.user_id,
    )

    # Send email notification
    try:
        # Get user details for email
        user = await db.users.find_one({"id": notification.user_id}, {"_id": 0})
        if user and user.get("email"):
            # Extract additional data for email template
            sender_name = notification.metadata.get("sender_name")
            project_name = notification.metadata.get("project_name")
            task_title = notification.metadata.get("task_title")

            # Create email data
            email_data = NotificationEmail(
                recipient=EmailRecipient(
                    email=user["email"], name=user.get("name", "User")
                ),
                notification_type=notification.type,
                title=notification.title,
                message=notification.message,
                link=notification.link,
                priority=notification.priority,
                sender_name=sender_name,
                project_name=project_name,
                task_title=task_title,
            )

            # Send email notification
            email_result = await EmailService.send_notification_email(email_data)
            if email_result.get("success"):
                logger.info(
                    f"Email notification sent successfully to {user['email']} for {notification.type}"
                )
            else:
                logger.warning(
                    f"Failed to send email notification to {user['email']}: {email_result.get('error_message', 'Unknown error')}"
                )
        else:
            logger.warning(
                f"User {notification.user_id} not found or has no email address"
            )

    except Exception as e:
        logger.error(f"Error sending email notification: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Don't fail the notification creation if email fails

    return notification


# ============ TIME TRACKING API ENDPOINTS ============


@api_router.post("/time-entries/clock-in")
async def clock_in(
    request: ClockInRequest, current_user: User = Depends(get_current_user)
):
    """Clock in to start tracking time on a task"""
    # Check if user already has an active time entry
    active_entry = await db.time_entries.find_one(
        {"user_id": current_user.id, "is_active": True}, {"_id": 0}
    )

    if active_entry:
        # Auto clock-out the previous entry
        clock_out_time = datetime.now(timezone.utc)
        clock_in_time = datetime.fromisoformat(active_entry["clock_in_time"])
        duration_seconds = int((clock_out_time - clock_in_time).total_seconds())

        await db.time_entries.update_one(
            {"id": active_entry["id"]},
            {
                "$set": {
                    "clock_out_time": clock_out_time.isoformat(),
                    "duration_seconds": duration_seconds,
                    "is_active": False,
                }
            },
        )

    # Create new time entry
    time_entry = TimeEntry(
        user_id=current_user.id,
        task_id=request.task_id,
        project_id=request.project_id,
        clock_in_time=datetime.now(timezone.utc).isoformat(),
        is_active=True,
    )

    await db.time_entries.insert_one(time_entry.model_dump())

    # Enrich with task and project info
    task = await db.tasks.find_one({"id": request.task_id}, {"_id": 0})
    project = await db.projects.find_one({"id": request.project_id}, {"_id": 0})

    enriched_entry = time_entry.model_dump()
    enriched_entry["task"] = task
    enriched_entry["project"] = project

    return {"message": "Clocked in successfully", "time_entry": enriched_entry}


@api_router.post("/time-entries/clock-in-break")
async def clock_in_break(break_id: str, current_user: User = Depends(get_current_user)):
    """Clock in to a break (separate from task tracking)"""
    # Check if user already has an active time entry
    active_entry = await db.time_entries.find_one(
        {"user_id": current_user.id, "is_active": True}, {"_id": 0}
    )

    if active_entry:
        # Auto clock-out the previous entry
        clock_out_time = datetime.now(timezone.utc)
        clock_in_time = datetime.fromisoformat(active_entry["clock_in_time"])
        duration_seconds = int((clock_out_time - clock_in_time).total_seconds())

        await db.time_entries.update_one(
            {"id": active_entry["id"]},
            {
                "$set": {
                    "clock_out_time": clock_out_time.isoformat(),
                    "duration_seconds": duration_seconds,
                    "is_active": False,
                }
            },
        )

    # Get break info
    break_info = await db.breaks.find_one({"id": break_id}, {"_id": 0})
    if not break_info:
        raise HTTPException(status_code=404, detail="Break type not found")

    # Create new break time entry
    time_entry = TimeEntry(
        user_id=current_user.id,
        task_id=None,  # No task for breaks
        project_id=None,  # No project for breaks
        break_id=break_id,
        is_break=True,
        clock_in_time=datetime.now(timezone.utc).isoformat(),
        is_active=True,
    )

    await db.time_entries.insert_one(time_entry.model_dump())

    # Enrich with break info
    enriched_entry = time_entry.model_dump()
    enriched_entry["break"] = break_info

    return {"message": "Break started successfully", "time_entry": enriched_entry}


@api_router.post("/time-entries/clock-out")
async def clock_out(
    request: ClockOutRequest, current_user: User = Depends(get_current_user)
):
    """Clock out to stop tracking time"""
    # Find the time entry
    time_entry = await db.time_entries.find_one(
        {"id": request.time_entry_id, "user_id": current_user.id, "is_active": True},
        {"_id": 0},
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Active time entry not found")

    clock_out_time = datetime.now(timezone.utc)
    clock_in_time = datetime.fromisoformat(time_entry["clock_in_time"])

    # Calculate duration in seconds
    duration_seconds = int((clock_out_time - clock_in_time).total_seconds())

    # Prepare update data
    update_data = {
        "clock_out_time": clock_out_time.isoformat(),
        "duration_seconds": duration_seconds,
        "is_active": False,
    }

    # Add note if provided (for inactivity tracking)
    if request.note:
        update_data["clock_out_note"] = request.note
        # Log inactivity-related clock-outs
        if "inactivity" in request.note.lower():
            logger.info(
                f"⏱️ Auto clock-out due to inactivity - User: {current_user.name} ({current_user.id}), Duration: {duration_seconds}s, Task: {time_entry.get('task_id', 'N/A')}"
            )

    # Update time entry
    await db.time_entries.update_one(
        {"id": request.time_entry_id}, {"$set": update_data}
    )

    # Get task and project info for response
    task = (
        await db.tasks.find_one({"id": time_entry.get("task_id")}, {"_id": 0})
        if time_entry.get("task_id")
        else None
    )
    project = (
        await db.projects.find_one({"id": time_entry.get("project_id")}, {"_id": 0})
        if time_entry.get("project_id")
        else None
    )

    response_data = {
        "message": "Clocked out successfully",
        "duration_seconds": duration_seconds,
        "clock_out_reason": request.note if request.note else "manual",
    }

    # Add context for inactivity-related clock-outs
    if request.note and "inactivity" in request.note.lower():
        response_data["message"] = "Timer stopped automatically due to inactivity"
        response_data["auto_stopped"] = True
        if task:
            response_data["task_title"] = task.get("title")
        if project:
            response_data["project_name"] = project.get("name")

    return response_data


@api_router.get("/time-entries")
async def get_time_entries(
    user_id: Optional[str] = None,
    task_id: Optional[str] = None,
    project_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_enhanced: Optional[bool] = False,  # Add parameter to include enhanced data
    current_user: User = Depends(get_current_user),
):
    """Get time entries with optional filters and enhanced data"""
    # Build query
    query = {}

    # Non-admin users can only see their own entries
    if current_user.role != "admin":
        query["user_id"] = current_user.id
    elif user_id:
        query["user_id"] = user_id

    if task_id:
        query["task_id"] = task_id
    if project_id:
        query["project_id"] = project_id

    # Date range filter
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        if date_query:
            query["clock_in_time"] = date_query

    time_entries = await db.time_entries.find(query, {"_id": 0}).to_list(1000)

    if not time_entries:
        return []

    # PERFORMANCE FIX: Batch fetch all related data to avoid N+1 queries
    # Collect all unique IDs
    user_ids = list(set(entry.get("user_id") for entry in time_entries if entry.get("user_id")))
    task_ids = list(set(entry.get("task_id") for entry in time_entries if entry.get("task_id")))
    project_ids = list(set(entry.get("project_id") for entry in time_entries if entry.get("project_id")))
    
    # Batch fetch all users, tasks, projects in parallel
    users_list, tasks_list, projects_list = await asyncio.gather(
        db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(1000) if user_ids else asyncio.sleep(0, result=[]),
        db.tasks.find({"id": {"$in": task_ids}}, {"_id": 0}).to_list(1000) if task_ids else asyncio.sleep(0, result=[]),
        db.projects.find({"id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else asyncio.sleep(0, result=[]),
    )
    
    # Create lookup dictionaries for O(1) access
    users_dict = {user["id"]: user for user in users_list}
    tasks_dict = {task["id"]: task for task in tasks_list}
    projects_dict = {project["id"]: project for project in projects_list}

    # If enhanced data is requested, fetch screenshots and activity logs
    screenshots = {}
    activity_logs = {}

    if include_enhanced:
        time_entry_ids = [entry["id"] for entry in time_entries]

        # Fetch screenshots and activity logs in parallel
        screenshot_docs, activity_docs = await asyncio.gather(
            db.time_screenshots.find(
                {"time_entry_id": {"$in": time_entry_ids}}, {"_id": 0}
            ).to_list(10000),
            db.activity_logs.find(
                {"time_entry_id": {"$in": time_entry_ids}}, {"_id": 0}
            ).to_list(10000)
        )

        for screenshot in screenshot_docs:
            entry_id = screenshot["time_entry_id"]
            if entry_id not in screenshots:
                screenshots[entry_id] = []
            screenshots[entry_id].append(screenshot)

        for activity in activity_docs:
            entry_id = activity["time_entry_id"]
            if entry_id not in activity_logs:
                activity_logs[entry_id] = []
            activity_logs[entry_id].append(activity)

    # Enrich with user, task, project info using dictionary lookups (O(1) instead of O(n))
    for entry in time_entries:
        entry["user"] = users_dict.get(entry.get("user_id"))
        entry["task"] = tasks_dict.get(entry.get("task_id"))
        entry["project"] = projects_dict.get(entry.get("project_id"))

        # Add enhanced data if requested
        if include_enhanced:
            entry_screenshots = screenshots.get(entry["id"], [])
            entry_activity_logs = activity_logs.get(entry["id"], [])

            entry["screenshots"] = entry_screenshots
            entry["activity_logs"] = entry_activity_logs

            # Calculate activity totals
            entry["total_mouse_distance_px"] = sum(
                log.get("mouse_distance_px", 0) for log in entry_activity_logs
            )
            entry["total_mouse_clicks"] = sum(
                log.get("mouse_clicks", 0) for log in entry_activity_logs
            )
            entry["total_keyboard_strokes"] = sum(
                log.get("keystrokes", 0) for log in entry_activity_logs
            )
            entry["total_screenshots"] = len(entry_screenshots)

    return time_entries


@api_router.get("/time-entries/active")
async def get_active_time_entry(current_user: User = Depends(get_current_user)):
    """Get current user's active time entry"""
    time_entry = await db.time_entries.find_one(
        {"user_id": current_user.id, "is_active": True}, {"_id": 0}
    )

    if not time_entry:
        return None

    # Enrich with task and project info
    task = await db.tasks.find_one({"id": time_entry["task_id"]}, {"_id": 0})
    project = await db.projects.find_one({"id": time_entry["project_id"]}, {"_id": 0})

    time_entry["task"] = task
    time_entry["project"] = project

    return time_entry


@api_router.post("/time-screenshots/upload")
async def upload_screenshot(
    request: UploadScreenshotRequest, current_user: User = Depends(get_current_user)
):
    """Upload a screenshot for a time entry"""
    # Verify time entry belongs to user
    time_entry = await db.time_entries.find_one(
        {"id": request.time_entry_id, "user_id": current_user.id}, {"_id": 0}
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    # Decode base64 screenshot
    try:
        screenshot_data = base64.b64decode(request.screenshot_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid screenshot data")

    # Save screenshot to disk
    screenshots_dir = Path(__file__).parent / "uploads" / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{current_user.id}_{int(datetime.now(timezone.utc).timestamp())}.png"
    filepath = screenshots_dir / filename

    with open(filepath, "wb") as f:
        f.write(screenshot_data)

    # Create screenshot record
    screenshot = TimeScreenshot(
        time_entry_id=request.time_entry_id,
        user_id=current_user.id,
        task_id=time_entry["task_id"],
        project_id=time_entry["project_id"],
        screenshot_url=f"/uploads/screenshots/{filename}",
        timestamp=request.timestamp,
    )

    await db.time_screenshots.insert_one(screenshot.model_dump())

    return {
        "message": "Screenshot uploaded successfully",
        "screenshot": screenshot.model_dump(),
    }


@api_router.get("/time-screenshots")
async def get_screenshots(
    time_entry_id: Optional[str] = None,
    user_id: Optional[str] = None,
    task_id: Optional[str] = None,
    project_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get screenshots with optional filters"""
    query = {}

    # Non-admin users can only see their own screenshots
    if current_user.role != "admin":
        query["user_id"] = current_user.id
    elif user_id:
        query["user_id"] = user_id

    if time_entry_id:
        query["time_entry_id"] = time_entry_id
    if task_id:
        query["task_id"] = task_id
    if project_id:
        query["project_id"] = project_id

    # Time range filter
    if start_time or end_time:
        time_query = {}
        if start_time:
            time_query["$gte"] = start_time
        if end_time:
            time_query["$lte"] = end_time
        if time_query:
            query["timestamp"] = time_query

    screenshots = await db.time_screenshots.find(query, {"_id": 0}).to_list(1000)
    return screenshots


@api_router.post("/activity-logs")
async def create_activity_log(
    request: ActivityLogRequest, current_user: User = Depends(get_current_user)
):
    """Create an activity log entry"""
    # Verify time entry belongs to user
    time_entry = await db.time_entries.find_one(
        {"id": request.time_entry_id, "user_id": current_user.id}, {"_id": 0}
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    # Create activity log
    activity_log = ActivityLog(
        time_entry_id=request.time_entry_id,
        user_id=current_user.id,
        task_id=time_entry["task_id"],
        project_id=time_entry["project_id"],
        mouse_clicks=request.mouse_clicks,
        keyboard_strokes=request.keyboard_strokes,
        active_window_title=request.active_window_title,
        timestamp=request.timestamp,
    )

    await db.activity_logs.insert_one(activity_log.model_dump())

    return {
        "message": "Activity log created successfully",
        "activity_log": activity_log.model_dump(),
    }


@api_router.get("/activity-logs")
async def get_activity_logs(
    time_entry_id: Optional[str] = None,
    user_id: Optional[str] = None,
    task_id: Optional[str] = None,
    project_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get activity logs with optional filters"""
    query = {}

    # Non-admin users can only see their own logs
    if current_user.role != "admin":
        query["user_id"] = current_user.id
    elif user_id:
        query["user_id"] = user_id

    if time_entry_id:
        query["time_entry_id"] = time_entry_id
    if task_id:
        query["task_id"] = task_id
    if project_id:
        query["project_id"] = project_id

    activity_logs = await db.activity_logs.find(query, {"_id": 0}).to_list(1000)
    return activity_logs


@api_router.get("/time-entries/weekly-summary")
async def get_weekly_summary(
    start_date: str, end_date: str, current_user: User = Depends(get_current_user)
):
    """Get weekly time tracking summary for all team members with enhanced data"""
    # No permission check needed - frontend ProtectedRoute handles access control

    # Parse dates
    try:
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    except:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use ISO format."
        )

    # Get all time entries in the date range (OPTIMIZED with field projection)
    time_entries = await db.time_entries.find(
        {
            "clock_in_time": {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()}
            # Include both active and completed entries
        },
        {
            "_id": 0,
            "id": 1,
            "user_id": 1,
            "task_id": 1,
            "project_id": 1,
            "clock_in_time": 1,
            "clock_out_time": 1,
            "duration_seconds": 1,
            "is_active": 1
        },
    ).limit(5000).to_list(5000)  # Limit to 5000 for performance

    # Get users with field projection (OPTIMIZED)
    users = await db.users.find({}, USER_LIST_FIELDS).to_list(1000)
    users_dict = {user["id"]: user for user in users}

    # Get enhanced data for all time entries
    time_entry_ids = [entry["id"] for entry in time_entries]

    # Fetch screenshots for all time entries (OPTIMIZED with projection & limit)
    screenshots = {}
    if time_entry_ids:
        screenshot_docs = await db.time_screenshots.find(
            {"time_entry_id": {"$in": time_entry_ids}},
            {
                "_id": 0,
                "id": 1,
                "time_entry_id": 1,
                "timestamp": 1,
                "file_path": 1,
                "blur_level": 1
            }
        ).limit(5000).to_list(5000)  # Limit for performance

        for screenshot in screenshot_docs:
            entry_id = screenshot["time_entry_id"]
            if entry_id not in screenshots:
                screenshots[entry_id] = []
            screenshots[entry_id].append(screenshot)

    # Fetch activity logs with AGGREGATION for better performance
    activity_logs = {}
    if time_entry_ids:
        # Use aggregation to pre-calculate totals (MAJOR PERFORMANCE BOOST)
        activity_pipeline = [
            {"$match": {"time_entry_id": {"$in": time_entry_ids}}},
            {
                "$group": {
                    "_id": "$time_entry_id",
                    "logs": {"$push": {
                        "minute_start": "$minute_start",
                        "mouse_distance_px": "$mouse_distance_px",
                        "mouse_clicks": "$mouse_clicks",
                        "keystrokes": "$keystrokes"
                    }},
                    "total_mouse_distance_px": {"$sum": "$mouse_distance_px"},
                    "total_mouse_clicks": {"$sum": "$mouse_clicks"},
                    "total_keystrokes": {"$sum": "$keystrokes"}
                }
            },
            {"$limit": 5000}
        ]
        
        activity_aggregated = await db.activity_logs.aggregate(activity_pipeline).to_list(5000)
        
        for agg in activity_aggregated:
            entry_id = agg["_id"]
            activity_logs[entry_id] = {
                "logs": agg.get("logs", []),
                "total_mouse_distance_px": agg.get("total_mouse_distance_px", 0),
                "total_mouse_clicks": agg.get("total_mouse_clicks", 0),
                "total_keystrokes": agg.get("total_keystrokes", 0)
            }

    # Organize data by user and date
    summary_data = {}

    for entry in time_entries:
        user_id = entry["user_id"]

        if user_id not in summary_data:
            user_info = users_dict.get(user_id)
            if not user_info:
                continue

            summary_data[user_id] = {
                "user_id": user_id,
                "user_name": user_info.get("name", "Unknown"),
                "user_email": user_info.get("email", ""),
                "profile_image_url": user_info.get("profile_image_url"),
                "daily_hours": {},  # date -> hours
                "total_hours": 0,
                "total_seconds": 0,
                "time_entries": [],  # Add time entries with enhanced data
            }

        # Add enhanced data to time entry
        entry_enhanced = entry.copy()
        entry_enhanced["screenshots"] = screenshots.get(entry["id"], [])
        
        # Get pre-aggregated activity data (OPTIMIZED - no more calculation needed!)
        entry_activity_data = activity_logs.get(entry["id"], {})
        entry_enhanced["activity_logs"] = entry_activity_data.get("logs", [])
        entry_enhanced["total_mouse_distance_px"] = entry_activity_data.get("total_mouse_distance_px", 0)
        entry_enhanced["total_mouse_clicks"] = entry_activity_data.get("total_mouse_clicks", 0)
        entry_enhanced["total_keyboard_strokes"] = entry_activity_data.get("total_keystrokes", 0)

        summary_data[user_id]["time_entries"].append(entry_enhanced)

        # Get the date of clock_in_time (YYYY-MM-DD)
        clock_in_dt = datetime.fromisoformat(entry["clock_in_time"])
        date_key = clock_in_dt.strftime("%Y-%m-%d")

        # Calculate duration for both active and completed entries
        if entry.get("is_active", False):
            # For active entries, calculate duration from clock_in_time to now
            clock_in_time = datetime.fromisoformat(entry["clock_in_time"])
            duration_seconds = int(
                (datetime.now(timezone.utc) - clock_in_time).total_seconds()
            )
            entry_enhanced["duration_seconds"] = duration_seconds
            entry_enhanced["is_currently_active"] = True
        else:
            # For completed entries, use stored duration
            duration_seconds = entry.get("duration_seconds", 0)
            entry_enhanced["is_currently_active"] = False

        if date_key not in summary_data[user_id]["daily_hours"]:
            summary_data[user_id]["daily_hours"][date_key] = {
                "seconds": 0,
                "hours": 0,
                "formatted": "0h 0m",
            }

        summary_data[user_id]["daily_hours"][date_key]["seconds"] += duration_seconds
        summary_data[user_id]["total_seconds"] += duration_seconds

    # Calculate formatted hours and enhanced summary stats
    for user_id in summary_data:
        # Format daily hours
        for date_key in summary_data[user_id]["daily_hours"]:
            seconds = summary_data[user_id]["daily_hours"][date_key]["seconds"]
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            summary_data[user_id]["daily_hours"][date_key]["hours"] = round(
                seconds / 3600, 2
            )
            summary_data[user_id]["daily_hours"][date_key]["formatted"] = (
                f"{hours}h {minutes}m"
            )

        # Format total hours
        total_seconds = summary_data[user_id]["total_seconds"]
        total_hours = total_seconds // 3600
        total_minutes = (total_seconds % 3600) // 60
        summary_data[user_id]["total_hours"] = round(total_seconds / 3600, 2)
        summary_data[user_id]["total_formatted"] = f"{total_hours}h {total_minutes}m"

        # Calculate enhanced summary totals
        user_entries = summary_data[user_id]["time_entries"]
        summary_data[user_id]["total_screenshots"] = sum(
            len(entry.get("screenshots", [])) for entry in user_entries
        )
        summary_data[user_id]["total_mouse_distance_px"] = sum(
            entry.get("total_mouse_distance_px", 0) for entry in user_entries
        )
        summary_data[user_id]["total_mouse_clicks"] = sum(
            entry.get("total_mouse_clicks", 0) for entry in user_entries
        )
        summary_data[user_id]["total_keyboard_strokes"] = sum(
            entry.get("total_keyboard_strokes", 0) for entry in user_entries
        )

    # Convert to list and sort by total hours (descending)
    summary_list = list(summary_data.values())
    summary_list.sort(key=lambda x: x["total_seconds"], reverse=True)

    return {"start_date": start_date, "end_date": end_date, "users": summary_list}


@api_router.get("/time-entries/reports-data")
async def get_reports_data(
    start_date: str, end_date: str, current_user: User = Depends(get_current_user)
):
    """Get detailed time tracking data for reports page with enhanced data"""
    # No permission check - frontend ProtectedRoute handles access control

    # Parse dates
    try:
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    except:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use ISO format."
        )

    # Get all time entries in the date range (excluding breaks)
    time_entries = await db.time_entries.find(
        {
            "clock_in_time": {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()},
            "is_active": False,  # Only completed entries
            "is_break": False,  # Exclude breaks
        },
        {"_id": 0},
    ).to_list(10000)

    # Get all users
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    users_dict = {user["id"]: user for user in users}

    # Get all projects
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    projects_dict = {project["id"]: project for project in projects}

    # Get all tasks
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(10000)
    tasks_dict = {task["id"]: task for task in tasks}

    # Get enhanced data for all time entries
    time_entry_ids = [entry["id"] for entry in time_entries]

    # Fetch screenshots for all time entries (OPTIMIZED with projection & limit)
    screenshots = {}
    if time_entry_ids:
        screenshot_docs = await db.time_screenshots.find(
            {"time_entry_id": {"$in": time_entry_ids}},
            {
                "_id": 0,
                "id": 1,
                "time_entry_id": 1,
                "timestamp": 1,
                "file_path": 1,
                "blur_level": 1
            }
        ).limit(5000).to_list(5000)  # Limit for performance

        for screenshot in screenshot_docs:
            entry_id = screenshot["time_entry_id"]
            if entry_id not in screenshots:
                screenshots[entry_id] = []
            screenshots[entry_id].append(screenshot)

    # Fetch activity logs with AGGREGATION for better performance
    activity_logs = {}
    if time_entry_ids:
        # Use aggregation to pre-calculate totals (MAJOR PERFORMANCE BOOST)
        activity_pipeline = [
            {"$match": {"time_entry_id": {"$in": time_entry_ids}}},
            {
                "$group": {
                    "_id": "$time_entry_id",
                    "logs": {"$push": {
                        "minute_start": "$minute_start",
                        "mouse_distance_px": "$mouse_distance_px",
                        "mouse_clicks": "$mouse_clicks",
                        "keystrokes": "$keystrokes"
                    }},
                    "total_mouse_distance_px": {"$sum": "$mouse_distance_px"},
                    "total_mouse_clicks": {"$sum": "$mouse_clicks"},
                    "total_keystrokes": {"$sum": "$keystrokes"}
                }
            },
            {"$limit": 5000}
        ]
        
        activity_aggregated = await db.activity_logs.aggregate(activity_pipeline).to_list(5000)
        
        for agg in activity_aggregated:
            entry_id = agg["_id"]
            activity_logs[entry_id] = {
                "logs": agg.get("logs", []),
                "total_mouse_distance_px": agg.get("total_mouse_distance_px", 0),
                "total_mouse_clicks": agg.get("total_mouse_clicks", 0),
                "total_keystrokes": agg.get("total_keystrokes", 0)
            }

    # Organize data by user
    user_data = {}

    for entry in time_entries:
        user_id = entry["user_id"]

        if user_id not in user_data:
            user_info = users_dict.get(user_id)
            if not user_info:
                continue

            user_data[user_id] = {
                "user_id": user_id,
                "user_name": user_info.get("name", "Unknown"),
                "user_email": user_info.get("email", ""),
                "time_entries": [],
                "total_seconds": 0,
                "total_screenshots": 0,
                "total_mouse_distance_px": 0,
                "total_mouse_clicks": 0,
                "total_keyboard_strokes": 0,
            }

        # Get project details
        project_id = entry.get("project_id")
        project_info = projects_dict.get(project_id) if project_id else None

        # Get task details
        task_id = entry.get("task_id")
        task_info = tasks_dict.get(task_id) if task_id else None

        duration_seconds = entry.get("duration_seconds", 0)

        # Get enhanced data for this entry
        entry_screenshots = screenshots.get(entry["id"], [])
        entry_activity_logs = activity_logs.get(entry["id"], [])

        # Calculate activity totals for this entry
        total_mouse_distance_px = sum(
            log.get("mouse_distance_px", 0) for log in entry_activity_logs
        )
        total_mouse_clicks = sum(
            log.get("mouse_clicks", 0) for log in entry_activity_logs
        )
        total_keyboard_strokes = sum(
            log.get("keystrokes", 0) for log in entry_activity_logs
        )

        # Build time entry with details and enhanced data
        time_entry = {
            "id": entry["id"],
            "project": {
                "name": project_info.get("name") if project_info else "No Project",
                "client_name": project_info.get("client_name", "No Client")
                if project_info
                else "No Client",
            },
            "task": {"title": task_info.get("title") if task_info else "No Task"},
            "duration_seconds": duration_seconds,
            "clock_in_time": entry.get("clock_in_time"),
            "clock_out_time": entry.get("clock_out_time"),
            "is_break": entry.get("is_break", False),
            # Enhanced data
            "screenshots": entry_screenshots,
            "activity_logs": entry_activity_logs,
            "total_screenshots": len(entry_screenshots),
            "total_mouse_distance_px": total_mouse_distance_px,
            "total_mouse_clicks": total_mouse_clicks,
            "total_keyboard_strokes": total_keyboard_strokes,
        }

        user_data[user_id]["time_entries"].append(time_entry)
        user_data[user_id]["total_seconds"] += duration_seconds

        # Add to user totals
        user_data[user_id]["total_screenshots"] += len(entry_screenshots)
        user_data[user_id]["total_mouse_distance_px"] += total_mouse_distance_px
        user_data[user_id]["total_mouse_clicks"] += total_mouse_clicks
        user_data[user_id]["total_keyboard_strokes"] += total_keyboard_strokes

    # Convert to list
    users_list = list(user_data.values())

    return {"start_date": start_date, "end_date": end_date, "users": users_list}


@api_router.get("/time-entries/user-detail")
async def get_user_time_detail(
    user_id: str, date: str, current_user: User = Depends(get_current_user)
):
    """Get detailed time entries for a specific user on a specific date"""
    # No permission check - frontend ProtectedRoute handles access control

    # Parse date to get start and end of day
    try:
        date_dt = datetime.fromisoformat(date.replace("Z", "+00:00"))
        start_of_day = date_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = date_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Get time entries for this user on this date
    time_entries = await db.time_entries.find(
        {
            "user_id": user_id,
            "clock_in_time": {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat(),
            },
        },
        {"_id": 0},
    ).to_list(1000)

    # Enrich with task, project, screenshots, and activity data
    for entry in time_entries:
        # Get task and project info
        task = await db.tasks.find_one({"id": entry["task_id"]}, {"_id": 0})
        project = await db.projects.find_one({"id": entry["project_id"]}, {"_id": 0})

        entry["task"] = task
        entry["project"] = project

        # Get screenshots for this time entry
        screenshots = await db.time_screenshots.find(
            {"time_entry_id": entry["id"]}, {"_id": 0}
        ).to_list(1000)
        entry["screenshots"] = screenshots

        # Get activity logs for this time entry
        activity_logs = await db.activity_logs.find(
            {"time_entry_id": entry["id"]}, {"_id": 0}
        ).to_list(1000)
        entry["activity_logs"] = activity_logs

        # Calculate total activity
        total_mouse_distance_px = sum(
            log.get("mouse_distance_px", 0) for log in activity_logs
        )
        total_mouse_clicks = sum(log.get("mouse_clicks", 0) for log in activity_logs)
        total_keyboard_strokes = sum(
            log.get("keystrokes", 0) for log in activity_logs
        )  # Use correct field name

        entry["total_mouse_distance_px"] = total_mouse_distance_px
        entry["total_mouse_clicks"] = total_mouse_clicks
        entry["total_keyboard_strokes"] = total_keyboard_strokes
        entry["total_screenshots"] = len(screenshots)

    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})

    return {"user": user, "date": date, "time_entries": time_entries}


@api_router.get("/time-entries/task-summary")
async def get_task_time_summary(
    task_id: str, current_user: User = Depends(get_current_user)
):
    """Get time tracking summary for a specific task"""
    # Get task info
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get all time entries for this task
    time_entries = await db.time_entries.find({"task_id": task_id}, {"_id": 0}).to_list(
        1000
    )

    # Calculate total time
    total_seconds = sum(
        entry.get("duration_seconds", 0)
        for entry in time_entries
        if entry.get("duration_seconds")
    )
    total_hours = total_seconds // 3600
    total_minutes = (total_seconds % 3600) // 60

    # Get all screenshots for this task
    screenshots = await db.time_screenshots.find(
        {"task_id": task_id}, {"_id": 0}
    ).to_list(1000)

    # Get all activity logs for this task
    activity_logs = await db.activity_logs.find(
        {"task_id": task_id}, {"_id": 0}
    ).to_list(1000)

    total_mouse_clicks = sum(log.get("mouse_clicks", 0) for log in activity_logs)
    total_keyboard_strokes = sum(
        log.get("keyboard_strokes", 0) for log in activity_logs
    )

    # Enrich time entries with user info
    for entry in time_entries:
        user = await db.users.find_one(
            {"id": entry["user_id"]}, {"_id": 0, "password": 0}
        )
        entry["user"] = user

    return {
        "task": task,
        "total_seconds": total_seconds,
        "total_hours": round(total_seconds / 3600, 2),
        "total_formatted": f"{total_hours}h {total_minutes}m",
        "time_entries": time_entries,
        "screenshots": screenshots,
        "total_mouse_clicks": total_mouse_clicks,
        "total_keyboard_strokes": total_keyboard_strokes,
        "total_screenshots": len(screenshots),
    }


# ============ NEW ENHANCED TIME TRACKER ENDPOINTS ============

import hashlib


@api_router.post("/time-entries/{time_entry_id}/screenshots")
async def upload_screenshot(
    time_entry_id: str,
    file: UploadFile = File(...),
    captured_at: str = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    display_surface: str = Form(...),
    file_hash: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a screenshot for a time entry"""

    # Verify the time entry belongs to the current user
    # Allow screenshot upload for active entries OR recently completed entries (within 5 minutes)
    time_entry = await db.time_entries.find_one(
        {"id": time_entry_id, "user_id": current_user.id}, {"_id": 0}
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    # Check if entry is active OR recently completed
    is_active = time_entry.get("is_active", False)

    if not is_active:
        # Allow uploads for recently completed entries (within 5 minutes)
        clock_out_time = time_entry.get("clock_out_time")
        if clock_out_time:
            clock_out_dt = datetime.fromisoformat(clock_out_time)
            now_dt = datetime.now(timezone.utc)
            minutes_since_completion = (now_dt - clock_out_dt).total_seconds() / 60

            if minutes_since_completion > 5:
                raise HTTPException(
                    status_code=400,
                    detail="Time entry completed too long ago to accept screenshot data",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Time entry is not active and has no completion time",
            )

    # Check for duplicate by hash
    existing_screenshot = await db.time_screenshots.find_one(
        {"file_hash": file_hash}, {"_id": 0}
    )

    if existing_screenshot:
        return {
            "message": "Screenshot already exists (duplicate hash)",
            "screenshot_id": existing_screenshot["id"],
            "duplicate": True,
        }

    # Validate file size (limit to 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    # Validate file hash
    calculated_hash = hashlib.sha256(file_content).hexdigest()
    if calculated_hash != file_hash:
        raise HTTPException(status_code=400, detail="File hash mismatch")

    # Ensure upload directory exists
    upload_dir = Path("uploads/screenshots")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save file with unique name
    file_extension = Path(file.filename).suffix or ".jpg"
    filename = f"{file_hash}{file_extension}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(file_content)

    # Create screenshot record
    screenshot = TimeScreenshot(
        time_entry_id=time_entry_id,
        user_id=current_user.id,
        task_id=time_entry["task_id"],
        project_id=time_entry["project_id"],
        screenshot_url=f"/uploads/screenshots/{filename}",
        file_hash=file_hash,
        width=width,
        height=height,
        display_surface=display_surface,
        captured_at=captured_at,
        timestamp=captured_at,  # For compatibility
    )

    await db.time_screenshots.insert_one(screenshot.model_dump())

    return {
        "message": "Screenshot uploaded successfully",
        "screenshot_id": screenshot.id,
        "duplicate": False,
    }


@api_router.post("/time-entries/{time_entry_id}/activity")
async def log_activity(
    time_entry_id: str,
    activity_data: ActivityLogRequest,
    current_user: User = Depends(get_current_user),
):
    """Log activity data for a time entry"""

    # Verify the time entry belongs to the current user
    # Allow activity upload for active entries OR recently completed entries (within 5 minutes)
    time_entry = await db.time_entries.find_one(
        {"id": time_entry_id, "user_id": current_user.id}, {"_id": 0}
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    # Check if entry is active OR recently completed
    is_active = time_entry.get("is_active", False)

    if not is_active:
        # Allow uploads for recently completed entries (within 5 minutes)
        clock_out_time = time_entry.get("clock_out_time")
        if clock_out_time:
            clock_out_dt = datetime.fromisoformat(clock_out_time)
            now_dt = datetime.now(timezone.utc)
            minutes_since_completion = (now_dt - clock_out_dt).total_seconds() / 60

            if minutes_since_completion > 5:
                raise HTTPException(
                    status_code=400,
                    detail="Time entry completed too long ago to accept activity data",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Time entry is not active and has no completion time",
            )

    # Check for existing activity log for this minute
    existing_log = await db.activity_logs.find_one(
        {"time_entry_id": time_entry_id, "minute_start": activity_data.minute_start},
        {"_id": 0},
    )

    if existing_log:
        # Update existing log (aggregate data)
        await db.activity_logs.update_one(
            {"id": existing_log["id"]},
            {
                "$inc": {
                    "mouse_distance_px": activity_data.mouse_distance_px,
                    "mouse_clicks": activity_data.mouse_clicks,
                    "keystrokes": activity_data.keystrokes,
                }
            },
        )
        return {
            "message": "Activity data updated",
            "log_id": existing_log["id"],
            "aggregated": True,
        }
    else:
        # Create new activity log
        activity_log = ActivityLog(
            time_entry_id=time_entry_id,
            user_id=current_user.id,
            task_id=time_entry["task_id"],
            project_id=time_entry["project_id"],
            minute_start=activity_data.minute_start,
            mouse_distance_px=activity_data.mouse_distance_px,
            mouse_clicks=activity_data.mouse_clicks,
            keystrokes=activity_data.keystrokes,
            timestamp=activity_data.minute_start,  # For compatibility
        )

        await db.activity_logs.insert_one(activity_log.model_dump())

        return {
            "message": "Activity logged successfully",
            "log_id": activity_log.id,
            "aggregated": False,
        }


@api_router.get("/time-entries/{time_entry_id}/screenshots")
async def get_screenshots(
    time_entry_id: str, current_user: User = Depends(get_current_user)
):
    """Get all screenshots for a time entry"""

    # Verify the time entry belongs to the current user or user has admin access
    time_entry = await db.time_entries.find_one(
        {
            "id": time_entry_id,
            "$or": [
                {"user_id": current_user.id},
                {"$expr": {"$eq": [current_user.role, "admin"]}},
            ],
        },
        {"_id": 0},
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    screenshots = (
        await db.time_screenshots.find({"time_entry_id": time_entry_id}, {"_id": 0})
        .sort("captured_at", 1)
        .to_list(1000)
    )

    return {"screenshots": screenshots, "total": len(screenshots)}


@api_router.get("/time-entries/{time_entry_id}/activity")
async def get_activity(
    time_entry_id: str, current_user: User = Depends(get_current_user)
):
    """Get all activity data for a time entry"""

    # Verify the time entry belongs to the current user or user has admin access
    time_entry = await db.time_entries.find_one(
        {
            "id": time_entry_id,
            "$or": [
                {"user_id": current_user.id},
                {"$expr": {"$eq": [current_user.role, "admin"]}},
            ],
        },
        {"_id": 0},
    )

    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    activity_logs = (
        await db.activity_logs.find({"time_entry_id": time_entry_id}, {"_id": 0})
        .sort("minute_start", 1)
        .to_list(1000)
    )

    # Calculate totals
    total_mouse_distance = sum(log.get("mouse_distance_px", 0) for log in activity_logs)
    total_mouse_clicks = sum(log.get("mouse_clicks", 0) for log in activity_logs)
    total_keystrokes = sum(log.get("keystrokes", 0) for log in activity_logs)

    return {
        "activity_logs": activity_logs,
        "total_minutes": len(activity_logs),
        "total_mouse_distance_px": total_mouse_distance,
        "total_mouse_clicks": total_mouse_clicks,
        "total_keystrokes": total_keystrokes,
    }


# ============ TIME TRACKER SETTINGS ENDPOINTS ============


@api_router.get("/time-tracker/settings")
async def get_time_tracker_settings(current_user: User = Depends(get_current_user)):
    """Get time tracker settings"""
    settings = await db.time_tracker_settings.find_one({}, {"_id": 0})

    if not settings:
        # Return default settings if none exist
        return {
            "screen_capture_required": True,
            "screenshot_interval_minutes": 2,
            "blur_screenshots": False,
        }

    return settings


@api_router.put("/time-tracker/settings")
async def update_time_tracker_settings(
    settings_update: SettingsUpdate, current_user: User = Depends(get_current_user)
):
    """Update time tracker settings (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get existing settings or create new
    existing = await db.time_tracker_settings.find_one({})

    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id,
    }

    if settings_update.screen_capture_required is not None:
        update_data["screen_capture_required"] = settings_update.screen_capture_required
    if settings_update.screenshot_interval_minutes is not None:
        update_data["screenshot_interval_minutes"] = (
            settings_update.screenshot_interval_minutes
        )
    if settings_update.blur_screenshots is not None:
        update_data["blur_screenshots"] = settings_update.blur_screenshots

    if existing:
        await db.time_tracker_settings.update_one(
            {"id": existing["id"]}, {"$set": update_data}
        )
    else:
        # Create new settings with defaults for missing fields
        new_settings_data = {
            "screen_capture_required": settings_update.screen_capture_required
            if settings_update.screen_capture_required is not None
            else True,
            "screenshot_interval_minutes": settings_update.screenshot_interval_minutes
            if settings_update.screenshot_interval_minutes is not None
            else 2,
            "blur_screenshots": settings_update.blur_screenshots
            if settings_update.blur_screenshots is not None
            else False,
            "updated_by": current_user.id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        new_settings = TimeTrackerSettings(**new_settings_data)
        await db.time_tracker_settings.insert_one(new_settings.model_dump())

    return {"message": "Settings updated successfully"}


# ============ BREAK MANAGEMENT ENDPOINTS ============


@api_router.get("/breaks")
async def get_breaks(current_user: User = Depends(get_current_user)):
    """Get all breaks"""
    breaks = await db.breaks.find({"is_active": True}, {"_id": 0}).to_list(100)
    return breaks


@api_router.post("/breaks")
async def create_break(
    break_data: BreakCreate, current_user: User = Depends(get_current_user)
):
    """Create a new break (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    new_break = Break(
        name=break_data.name,
        duration_minutes=break_data.duration_minutes,
        created_by=current_user.id,
    )

    await db.breaks.insert_one(new_break.model_dump())

    return {"message": "Break created successfully", "break": new_break.model_dump()}


@api_router.delete("/breaks/{break_id}")
async def delete_break(break_id: str, current_user: User = Depends(get_current_user)):
    """Delete a break (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    await db.breaks.update_one({"id": break_id}, {"$set": {"is_active": False}})

    return {"message": "Break deleted successfully"}


# ============ REPORTS ENDPOINT ============


@api_router.get("/time-tracker/report")
async def generate_time_report(
    start_date: str,
    end_date: str,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Generate time tracking report with filters (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Build query
    query = {
        "clock_in_time": {"$gte": start_date, "$lte": end_date},
        "is_active": False,  # Only completed entries
    }

    if project_id:
        query["project_id"] = project_id
    if user_id:
        query["user_id"] = user_id

    # Fetch data
    time_entries = await db.time_entries.find(query, {"_id": 0}).to_list(10000)

    # Fetch users and projects for enrichment
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(10000)

    users_map = {user["id"]: user for user in users}
    projects_map = {project["id"]: project for project in projects}
    tasks_map = {task["id"]: task for task in tasks}

    # Aggregate data
    report_data = []
    total_seconds = 0

    for entry in time_entries:
        user = users_map.get(entry["user_id"])
        project = projects_map.get(entry["project_id"])
        task = tasks_map.get(entry["task_id"])

        duration = entry.get("duration_seconds", 0)
        total_seconds += duration

        hours = duration // 3600
        minutes = (duration % 3600) // 60

        report_data.append(
            {
                "date": entry["clock_in_time"].split("T")[0],
                "user_name": user.get("name") if user else "Unknown",
                "project_name": project.get("name") if project else "Unknown",
                "task_title": task.get("title") if task else "Unknown",
                "clock_in": entry["clock_in_time"],
                "clock_out": entry.get("clock_out_time"),
                "duration_seconds": duration,
                "duration_formatted": f"{hours}h {minutes}m",
            }
        )

    # Calculate totals
    total_hours = total_seconds // 3600
    total_minutes = (total_seconds % 3600) // 60

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_entries": len(time_entries),
        "total_seconds": total_seconds,
        "total_hours": round(total_seconds / 3600, 2),
        "total_formatted": f"{total_hours}h {total_minutes}m",
        "entries": report_data,
    }


# ============ WEBSOCKET ENDPOINT ============


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time chat with Socket.io-like features"""
    connection_id = str(uuid.uuid4())
    user = None
    user_id = None
    heartbeat_task = None  # Initialize at the start

    try:
        # Accept connection first
        await websocket.accept()

        # Wait for authentication message
        auth_data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)

        if auth_data.get("type") != "auth" or "token" not in auth_data:
            await websocket.send_json(
                {"type": "error", "message": "Authentication required"}
            )
            await websocket.close()
            return

        # Verify token
        user = await get_user_from_token(auth_data["token"])
        if not user:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close()
            return

        user_id = user.id

        # Register connection
        await manager.connect(websocket, user_id, connection_id)

        # Send connection success
        await websocket.send_json(
            {
                "type": "connected",
                "user_id": user_id,
                "user_name": user.name,
                "connection_id": connection_id,
            }
        )

        # Heartbeat task
        async def send_heartbeat():
            try:
                while True:
                    await asyncio.sleep(30)
                    await websocket.send_json({"type": "ping"})
            except:
                pass

        heartbeat_task = asyncio.create_task(send_heartbeat())

        # Message handling loop
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "pong":
                # Heartbeat response
                continue

            elif message_type == "join_channel":
                channel_id = data.get("channel_id")
                if channel_id:
                    # Verify channel access
                    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
                    if channel and user_id in channel.get("members", []):
                        manager.join_channel(user_id, connection_id, channel_id)
                        await websocket.send_json(
                            {"type": "joined_channel", "channel_id": channel_id}
                        )

            elif message_type == "leave_channel":
                channel_id = data.get("channel_id")
                if channel_id:
                    manager.leave_channel(user_id, connection_id, channel_id)
                    await websocket.send_json(
                        {"type": "left_channel", "channel_id": channel_id}
                    )

            elif message_type == "send_message":
                channel_id = data.get("channel_id")
                content = data.get("content", "")
                mentions = data.get("mentions", [])
                attachments = data.get("attachments", [])

                if channel_id and content.strip():
                    # Create message in database
                    message = Message(
                        channel_id=channel_id,
                        sender_id=user_id,
                        sender_name=user.name,
                        content=content,
                        mentions=mentions,
                        attachments=attachments,
                    )
                    await db.messages.insert_one(message.model_dump())

                    # Broadcast to channel
                    await manager.broadcast_to_channel(
                        {"type": "new_message", "message": message.model_dump()},
                        channel_id,
                    )

                    # Create notifications for mentions
                    if mentions:
                        for mentioned_user_id in mentions:
                            notification = NotificationCreate(
                                user_id=mentioned_user_id,
                                type="mention",
                                title=f"{user.name} mentioned you",
                                message=content[:100],
                                link=f"/chats?channel={channel_id}",
                                priority="urgent",
                                metadata={"channel_id": channel_id},
                            )
                            await create_notification(notification)

                    # Update unread counts
                    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
                    if channel and "members" in channel:
                        for member_id in channel["members"]:
                            if member_id != user_id:
                                await db.channel_unreads.update_one(
                                    {"user_id": member_id, "channel_id": channel_id},
                                    {"$inc": {"unread_count": 1}},
                                    upsert=True,
                                )

                    # Send confirmation
                    await websocket.send_json(
                        {"type": "message_sent", "message_id": message.id}
                    )

            elif message_type == "typing":
                channel_id = data.get("channel_id")
                is_typing = data.get("is_typing", False)

                if channel_id:
                    manager.set_typing(user_id, channel_id, is_typing)

                    # Broadcast typing status
                    await manager.broadcast_to_channel(
                        {
                            "type": "user_typing",
                            "user_id": user_id,
                            "user_name": user.name,
                            "is_typing": is_typing,
                        },
                        channel_id,
                        exclude_user=user_id,
                    )

    except WebSocketDisconnect:
        logging.info(f"WebSocket disconnected: {user_id}")
    except asyncio.TimeoutError:
        logging.warning("WebSocket authentication timeout")
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
    finally:
        # Cleanup
        if heartbeat_task:
            heartbeat_task.cancel()
        if user_id:
            manager.disconnect(user_id, connection_id)
        try:
            await websocket.close()
        except:
            pass


# ============ AUTH ROUTES ============


@api_router.post("/auth/signup", response_model=Token)
async def signup(
    user_data: UserCreate,
    send_welcome_email: bool = False,
    inviter_name: str = "Admin",
    current_user: User = Depends(optional_get_current_user),
):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user_dict = user_data.model_dump()
    password = user_dict.pop("password")  # Keep the plain password for email
    password_hash = get_password_hash(password)

    user = User(**user_dict)

    # Store with password hash
    user_doc = user.model_dump()
    user_doc["password_hash"] = password_hash
    await db.users.insert_one(user_doc)

    # Send welcome email if requested
    if send_welcome_email:
        try:
            # Get frontend URL for login link
            frontend_url = get_frontend_url()
            login_link = f"{frontend_url}/login"

            # Use current user's name as inviter if available
            inviter = inviter_name
            if current_user and current_user.name:
                inviter = current_user.name

            # Send welcome email with credentials
            email_result = await EmailService.send_team_member_welcome(
                recipient_name=user.name,
                recipient_email=user.email,
                password=password,
                login_link=login_link,
                inviter_name=inviter,
            )

            if email_result.get("success"):
                logger.info(f"Welcome email sent successfully to {user.email}")
            else:
                logger.warning(
                    f"Failed to send welcome email to {user.email}: {email_result.get('error_message', 'Unknown error')}"
                )
        except Exception as e:
            logger.error(f"Error sending welcome email: {str(e)}")
            # Don't fail signup if email fails

    # Create token
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)


@api_router.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    # Find user
    logger.info(f"Login attempt for email: {login_data.email}")
    user_doc = await db.users.find_one({"email": login_data.email})
    if not user_doc:
        logger.warning(f"User not found: {login_data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    logger.info(f"User found: {user_doc.get('name')}, verifying password...")
    # Verify password
    password_hash = user_doc.get("password_hash")
    logger.info(f"Password hash from DB: {password_hash[:20]}...")
    verify_result = verify_password(login_data.password, password_hash)
    logger.info(f"Password verification result: {verify_result}")

    if not verify_result:
        logger.warning(f"Password verification failed for user: {login_data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = User(**user_doc)
    access_token = create_access_token(data={"sub": user.id})
    logger.info(f"Login successful for user: {login_data.email}")
    return Token(access_token=access_token, token_type="bearer", user=user)


@api_router.get("/auth/me", response_model=User)
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    return current_user


@api_router.post("/auth/google/process-session")
async def process_google_session(
    request: Request, session_request: GoogleSessionRequest, response: Response
):
    """
    Process Google session_id from Emergent Auth.
    Exchange session_id for user data and create/login user.
    """
    try:
        # Call Emergent Auth API to get user data
        async with httpx.AsyncClient() as client:
            api_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_request.session_id},
                timeout=10.0,
            )

            if api_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")

            session_data = api_response.json()
            # session_data contains: id, email, name, picture, session_token

        # Check if user exists
        existing_user = await db.users.find_one({"email": session_data["email"]})

        if existing_user:
            # User exists, don't create new or update existing data
            user = User(**existing_user)
        else:
            # Create new user (member role only for Google Auth)
            new_user_data = {
                "id": str(uuid.uuid4()),
                "name": session_data["name"],
                "email": session_data["email"],
                "role": "user",  # Only members can use Google Auth
                "profile_image_url": session_data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(new_user_data)
            user = User(**new_user_data)

        # Store session token in database with 7-day expiry
        google_session = GoogleSession(
            user_id=user.id,
            session_token=session_data["session_token"],
            expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        )
        await db.google_sessions.insert_one(google_session.model_dump())

        # Set httpOnly cookie with session_token
        response.set_cookie(
            key="session_token",
            value=session_data["session_token"],
            max_age=7 * 24 * 60 * 60,  # 7 days
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
        )

        # Return response with user data
        return {"user": user, "session_token": session_data["session_token"]}

    except httpx.RequestError as e:
        logging.error(f"Error calling Emergent Auth API: {e}")
        raise HTTPException(status_code=500, detail="Failed to process Google session")
    except Exception as e:
        logging.error(f"Error processing Google session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@api_router.post("/auth/logout")
async def logout(
    request: Request, response: Response, current_user: User = Depends(get_current_user)
):
    """
    Logout user by deleting session token from database and clearing cookie.
    """
    # Get session_token from cookie
    session_token = request.cookies.get("session_token")

    if session_token:
        # Delete session from database
        await db.google_sessions.delete_one({"session_token": session_token})

        # Clear cookie
        response.delete_cookie(
            key="session_token", path="/", secure=True, samesite="none"
        )

    return {"message": "Logged out successfully"}


# ============ PASSWORD RESET ROUTES (OTP-BASED) ============


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordWithOTPRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=6)


class PasswordResetOTP(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email: str
    otp: str
    expires_at: datetime
    verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request a password reset OTP via email.
    Generates a 6-digit OTP and sends it via GoHighLevel.
    """
    # Find user by email
    user_data = await db.users.find_one({"email": request.email})

    if not user_data:
        # Don't reveal if email exists for security
        return {"message": "If the email exists, an OTP has been sent", "success": True}

    user = User(**user_data)

    # Generate 6-digit OTP
    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=10
    )  # 10 minute expiration

    # Delete any existing OTPs for this user
    await db.password_reset_otps.delete_many({"email": request.email})

    # Store OTP in database
    otp_data = PasswordResetOTP(
        user_id=user.id, email=user.email, otp=otp, expires_at=expires_at
    )
    await db.password_reset_otps.insert_one(otp_data.model_dump())

    # Send OTP email via GoHighLevel
    from services.email_service import EmailService
    from services.email_templates import EmailTemplate
    from models.email import EmailRecipient

    # Generate OTP email content
    email_content = EmailTemplate.password_reset_otp_template(
        recipient_name=user.name, otp=otp, expiration_minutes=10
    )

    try:
        # Send email directly using the client
        result = await ghl_email_client.send_email(
            to_email=user.email,
            to_name=user.name,
            subject=email_content["subject"],
            html_content=email_content["html"],
            text_content=email_content["text"],
        )

        if result.get("success"):
            logger.info(f"Password reset OTP sent to {user.email}: {otp}")
        else:
            logger.error(f"Failed to send OTP email: {result.get('error_message')}")
    except Exception as e:
        logger.error(f"Failed to send OTP email: {str(e)}")
        # Don't fail the request if email fails

    return {"message": "If the email exists, an OTP has been sent", "success": True}


@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify the OTP for password reset.
    """
    # Find OTP entry
    otp_data = await db.password_reset_otps.find_one(
        {"email": request.email, "otp": request.otp, "verified": False}
    )

    if not otp_data:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    reset_otp = PasswordResetOTP(**otp_data)

    # Make expires_at timezone-aware if it's naive
    if reset_otp.expires_at.tzinfo is None:
        reset_otp.expires_at = reset_otp.expires_at.replace(tzinfo=timezone.utc)

    # Check if OTP is expired
    if reset_otp.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400, detail="OTP has expired. Please request a new one."
        )

    # Mark OTP as verified
    await db.password_reset_otps.update_one(
        {"id": reset_otp.id}, {"$set": {"verified": True}}
    )

    return {"message": "OTP verified successfully", "verified": True}


@api_router.post("/auth/reset-password-otp")
async def reset_password_with_otp(request: ResetPasswordWithOTPRequest):
    """
    Reset password using verified OTP.
    """
    # Find and validate OTP
    otp_data = await db.password_reset_otps.find_one(
        {"email": request.email, "otp": request.otp, "verified": True}
    )

    if not otp_data:
        raise HTTPException(status_code=400, detail="Invalid or unverified OTP")

    reset_otp = PasswordResetOTP(**otp_data)

    # Make expires_at timezone-aware if it's naive
    if reset_otp.expires_at.tzinfo is None:
        reset_otp.expires_at = reset_otp.expires_at.replace(tzinfo=timezone.utc)

    # Check if OTP is expired
    if reset_otp.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400, detail="OTP has expired. Please request a new one."
        )

    # Find user
    user_data = await db.users.find_one({"email": request.email})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    # Update password
    hashed_password = pwd_context.hash(request.new_password)
    await db.users.update_one(
        {"email": request.email}, {"$set": {"password_hash": hashed_password}}
    )

    # Delete the OTP after successful password reset
    await db.password_reset_otps.delete_one({"id": reset_otp.id})

    logger.info(f"Password reset successful for user {reset_otp.user_id}")

    return {
        "message": "Password reset successful. You can now login with your new password.",
        "success": True,
    }


# ============ PROJECT ROUTES ============


@api_router.post("/projects", response_model=Project)
async def create_project(
    project_data: ProjectCreate, current_user: User = Depends(get_current_user)
):
    """
    Create a new project and its associated chat channel.
    """
    if current_user.role not in ["admin", "user"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    project_dict = project_data.model_dump()
    project_dict["created_by"] = current_user.id

    project = Project(**project_dict)
    await db.projects.insert_one(project.model_dump())

    # Invalidate project cache so new project appears immediately
    # Clear for all users because team/guest access can vary
    try:
        await invalidate_project_cache()
    except Exception as e:
        logger.error(f"Failed to invalidate project cache after create: {e}")

    # Best-effort side effects: channel creation + notifications
    try:
        # --- Robust project channel creation ---
        # Ensure we don't create duplicate project channels
        existing_channel = await db.channels.find_one(
            {"project_id": project.id, "type": "project"}, {"_id": 0}
        )
        if not existing_channel:
            channel_members = list(set([current_user.id] + project.team_members))

            channel_doc = {
                "id": str(uuid.uuid4()),
                "name": f"#{project.name}",
                "type": "project",
                "project_id": project.id,
                "members": channel_members,
                "created_by": current_user.id,
                "description": None,
                "is_private": False,
                "permissions": {
                    "can_send_messages": True,
                    "can_invite_members": False,
                    "can_edit_channel": False,
                    "can_delete_messages": False,
                    "read_only": False,
                },
                # Category "project" so it appears in the Project section in chat UI
                "category": "project",
                "dm_participants": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": None,
                # Unique slug to satisfy unique index on channels.slug
                "slug": str(uuid.uuid4()),
            }

            await db.channels.insert_one(channel_doc)

        # Notification: New project created - notify all team members
        for member_id in project.team_members:
            if member_id != current_user.id:
                member_user = await db.users.find_one({"id": member_id}, {"_id": 0})
                if member_user:
                    notification_data = NotificationCreate(
                        user_id=member_id,
                        type="project_created",
                        title="New project assigned",
                        message=f'{current_user.name} added you to project "{project.name}"',
                        link=f"/projects?selected={project.id}",
                        priority="normal",
                        metadata={
                            "project_id": project.id,
                            "sender_name": current_user.name,
                            "project_name": project.name,
                        },
                    )
                    await create_notification(notification_data)
    except Exception as e:
        # Log but don't break project creation if side effects fail
        logger.error(f"Post-create side effects failed for project {project.id}: {e}")

    return project


@api_router.get("/projects")
async def get_projects(
    current_user: User = Depends(get_current_user),
    pagination: PaginationParams = Depends()
):
    """
    Get projects with pagination and caching
    Performance optimized: Uses cache and field projection
    """
    # Try to get from cache first
    cache_key = project_list_cache_key(current_user.id)
    cached_data = await cache.get(cache_key)
    
    if cached_data:
        # Return paginated from cache
        start_idx = pagination.skip
        end_idx = start_idx + pagination.limit
        paginated_data = cached_data[start_idx:end_idx]
        return paginate_response(
            data=paginated_data,
            total=len(cached_data),
            page=pagination.page,
            limit=pagination.limit
        )
    
    # Build query based on role
    if current_user.role == "admin":
        query = {}
    else:
        # Users see projects they created, are assigned to, or are guests of
        query = {
            "$or": [
                {"created_by": current_user.id},
                {"team_members": current_user.id},
                {"guests": current_user.id},
            ]
        }
    
    # Count total for pagination
    total = await db.projects.count_documents(query)
    
    # Fetch projects with pagination and optimized fields
    projects = await db.projects.find(
        query,
        PROJECT_LIST_FIELDS
    ).skip(pagination.skip).limit(pagination.limit).to_list(pagination.limit)
    
    # Cache the raw project dicts for 5 minutes
    await cache.set(cache_key, projects, ttl_seconds=300)
    
    return paginate_response(
        data=projects,
        total=total,
        page=pagination.page,
        limit=pagination.limit
    )


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access - admin, creator, team member, or guest
    if current_user.role == "admin":
        return Project(**project)
    elif (
        current_user.id == project["created_by"]
        or current_user.id in project.get("team_members", [])
        or current_user.id in project.get("guests", [])
    ):
        return Project(**project)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")


@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(
    project_id: str, updates: dict, current_user: User = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access
    if current_user.role not in ["admin"] and current_user.id != project["created_by"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    old_team_members = set(project.get("team_members", []))
    old_status = project.get("status")
    old_archived = project.get("archived", False)

    # If team_members are being updated, update the project channel too
    if "team_members" in updates:
        new_team_members = set(updates["team_members"])
        added_members = new_team_members - old_team_members

        # Find the project channel
        channel = await db.channels.find_one(
            {"project_id": project_id, "type": "project"}, {"_id": 0}
        )
        if channel:
            # Update channel members (include creator + all team members)
            new_members = list(set([project["created_by"]] + updates["team_members"]))
            await db.channels.update_one(
                {"id": channel["id"]}, {"$set": {"members": new_members}}
            )

        # Notify newly added team members
        for member_id in added_members:
            if member_id != current_user.id:
                notification_data = NotificationCreate(
                    user_id=member_id,
                    type="project_assigned",
                    title=f"Added to project",
                    message=f'{current_user.name} added you to project "{project.get("name")}"',
                    link=f"/projects?selected={project_id}",
                    metadata={"project_id": project_id},
                )
                await create_notification(notification_data)

    await db.projects.update_one({"id": project_id}, {"$set": updates})
    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})

    # Invalidate project cache so updated project appears correctly
    try:
        await invalidate_project_cache()
    except Exception as e:
        logger.error(f"Failed to invalidate project cache after update: {e}")

    # Check if project status affects channel visibility
    new_status = updates.get("status", old_status)
    new_archived = updates.get("archived", old_archived)

    # Broadcast channel update if project status changed to affect channel visibility
    status_affects_visibility = (
        (new_status == "Completed" and old_status != "Completed")  # Project completed
        or (
            new_status != "Completed" and old_status == "Completed"
        )  # Project reactivated
        or (new_archived != old_archived)  # Archive status changed
    )

    if status_affects_visibility:
        logging.info(
            f"Project {project_id} status change affects channel visibility - broadcasting update"
        )
        await manager.broadcast_channel_update()

    # Notification: Project marked as completed
    if updates.get("status") == "Completed" and old_status != "Completed":
        # Notify all team members
        all_members = set(updated_project.get("team_members", [])) | {
            updated_project.get("created_by")
        }
        for member_id in all_members:
            if member_id and member_id != current_user.id:
                notification_data = NotificationCreate(
                    user_id=member_id,
                    type="project_completed",
                    title=f"Project completed",
                    message=f'Project "{updated_project.get("name")}" has been marked as completed',
                    link=f"/projects?selected={project_id}",
                    metadata={"project_id": project_id},
                )
                await create_notification(notification_data)

    return Project(**updated_project)


@api_router.put("/projects/{project_id}/visibility")
async def update_project_visibility(
    project_id: str,
    visibility_settings: dict,
    current_user: User = Depends(get_current_user),
):
    """Update section visibility settings for a project"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Only admins, managers, and project creator can update visibility
    if current_user.role not in ["admin", "manager"] and current_user.id != project.get(
        "created_by"
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.projects.update_one(
        {"id": project_id}, {"$set": {"section_visibility": visibility_settings}}
    )

    # Invalidate cache so visibility changes are reflected
    try:
        await invalidate_project_cache()
    except Exception as e:
        logger.error(f"Failed to invalidate project cache after visibility update: {e}")

    updated_project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return Project(**updated_project)


@api_router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str, current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete project and associated data
    await db.projects.delete_one({"id": project_id})
    await db.tasks.delete_many({"project_id": project_id})
    await db.documents.delete_many({"project_id": project_id})
    await db.guest_links.delete_many({"project_id": project_id})

    # Also delete the project channel
    await db.channels.delete_many({"project_id": project_id, "type": "project"})

    # Invalidate project cache
    try:
        await invalidate_project_cache()
    except Exception as e:
        logger.error(f"Failed to invalidate project cache after delete: {e}")

    # Notify all users that channels have been updated
    logging.info(f"Project {project_id} deleted - broadcasting channel update")
    await manager.broadcast_channel_update()

    return {"message": "Project deleted"}


# ============ GUEST LINK ROUTES ============


@api_router.post("/projects/{project_id}/generate-guest-link")
async def generate_guest_link(
    project_id: str, current_user: User = Depends(get_current_user)
):
    """Generate or regenerate a guest link for a project (admin/manager only)"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access - only admin or project owner/manager can generate links
    if (
        current_user.role not in ["admin", "manager"]
        and current_user.id != project["created_by"]
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to generate guest links"
        )

    # Generate unique token
    guest_token = str(uuid.uuid4())

    # Update project with guest link
    await db.projects.update_one(
        {"id": project_id},
        {
            "$set": {
                "guest_link": guest_token,
                "guest_link_created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {
        "guest_link": guest_token,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.delete("/projects/{project_id}/revoke-guest-link")
async def revoke_guest_link(
    project_id: str, current_user: User = Depends(get_current_user)
):
    """Revoke a guest link for a project"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access
    if (
        current_user.role not in ["admin", "manager"]
        and current_user.id != project["created_by"]
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to revoke guest links"
        )

    # Remove guest link
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"guest_link": None, "guest_link_created_at": None}},
    )

    return {"message": "Guest link revoked"}


@api_router.get("/guest-link/{token}")
async def validate_guest_link(token: str):
    """Validate a guest link and return project preview (no auth required)"""
    project = await db.projects.find_one({"guest_link": token}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Invalid or expired guest link")

    # Check if project is completed (links expire when project is completed)
    if project.get("status") == "Completed":
        raise HTTPException(
            status_code=410,
            detail="This guest link has expired. The project is completed.",
        )

    # Return project preview
    return {
        "project_id": project["id"],
        "project_name": project["name"],
        "client_name": project["client_name"],
        "description": project.get("description", ""),
        "status": project["status"],
    }


@api_router.post("/guest-access/{token}")
async def guest_access(token: str, guest_data: dict):
    """Simple guest access - just name and email, no password required"""
    logging.info(
        f"Guest access attempt - Token: {token}, Email: {guest_data.get('email')}"
    )

    # Validate guest link
    project = await db.projects.find_one({"guest_link": token}, {"_id": 0})
    if not project:
        logging.error(f"Project not found for token: {token}")
        raise HTTPException(status_code=404, detail="Invalid or expired guest link")

    # Check if project is completed
    if project.get("status") == "Completed":
        logging.warning(f"Project {project['id']} is completed, guest link expired")
        raise HTTPException(
            status_code=410,
            detail="This guest link has expired. The project is completed.",
        )

    email = guest_data.get("email", "").strip().lower()
    name = guest_data.get("name", "").strip()

    if not email or not name:
        raise HTTPException(status_code=400, detail="Name and email are required")

    logging.info(
        f"Processing guest access for {name} <{email}> to project {project['id']}"
    )

    # Check if user already exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})

    if existing_user:
        user = User(**existing_user)
        logging.info(f"Existing user found: {user.id}")

        # Update role to client if not admin/manager
        if user.role not in ["admin", "manager"]:
            await db.users.update_one({"id": user.id}, {"$set": {"role": "client"}})
            user.role = "client"
            logging.info(f"Updated user {user.id} role to client")
    else:
        # Create new client user (no password needed for guest link access)
        user_id = str(uuid.uuid4())
        user_data = {
            "id": user_id,
            "name": name,
            "email": email,
            "role": "client",
            "password_hash": pwd_context.hash(
                str(uuid.uuid4())
            ),  # Random password, client won't use it
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_data)
        user = User(**user_data)
        logging.info(f"Created new client user: {user.id}")

    # Add user to project guests if not already there
    if user.id not in project.get("guests", []) and user.id not in project.get(
        "team_members", []
    ):
        await db.projects.update_one(
            {"id": project["id"]}, {"$addToSet": {"guests": user.id}}
        )
        logging.info(f"Added user {user.id} to project {project['id']} guests")

        # Add to project channel
        channel = await db.channels.find_one(
            {"project_id": project["id"], "type": "project"}, {"_id": 0}
        )
        if channel:
            await db.channels.update_one(
                {"id": channel["id"]}, {"$addToSet": {"members": user.id}}
            )
            logging.info(f"Added user {user.id} to project channel")
    else:
        logging.info(f"User {user.id} already member of project {project['id']}")

    # Verify the update
    updated_project = await db.projects.find_one({"id": project["id"]}, {"_id": 0})
    logging.info(
        f"Project {project['id']} guests after update: {updated_project.get('guests', [])}"
    )

    # Generate JWT token (same format as login)
    access_token = create_access_token(data={"sub": user.id})

    logging.info(f"Guest access successful for {user.id}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
        "project_id": project["id"],
    }


@api_router.post("/guest-link/{token}/join")
async def join_project_as_guest(
    token: str, current_user: User = Depends(get_current_user)
):
    """Join a project as a guest using the guest link"""
    logging.info(
        f"Guest join attempt - Token: {token}, User: {current_user.id}, Role: {current_user.role}"
    )

    project = await db.projects.find_one({"guest_link": token}, {"_id": 0})
    if not project:
        logging.error(f"Project not found for token: {token}")
        raise HTTPException(status_code=404, detail="Invalid or expired guest link")

    logging.info(f"Found project: {project['id']} - {project['name']}")

    # Check if project is completed
    if project.get("status") == "Completed":
        logging.warning(f"Project {project['id']} is completed, guest link expired")
        raise HTTPException(
            status_code=410,
            detail="This guest link has expired. The project is completed.",
        )

    # Check if user is already a guest or team member
    if current_user.id in project.get("guests", []) or current_user.id in project.get(
        "team_members", []
    ):
        logging.info(
            f"User {current_user.id} already member of project {project['id']}"
        )
        return {
            "message": "Already a member of this project",
            "project_id": project["id"],
            "user_role": current_user.role,
        }

    # Always set role to client for users joining via guest link (unless they're admin/manager)
    if current_user.role not in ["admin", "manager"]:
        logging.info(f"Updating user {current_user.id} role to client")
        await db.users.update_one({"id": current_user.id}, {"$set": {"role": "client"}})

    # Add user to project guests list
    logging.info(f"Adding user {current_user.id} to project {project['id']} guests")
    await db.projects.update_one(
        {"id": project["id"]}, {"$addToSet": {"guests": current_user.id}}
    )

    # Add client to project channel
    channel = await db.channels.find_one(
        {"project_id": project["id"], "type": "project"}, {"_id": 0}
    )
    if channel:
        logging.info(
            f"Adding user {current_user.id} to project channel {channel['id']}"
        )
        await db.channels.update_one(
            {"id": channel["id"]}, {"$addToSet": {"members": current_user.id}}
        )
    else:
        logging.warning(f"No project channel found for project {project['id']}")

    logging.info(
        f"Successfully added user {current_user.id} as client to project {project['id']}"
    )
    return {
        "message": "Successfully joined project as client",
        "project_id": project["id"],
        "user_role": "client",
    }


@api_router.get("/projects/{project_id}/members")
async def get_project_members(
    project_id: str, current_user: User = Depends(get_current_user)
):
    """Get team members and guests for a project"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access - must be team member or guest
    if (
        current_user.role != "admin"
        and current_user.id != project["created_by"]
        and current_user.id not in project.get("team_members", [])
        and current_user.id not in project.get("guests", [])
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get team members
    team_member_ids = [project["created_by"]] + project.get("team_members", [])
    team_members = await db.users.find(
        {"id": {"$in": team_member_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(1000)

    # Get guests
    guest_ids = project.get("guests", [])
    guests = await db.users.find(
        {"id": {"$in": guest_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(1000)

    return {"team_members": team_members, "guests": guests}


@api_router.get("/projects/{project_id}/full-data")
async def get_project_full_data(
    project_id: str, current_user: User = Depends(get_current_user)
):
    """
    Optimized endpoint that returns ALL project data in a single call
    Reduces 9 API calls to 1 for better performance
    """
    # Get project
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access - admin, creator, team member, or guest
    if (
        current_user.role != "admin"
        and current_user.id != project["created_by"]
        and current_user.id not in project.get("team_members", [])
        and current_user.id not in project.get("guests", [])
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch all data in parallel
    (
        tasks_data,
        users_data,
        notes_data,
        links_data,
        meetings_data,
        docs_data,
        guest_link_data,
    ) = await asyncio.gather(
        db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000),
        db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000),
        db.internal_notes.find({"project_id": project_id}, {"_id": 0}).to_list(1000),
        db.useful_links.find({"project_id": project_id}, {"_id": 0}).to_list(1000),
        db.meeting_notes.find({"project_id": project_id}, {"_id": 0}).to_list(1000),
        db.documents.find(
            {"project_id": project_id, "type": "deliverables"}, {"_id": 0}
        ).to_list(1000),
        db.guest_links.find_one({"project_id": project_id}, {"_id": 0}),
        return_exceptions=True,
    )

    # Check GHL integration status
    ghl_integration = await db.integrations.find_one(
        {"name": "gohighlevel"}, {"_id": 0}
    )
    ghl_active = (
        ghl_integration and ghl_integration.get("is_connected", False)
        if ghl_integration
        else False
    )

    return {
        "project": project,
        "tasks": tasks_data if not isinstance(tasks_data, Exception) else [],
        "users": users_data if not isinstance(users_data, Exception) else [],
        "internal_notes": notes_data if not isinstance(notes_data, Exception) else [],
        "useful_links": links_data if not isinstance(links_data, Exception) else [],
        "meeting_notes": meetings_data
        if not isinstance(meetings_data, Exception)
        else [],
        "deliverables": docs_data if not isinstance(docs_data, Exception) else [],
        "guest_link": guest_link_data
        if not isinstance(guest_link_data, Exception)
        else None,
        "ghl_integration_active": ghl_active,
    }


# ============ AI TASK EXTRACTION ROUTES ============


@api_router.post("/projects/{project_id}/extract-tasks-ai")
async def extract_tasks_with_ai(
    project_id: str, request_data: dict, current_user: User = Depends(get_current_user)
):
    """Extract tasks from meeting notes or URLs using AI"""
    from openai import AsyncOpenAI

    logging.info(
        f"AI task extraction request for project {project_id} by user {current_user.id}"
    )

    try:
        # Get project details for context
        project = await db.projects.find_one({"id": project_id}, {"_id": 0})
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check access
        if (
            current_user.role != "admin"
            and current_user.id != project["created_by"]
            and current_user.id not in project.get("team_members", [])
            and current_user.id not in project.get("guests", [])
        ):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Get meeting notes and useful links based on selected IDs
        content_to_analyze = []

        # Add selected meeting notes
        selected_meeting_notes = request_data.get("selected_meeting_notes", [])
        if selected_meeting_notes:
            # Check meeting_notes collection
            meeting_notes = await db.meeting_notes.find(
                {"id": {"$in": selected_meeting_notes}}, {"_id": 0}
            ).to_list(1000)

            logging.info(
                f"Found {len(meeting_notes)} selected meeting notes in meeting_notes collection"
            )
            for note in meeting_notes:
                note_content = note.get("content", "")
                if note_content:
                    content_to_analyze.append(
                        f"=== Meeting Note ({note.get('date', 'N/A')}) ===\n{note_content}"
                    )
                    logging.info(
                        f"Added meeting note with {len(note_content)} characters"
                    )

            # ALSO check documents collection for type='meeting_summaries' with selected IDs
            meeting_docs = await db.documents.find(
                {"id": {"$in": selected_meeting_notes}, "type": "meeting_summaries"},
                {"_id": 0},
            ).to_list(1000)

            logging.info(
                f"Found {len(meeting_docs)} selected meeting summaries in documents collection"
            )
            for doc in meeting_docs:
                doc_content = doc.get(
                    "url", ""
                )  # The 'url' field actually contains the content for meeting notes
                if doc_content:
                    content_to_analyze.append(
                        f"=== Meeting Note: {doc.get('title', 'Untitled')} ===\n{doc_content}"
                    )
                    logging.info(
                        f"Added meeting summary with {len(doc_content)} characters"
                    )

        # Add selected useful links content
        selected_useful_links = request_data.get("selected_useful_links", [])
        if selected_useful_links:
            # Check both useful_links and documents collections
            useful_links = await db.useful_links.find(
                {"id": {"$in": selected_useful_links}}, {"_id": 0}
            ).to_list(1000)

            # Also check documents collection for backwards compatibility
            useful_docs = await db.documents.find(
                {"id": {"$in": selected_useful_links}, "type": "docs_links"}, {"_id": 0}
            ).to_list(1000)

            all_links = useful_links + useful_docs
            logging.info(f"Found {len(all_links)} selected useful links")

            for link in all_links:
                url = link.get("url", "")
                title = link.get("title", "Untitled")

                # Try to fetch content from URL
                if url:
                    try:
                        logging.info(f"Attempting to fetch content from: {url}")
                        import httpx
                        import re

                        # Convert Google Docs URLs to export format for plain text
                        if "docs.google.com/document" in url:
                            # Extract document ID
                            doc_id_match = re.search(
                                r"/document/d/([a-zA-Z0-9-_]+)", url
                            )
                            if doc_id_match:
                                doc_id = doc_id_match.group(1)
                                # Convert to plain text export URL
                                url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
                                logging.info(f"Converted to export URL: {url}")

                        # Try to fetch the URL content
                        async with httpx.AsyncClient(
                            timeout=10.0, follow_redirects=True
                        ) as client:
                            response = await client.get(url)
                            if response.status_code == 200:
                                # Get text content
                                text_content = response.text[
                                    :10000
                                ]  # Limit to first 10k chars

                                # Log first 500 chars to debug what we're getting
                                logging.info(
                                    f"Fetched content preview (first 500 chars): {text_content[:500]}"
                                )

                                # Check if we got meaningful content (not just HTML)
                                if (
                                    len(text_content.strip()) < 50
                                    or "<html" in text_content.lower()[:100]
                                ):
                                    logging.warning(
                                        f"Fetched content appears to be HTML or empty. Consider making the document publicly accessible."
                                    )
                                    content_to_analyze.append(
                                        f"=== Document: {title} ({url}) ===\nCould not fetch content. Please ensure the document is publicly accessible (Anyone with the link can view)."
                                    )
                                else:
                                    content_to_analyze.append(
                                        f"=== Document: {title} ({url}) ===\n{text_content}"
                                    )
                                    logging.info(
                                        f"Added content from {url} with {len(text_content)} characters"
                                    )
                            else:
                                content_to_analyze.append(
                                    f"=== Document: {title} ({url}) ===\nCould not fetch content (Status: {response.status_code}). Please ensure the document is publicly accessible."
                                )
                    except Exception as e:
                        logging.warning(f"Failed to fetch {url}: {e}")
                        content_to_analyze.append(
                            f"=== Document: {title} ({url}) ===\nCould not fetch content: {str(e)}. Please ensure the document is publicly accessible."
                        )
                else:
                    # If no URL, just add title and any description
                    content_to_analyze.append(
                        f"=== Document: {title} ===\nNo content available"
                    )

        if not content_to_analyze:
            logging.info("No content found to analyze")
            return {"tasks": [], "message": "No content found to analyze"}

        logging.info(f"Total content sections to analyze: {len(content_to_analyze)}")

        # Combine all content
        combined_content = "\n\n".join(content_to_analyze)

        # Log the combined content length and preview
        logging.info(f"Combined content length: {len(combined_content)} characters")
        logging.info(
            f"Combined content preview (first 1000 chars): {combined_content[:1000]}"
        )

        # Prepare AI prompt
        system_message = """You are an AI assistant that extracts actionable tasks from meeting notes and project documents.
        
Your job is to:
1. Identify all actionable tasks, to-dos, and action items
2. Break down complex tasks into smaller, manageable steps
3. Extract or infer deadlines when mentioned
4. Categorize tasks by priority (High, Medium, Low) based on urgency
5. Provide clear, concise task titles and detailed descriptions

Return ONLY a JSON array of tasks in this exact format:
[
  {
    "title": "Clear, actionable task title",
    "description": "Detailed description of what needs to be done, including context and any specific requirements",
    "due_date": "YYYY-MM-DD" or null if not mentioned,
    "priority": "High" or "Medium" or "Low",
    "status": "Not Started"
  }
]

Important guidelines:
- Each task should be specific and actionable
- Descriptions should include relevant context from the meeting notes
- If a deadline is mentioned relative to a date (e.g., "next week"), calculate the actual date
- Default to "Medium" priority unless urgency is clearly indicated
- All tasks should start with "Not Started" status
- Return ONLY the JSON array, no other text"""

        project_start_date = project.get("start_date", "")
        user_prompt = f"""Project: {project["name"]}
Client: {project["client_name"]}
Project Start Date: {project_start_date}

Extract all tasks from the following content:

{combined_content}

Remember to:
- Break down complex items into specific, actionable tasks
- Use the project start date as reference for calculating relative deadlines
- Include all relevant context in task descriptions
- Return ONLY the JSON array"""

        # Initialize OpenAI client
        api_key = settings.emergent_llm_key or settings.openai_api_key
        if not api_key:
            # Return a clear, non-crashy error when no LLM key is configured
            raise HTTPException(
                status_code=400,
                detail="AI task extraction is not configured. Please set EMERGENT_LLM_KEY or OPENAI_API_KEY on the backend.",
            )

        client = AsyncOpenAI(api_key=api_key)

        # Send message and get response
        logging.info("Sending request to AI for task extraction")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_prompt},
            ],
        )

        response_text = response.choices[0].message.content
        logging.info(f"AI response received: {response_text[:200]}...")

        # Parse AI response
        try:
            # Try to extract JSON from response
            import re

            json_match = re.search(r"\[.*\]", response_text, re.DOTALL)
            if json_match:
                tasks_json = json_match.group()
                extracted_tasks = json.loads(tasks_json)
            else:
                extracted_tasks = json.loads(response_text)

            logging.info(f"Successfully extracted {len(extracted_tasks)} tasks")

            return {
                "tasks": extracted_tasks,
                "message": f"Successfully extracted {len(extracted_tasks)} tasks",
                "project_id": project_id,
            }

        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse AI response as JSON: {e}")
            logging.error(f"AI response was: {response_text}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse AI response. Please try again.",
            )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"AI task extraction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to extract tasks: {str(e)}"
        )


# ============ MILLI AI ASSISTANT ROUTES ============


@api_router.get("/milli/channel")
async def get_or_create_milli_channel(current_user: User = Depends(get_current_user)):
    """Get or create the Milli AI assistant channel for the user.

    Previously this was restricted for client users, but we now allow all
    authenticated users (including clients/guests) to access Milli.
    """

    # Look for existing Milli channel for this user
    channel_id = f"milli-{current_user.id}"

    existing_channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if existing_channel:
        return existing_channel

    # Create new Milli channel
    milli_channel = {
        "id": channel_id,
        "name": "Chat with Milli",
        "type": "milli_ai",
        "members": [current_user.id],
        "created_by": "system",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.channels.insert_one(milli_channel)
    logging.info(f"Created new Milli channel for user {current_user.id}")

    return milli_channel


@api_router.post("/milli/chat")
async def chat_with_milli(
    message_data: dict, current_user: User = Depends(get_current_user)
):
    """Send a message to Milli AI assistant and get response - OPTIMIZED VERSION"""
    from openai import AsyncOpenAI

    try:
        user_message = message_data.get("message", "")
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")

        logging.info(
            f"Milli chat request from user {current_user.id}: {user_message[:100]}..."
        )

        # PERFORMANCE OPTIMIZATION: Fetch only relevant data based on question keywords
        # Check if question is about specific topics to avoid fetching everything
        message_lower = user_message.lower()
        needs_team_data = any(word in message_lower for word in ['team', 'member', 'user', 'people', 'who'])
        needs_task_data = any(word in message_lower for word in ['task', 'todo', 'work', 'assignment'])
        needs_project_data = any(word in message_lower for word in ['project', 'client'])
        needs_detailed_data = any(word in message_lower for word in ['meeting', 'note', 'document', 'kpi', 'metric'])
        
        # If no specific keywords, assume general question - load minimal context
        if not any([needs_team_data, needs_task_data, needs_project_data, needs_detailed_data]):
            needs_task_data = True  # Default to showing user's tasks
            needs_project_data = True  # and projects

        # Gather focused context about the user and workspace
        context_parts = []

        # 1. Always include user profile
        context_parts.append("=== USER PROFILE ===")
        context_parts.append(f"Name: {current_user.name}")
        context_parts.append(f"Email: {current_user.email}")
        context_parts.append(f"Role: {current_user.role}")
        if current_user.timezone:
            context_parts.append(f"Timezone: {current_user.timezone}")

        # PERFORMANCE: Fetch all data in parallel to reduce wait time
        fetch_tasks = []
        
        # 2. Conditionally fetch team members
        if needs_team_data:
            fetch_tasks.append(
                db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1}).to_list(50)
            )
        else:
            fetch_tasks.append(asyncio.sleep(0, result=[]))
        
        # 3. Conditionally fetch user's personal tasks
        if needs_task_data:
            fetch_tasks.append(
                db.tasks.find(
                    {
                        "$or": [
                            {"assignee": current_user.id},
                            {"assignee": current_user.email},
                        ],
                        "status": {"$ne": "Completed"}  # Only incomplete tasks
                    },
                    {"_id": 0, "title": 1, "status": 1, "priority": 1, "due_date": 1, "description": 1, "project_id": 1}
                ).limit(20).to_list(20)
            )
        else:
            fetch_tasks.append(asyncio.sleep(0, result=[]))
        
        # 4. Conditionally fetch user's projects
        if needs_project_data:
            fetch_tasks.append(
                db.projects.find(
                    {
                        "$or": [
                            {"created_by": current_user.id},
                            {"team_members": current_user.id},
                            {"guests": current_user.id},
                        ]
                    },
                    {"_id": 0, "id": 1, "name": 1, "client_name": 1, "status": 1, "priority": 1, "description": 1}
                ).limit(50).to_list(50)
            )
        else:
            fetch_tasks.append(asyncio.sleep(0, result=[]))
        
        # Execute all fetches in parallel
        all_users, user_tasks, user_projects = await asyncio.gather(*fetch_tasks)

        # 2. Add team members to context if fetched
        if all_users:
            context_parts.append(f"\n=== TEAM MEMBERS ({len(all_users)} total) ===")
            for user in all_users[:10]:  # Reduced from 20 to 10
                user_info = f"- {user.get('name')} ({user.get('email')}) - Role: {user.get('role', 'N/A')}"
                context_parts.append(user_info)

        # 3. Add user's personal tasks to context if fetched
        if user_tasks:
            context_parts.append(f"\n=== USER'S INCOMPLETE TASKS ({len(user_tasks)} shown) ===")
            for task in user_tasks[:10]:  # Reduced from 15 to 10
                task_info = f"- '{task.get('title')}'"
                task_info += f" | Status: {task.get('status')}"
                task_info += f" | Priority: {task.get('priority', 'N/A')}"
                if task.get("due_date"):
                    task_info += f" | Due: {task.get('due_date')}"
                if task.get("description"):
                    task_info += f" | Description: {task.get('description')[:100]}"
                context_parts.append(task_info)

        # 4. Add user's projects to context if fetched
        project_ids = []
        if user_projects:
            context_parts.append(f"\n=== USER'S PROJECTS ({len(user_projects)} total) ===")
            project_ids = [p.get("id") for p in user_projects]
            for project in user_projects[:10]:  # Reduced to 10 projects max
                project_info = f"\nProject: {project.get('name')}"
                project_info += f"\n  Client: {project.get('client_name', 'N/A')}"
                project_info += f"\n  Status: {project.get('status', 'Active')}"
                context_parts.append(project_info)

        # 5. Conditionally fetch project tasks only if specifically needed
        if needs_detailed_data and project_ids:
            all_project_tasks = await db.tasks.find(
                {"project_id": {"$in": project_ids}, "status": {"$ne": "Completed"}}, 
                {"_id": 0, "title": 1, "status": 1, "project_id": 1, "assignee": 1, "priority": 1, "due_date": 1}
            ).limit(50).to_list(50)  # Reduced from 500 to 50

            if all_project_tasks:
                context_parts.append(
                    f"\n=== PROJECT TASKS ({len(all_project_tasks)} total across all projects) ==="
                )
                # Create lookup dictionaries to avoid O(n) searches
                project_lookup = {p.get("id"): p for p in user_projects}
                user_lookup = {u.get("id"): u for u in all_users} if all_users else {}
                
                # Group by project
                tasks_by_project = {}
                for task in all_project_tasks:
                    pid = task.get("project_id", "Unknown")
                    if pid not in tasks_by_project:
                        tasks_by_project[pid] = []
                    tasks_by_project[pid].append(task)

                for pid, tasks in tasks_by_project.items():
                    project = project_lookup.get(pid)
                    project_name = project.get("name", "Unknown Project") if project else "Unknown Project"
                    incomplete = [t for t in tasks if t.get("status") != "Completed"]
                    context_parts.append(
                        f"\n{project_name}: {len(tasks)} total, {len(incomplete)} incomplete"
                    )
                    for task in tasks[:10]:  # Show up to 10 per project
                        task_info = f"  - '{task.get('title')}' | {task.get('status')} | Priority: {task.get('priority', 'N/A')}"
                        if task.get("assignee") and user_lookup:
                            assigned_user = user_lookup.get(task.get("assignee"))
                            if assigned_user:
                                task_info += f" | Assigned: {assigned_user.get('name')}"
                        if task.get("due_date"):
                            task_info += f" | Due: {task.get('due_date')}"
                        context_parts.append(task_info)

        # 6. Get meeting notes with full details (only if needed)
        if needs_detailed_data and project_ids:
            meeting_notes = (
                await db.meeting_notes.find(
                    {"project_id": {"$in": project_ids}}, 
                    {"_id": 0, "meeting_name": 1, "project_id": 1, "meeting_date": 1, "summary": 1, "content": 1, "recording_link": 1}
                )
                .sort("created_at", -1)
                .to_list(20)
            )

            if meeting_notes:
                context_parts.append(
                    f"\n=== MEETING NOTES ({len(meeting_notes)} total) ==="
                )
                project_lookup = {p.get("id"): p for p in user_projects}
                for note in meeting_notes:
                    project = project_lookup.get(note.get("project_id"))
                    project_name = project.get("name", "Unknown") if project else "Unknown"
                    note_info = f"\n'{note.get('meeting_name', 'Untitled')}' - {project_name}"
                    note_info += f"\n  Date: {note.get('meeting_date', 'No date')}"
                    if note.get("summary"):
                        note_info += f"\n  Summary: {note.get('summary')[:200]}"
                    if note.get("content"):
                        note_info += f"\n  Content: {note.get('content')[:300]}"
                    if note.get("recording_link"):
                        note_info += f"\n  Recording: {note.get('recording_link')}"
                    context_parts.append(note_info)

        # 7. Get documents (docs_links, deliverables, useful_links) - only if needed
        if needs_detailed_data and project_ids:
            all_documents = (
                await db.documents.find(
                    {"project_id": {"$in": project_ids}}, 
                    {"_id": 0, "type": 1, "title": 1, "url": 1, "description": 1, "approved_by": 1, "project_id": 1, "content": 1}
                )
                .sort("created_at", -1)
                .to_list(50)  # Reduced from 100 to 50
            )

            if all_documents:
                project_lookup = {p.get("id"): p for p in user_projects}
                
                # Separate by type
                docs_links = [d for d in all_documents if d.get("type") == "docs_links"]
                deliverables = [d for d in all_documents if d.get("type") == "deliverables"]
                meeting_summaries = [d for d in all_documents if d.get("type") == "meeting_summaries"]

                if docs_links:
                    context_parts.append(
                        f"\n=== USEFUL LINKS & DOCUMENTS ({len(docs_links)} total) ==="
                    )
                    for doc in docs_links:
                        project = project_lookup.get(doc.get("project_id"))
                        project_name = project.get("name", "Unknown") if project else "Unknown"
                        doc_info = f"- '{doc.get('title', 'Untitled')}' - {project_name}"
                        if doc.get("url"):
                            doc_info += f"\n  URL: {doc.get('url')}"
                        if doc.get("description"):
                            doc_info += f"\n  Description: {doc.get('description')[:150]}"
                        context_parts.append(doc_info)

                if deliverables:
                    context_parts.append(
                        f"\n=== DELIVERABLES ({len(deliverables)} total) ==="
                    )
                    for deliv in deliverables:
                        project = project_lookup.get(deliv.get("project_id"))
                        project_name = project.get("name", "Unknown") if project else "Unknown"
                        deliv_info = f"- '{deliv.get('title', 'Untitled')}' - {project_name}"
                        if deliv.get("url"):
                            deliv_info += f"\n  URL: {deliv.get('url')}"
                        if deliv.get("description"):
                            deliv_info += f"\n  Description: {deliv.get('description')[:150]}"
                        if deliv.get("approved_by"):
                            deliv_info += f" | Approved by: {deliv.get('approved_by')}"
                        context_parts.append(deliv_info)

                # Get meeting summaries from documents collection
                if meeting_summaries:
                    context_parts.append(
                        f"\n=== MEETING SUMMARIES FROM DOCUMENTS ({len(meeting_summaries)} total) ==="
                    )
                    for meeting in meeting_summaries:
                        project = project_lookup.get(meeting.get("project_id"))
                        project_name = project.get("name", "Unknown") if project else "Unknown"
                        meeting_info = f"- '{meeting.get('title', 'Untitled')}' - {project_name}"
                        if meeting.get("content"):
                            meeting_info += f"\n  Content: {meeting.get('content')[:300]}"
                        if meeting.get("url"):
                            meeting_info += f"\n  Recording/Link: {meeting.get('url')}"
                        if meeting.get("description"):
                            meeting_info += f"\n  Description: {meeting.get('description')[:150]}"
                        context_parts.append(meeting_info)

        # 8. Get internal notes - only if needed
        if needs_detailed_data and project_ids:
            internal_notes = (
                await db.internal_notes.find(
                    {"project_id": {"$in": project_ids}}, 
                    {"_id": 0, "content": 1, "project_id": 1, "created_by": 1}
                )
                .sort("created_at", -1)
                .to_list(20)
            )

            if internal_notes:
                context_parts.append(
                    f"\n=== INTERNAL NOTES ({len(internal_notes)} total) ==="
                )
                project_lookup = {p.get("id"): p for p in user_projects}
                user_lookup = {u.get("id"): u for u in all_users} if all_users else {}
                
                for note in internal_notes:
                    project = project_lookup.get(note.get("project_id"))
                    project_name = project.get("name", "Unknown") if project else "Unknown"
                    note_info = f"- {project_name}: {note.get('content', '')[:200]}"
                    if note.get("created_by") and user_lookup:
                        author = user_lookup.get(note.get("created_by"))
                        if author:
                            note_info += f"\n  By: {author.get('name')}"
                    context_parts.append(note_info)

        # 9. Get KPIs (Key Performance Indicators) - only if needed
        if needs_detailed_data and project_ids:
            kpis = (
                await db.kpis.find(
                    {"project_id": {"$in": project_ids}}, 
                    {"_id": 0, "name": 1, "project_id": 1, "metric": 1, "current_value": 1, 
                     "target_value": 1, "unit": 1, "status": 1, "period": 1, "description": 1}
                )
                .sort("created_at", -1)
                .to_list(30)  # Reduced from 50 to 30
            )

            if kpis:
                context_parts.append(
                    f"\n=== KPIs - KEY PERFORMANCE INDICATORS ({len(kpis)} total) ==="
                )
                project_lookup = {p.get("id"): p for p in user_projects}
                
                for kpi in kpis:
                    project = project_lookup.get(kpi.get("project_id"))
                    project_name = project.get("name", "Unknown") if project else "Unknown"
                    kpi_info = f"\n{kpi.get('name', 'Untitled KPI')} - {project_name}"
                    kpi_info += f"\n  Metric: {kpi.get('metric', 'N/A')}"
                    if kpi.get("current_value") is not None:
                        kpi_info += f"\n  Current Value: {kpi.get('current_value')}"
                    if kpi.get("target_value") is not None:
                        kpi_info += f"\n  Target Value: {kpi.get('target_value')}"
                    if kpi.get("unit"):
                        kpi_info += f"\n  Unit: {kpi.get('unit')}"
                    if kpi.get("status"):
                        kpi_info += f"\n  Status: {kpi.get('status')}"
                    if kpi.get("period"):
                        kpi_info += f"\n  Period: {kpi.get('period')}"
                    if kpi.get("description"):
                        kpi_info += f"\n  Description: {kpi.get('description')[:150]}"
                    context_parts.append(kpi_info)

        # 10. Get ALL company projects (for admin/manager context)
        if current_user.role in ["admin", "manager"]:
            all_company_projects = await db.projects.find({}, {"_id": 0}).to_list(100)
            if all_company_projects and len(all_company_projects) > len(user_projects):
                other_projects = [
                    p for p in all_company_projects if p.get("id") not in project_ids
                ]
                if other_projects:
                    context_parts.append(
                        f"\n=== OTHER COMPANY PROJECTS ({len(other_projects)} total) ==="
                    )
                    for proj in other_projects[:10]:
                        context_parts.append(
                            f"- {proj.get('name')} (Client: {proj.get('client_name', 'N/A')}, Status: {proj.get('status', 'N/A')})"
                        )

        # Combine all context
        user_context = "\n".join(context_parts)

        # Prepare comprehensive system message for Milli
        system_message = f"""You are Milli, a friendly and professional AI workspace assistant for Millionaze project management.

Your personality:
- Professional but warm and approachable
- Proactive in offering help and insights
- Clear and concise in your responses
- Knowledgeable about project management best practices
- Data-driven and analytical when needed

Your comprehensive capabilities:
1. Answer questions about user's personal tasks and project tasks
2. Provide detailed project status summaries with team, budget, and timeline info
3. Access and reference meeting notes, meeting summaries, and recordings
4. Find information in documents, useful links, and deliverables
5. Track deliverable approvals and document status
6. Access internal notes and project discussions
7. Monitor and report on KPIs (Key Performance Indicators) and metrics
8. Provide insights about team members and their assignments
9. Give reminders about upcoming deadlines and overdue tasks
10. Suggest task prioritization based on urgency, priority, and dependencies
11. Offer project management advice and best practices
12. Summarize project progress and identify blockers
13. Access company-wide data (for admin/manager users)
14. Track KPI trends, current vs target values, and performance status

Current user context:
- User Name: {current_user.name}
- User Email: {current_user.email}
- User Role: {current_user.role}

COMPLETE WORKSPACE DATA:
{user_context if user_context else "No active tasks or projects yet."}

Guidelines:
- Be helpful and provide actionable, data-driven insights
- Reference specific tasks, projects, documents, and team members when relevant
- Provide detailed answers with specific data from the context above
- If asked to create tasks or notes, explain that you can provide guidance but the user needs to create them through the UI
- For deadlines, always mention dates clearly and flag overdue items
- If you don't have information about something, be honest about it
- When discussing projects, include relevant details like client, status, team, budget
- When discussing tasks, mention assignee, priority, status, and deadlines
- For meeting notes, reference key points and recording links when available
- For documents and links, provide URLs and descriptions
- Keep responses focused but comprehensive - don't hold back relevant information"""

        # Initialize OpenAI client
        api_key = settings.emergent_llm_key or settings.openai_api_key
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")

        client = AsyncOpenAI(api_key=api_key)

        # Send message and get response
        logging.info("Sending request to Milli AI")
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
        )

        response_text = response.choices[0].message.content
        logging.info(f"Milli response received: {response_text[:200]}...")

        # Save user message to database
        channel_id = f"milli-{current_user.id}"
        user_msg_doc = {
            "id": str(uuid.uuid4()),
            "channel_id": channel_id,
            "content": user_message,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "mentions": [],
            "attachments": [],
        }
        await db.messages.insert_one(user_msg_doc)

        # Save Milli's response to database
        milli_msg_doc = {
            "id": str(uuid.uuid4()),
            "channel_id": channel_id,
            "content": response_text,
            "sender_id": "milli-ai",
            "sender_name": "Milli",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "mentions": [],
            "attachments": [],
        }
        await db.messages.insert_one(milli_msg_doc)

        return {
            "response": response_text,
            "user_message_id": user_msg_doc["id"],
            "milli_message_id": milli_msg_doc["id"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Milli chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get response from Milli: {str(e)}"
        )


# ============ TASK ROUTES ============


@api_router.post("/tasks", response_model=Task)
async def create_task(
    task_data: TaskCreate, current_user: User = Depends(get_current_user)
):
    task = Task(**task_data.model_dump())
    await db.tasks.insert_one(task.model_dump())

    # Create activity log for task creation
    activity = TaskActivity(
        task_id=task.id,
        user_id=current_user.id,
        user_name=current_user.name,
        action_type="created",
        action_details={"title": task.title, "status": task.status},
    )
    await db.task_activities.insert_one(activity.model_dump())

    # Send notification if task is assigned to someone
    if task.assignee and task.assignee != current_user.id:
        assignee_user = await db.users.find_one(
            {"$or": [{"id": task.assignee}, {"email": task.assignee}]}, {"_id": 0}
        )
        if assignee_user:
            # Get project name if task belongs to a project
            project_name = "a task"
            if task.project_id:
                project = await db.projects.find_one(
                    {"id": task.project_id}, {"_id": 0}
                )
                if project:
                    project_name = f"project: {project.get('name')}"

            notification_data = NotificationCreate(
                user_id=assignee_user.get("id"),
                type="task_assigned",
                title=f"New task assigned",
                message=f'{current_user.name} assigned you "{task.title}" in {project_name}',
                link=f"/projects?selected={task.project_id}"
                if task.project_id
                else "/my-tasks",
                metadata={
                    "task_id": task.id,
                    "project_id": task.project_id,
                    "sender_name": current_user.name,
                    "task_title": task.title,
                    "project_name": project.get("name") if project else None,
                },
            )
            await create_notification(notification_data)

    return task


@api_router.get("/tasks")
async def get_all_tasks(
    current_user: User = Depends(get_current_user),
    pagination: PaginationParams = Depends()
):
    """
    Get all tasks with pagination
    Performance optimized: Returns only 50 tasks per page by default
    """
    # Count total tasks for pagination
    total = await db.tasks.count_documents({})
    
    # Fetch tasks with pagination and field projection
    tasks = await db.tasks.find(
        {},
        TASK_LIST_FIELDS
    ).skip(pagination.skip).limit(pagination.limit).to_list(pagination.limit)
    
    # Return paginated response (raw dicts so we don't require all Task fields)
    return paginate_response(
        data=tasks,
        total=total,
        page=pagination.page,
        limit=pagination.limit
    )


@api_router.get("/tasks/{project_id}", response_model=List[Task])
async def get_tasks(project_id: str):
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [Task(**t) for t in tasks]


@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(
    task_id: str, updates: dict, current_user: User = Depends(get_current_user)
):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.get("status")
    old_assignee = task.get("assignee")
    old_title = task.get("title")
    old_description = task.get("description")
    old_priority = task.get("priority")
    old_due_date = task.get("due_date")

    # Add updated_at timestamp
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.tasks.update_one({"id": task_id}, {"$set": updates})
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})

    # Log activities for significant changes
    activities_to_log = []

    if updates.get("status") and updates.get("status") != old_status:
        activities_to_log.append(
            {
                "action_type": "status_changed",
                "action_details": {"from": old_status, "to": updates.get("status")},
            }
        )

    if updates.get("assignee") and updates.get("assignee") != old_assignee:
        activities_to_log.append(
            {
                "action_type": "assignee_changed",
                "action_details": {"from": old_assignee, "to": updates.get("assignee")},
            }
        )

    if updates.get("title") and updates.get("title") != old_title:
        activities_to_log.append(
            {
                "action_type": "title_changed",
                "action_details": {"from": old_title, "to": updates.get("title")},
            }
        )

    if updates.get("priority") and updates.get("priority") != old_priority:
        activities_to_log.append(
            {
                "action_type": "priority_changed",
                "action_details": {"from": old_priority, "to": updates.get("priority")},
            }
        )

    if updates.get("due_date") and updates.get("due_date") != old_due_date:
        activities_to_log.append(
            {
                "action_type": "due_date_changed",
                "action_details": {"from": old_due_date, "to": updates.get("due_date")},
            }
        )

    # Log all activities
    for activity_data in activities_to_log:
        activity = TaskActivity(
            task_id=task_id,
            user_id=current_user.id,
            user_name=current_user.name,
            action_type=activity_data["action_type"],
            action_details=activity_data["action_details"],
        )
        await db.task_activities.insert_one(activity.model_dump())

    # Notification: Task status changed to Completed (approval)
    if updates.get("status") == "Completed" and old_status == "Under Review":
        # Notify the assignee that their task was approved
        if updated_task.get("assignee"):
            assignee_user = await db.users.find_one(
                {
                    "$or": [
                        {"id": updated_task["assignee"]},
                        {"email": updated_task["assignee"]},
                    ]
                },
                {"_id": 0},
            )
            if assignee_user and assignee_user.get("id") != current_user.id:
                notification_data = NotificationCreate(
                    user_id=assignee_user.get("id"),
                    type="task_approved",
                    title=f"Task approved",
                    message=f'{current_user.name} approved your task "{updated_task.get("title")}"',
                    link=f"/projects?selected={updated_task.get('project_id')}"
                    if updated_task.get("project_id")
                    else "/my-tasks",
                    metadata={
                        "task_id": task_id,
                        "project_id": updated_task.get("project_id"),
                    },
                )
                await create_notification(notification_data)

    # Notification: Task status changed to Under Review (for clients)
    if updates.get("status") == "Under Review" and old_status != "Under Review":
        # Notify clients in the project that a task is ready for review
        if updated_task.get("project_id"):
            project = await db.projects.find_one(
                {"id": updated_task["project_id"]}, {"_id": 0}
            )
            if project:
                # Get all clients (guests) in this project
                client_ids = project.get("guests", [])
                for client_id in client_ids:
                    if client_id != current_user.id:
                        client_user = await db.users.find_one(
                            {"id": client_id}, {"_id": 0}
                        )
                        if client_user and client_user.get("role", "").lower() in [
                            "client",
                            "user",
                        ]:
                            notification_data = NotificationCreate(
                                user_id=client_id,
                                type="task_under_review",
                                title=f"Task ready for review",
                                message=f'Task "{updated_task.get("title")}" in project "{project.get("name")}" is ready for your review',
                                link=f"/projects?selected={updated_task.get('project_id')}",
                                priority="normal",
                                metadata={
                                    "task_id": task_id,
                                    "project_id": updated_task.get("project_id"),
                                },
                            )
                            await create_notification(notification_data)

    # Notification: Task reassigned to a different user
    if updates.get("assignee") and updates.get("assignee") != old_assignee:
        new_assignee = updates.get("assignee")
        if new_assignee != current_user.id:
            assignee_user = await db.users.find_one(
                {"$or": [{"id": new_assignee}, {"email": new_assignee}]}, {"_id": 0}
            )
            if assignee_user:
                notification_data = NotificationCreate(
                    user_id=assignee_user.get("id"),
                    type="task_assigned",
                    title=f"Task reassigned to you",
                    message=f'{current_user.name} assigned you "{updated_task.get("title")}"',
                    link=f"/projects?selected={updated_task.get('project_id')}"
                    if updated_task.get("project_id")
                    else "/my-tasks",
                    metadata={
                        "task_id": task_id,
                        "project_id": updated_task.get("project_id"),
                    },
                )
                await create_notification(notification_data)

    return Task(**updated_task)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    await db.tasks.delete_one({"id": task_id})
    return {"message": "Task deleted"}


@api_router.get("/my-tasks", response_model=List[Task])
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    """Get all tasks assigned to the current user (including standalone tasks)"""
    # Find tasks where assignee matches user email or user id
    tasks = await db.tasks.find(
        {"$or": [{"assignee": current_user.email}, {"assignee": current_user.id}]},
        {"_id": 0},
    ).to_list(10000)
    return [Task(**t) for t in tasks]


# ============ TASK COMMENTS ROUTES ============


@api_router.post("/tasks/{task_id}/comments", response_model=TaskComment)
async def create_task_comment(
    task_id: str,
    comment_data: TaskCommentCreate,
    current_user: User = Depends(get_current_user),
):
    """Add a comment to a task"""
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = TaskComment(
        task_id=task_id,
        user_id=current_user.id,
        user_name=current_user.name,
        content=comment_data.content,
    )

    await db.task_comments.insert_one(comment.model_dump())

    # Update comment count on task
    await db.tasks.update_one({"id": task_id}, {"$inc": {"comment_count": 1}})

    # Create activity log
    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action_type="commented",
        action_details={
            "comment": comment_data.content[:100] + "..."
            if len(comment_data.content) > 100
            else comment_data.content
        },
    )
    await db.task_activities.insert_one(activity.model_dump())

    # Send notification to assignee (if not the commenter)
    if task.get("assignee") and task["assignee"] != current_user.id:
        assignee_user = await db.users.find_one(
            {"$or": [{"id": task["assignee"]}, {"email": task["assignee"]}]}, {"_id": 0}
        )
        if assignee_user:
            notification_data = NotificationCreate(
                user_id=assignee_user.get("id"),
                type="task_comment",
                title="New Comment on Your Task 💬",
                message=f'{current_user.name} commented on "{task.get("title")}"',
                link=f"/projects?selected={task.get('project_id')}"
                if task.get("project_id")
                else "/my-tasks",
                metadata={"task_id": task_id, "project_id": task.get("project_id")},
            )
            await create_notification(notification_data)

    return comment


@api_router.get("/tasks/{task_id}/comments", response_model=List[TaskComment])
async def get_task_comments(
    task_id: str, current_user: User = Depends(get_current_user)
):
    """Get all comments for a task"""
    comments = (
        await db.task_comments.find({"task_id": task_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(1000)
    )
    return [TaskComment(**c) for c in comments]


@api_router.put("/tasks/{task_id}/comments/{comment_id}", response_model=TaskComment)
async def update_task_comment(
    task_id: str,
    comment_id: str,
    comment_data: TaskCommentCreate,
    current_user: User = Depends(get_current_user),
):
    """Update a task comment (only by the author)"""
    comment = await db.task_comments.find_one(
        {"id": comment_id, "task_id": task_id}, {"_id": 0}
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.get("user_id") != current_user.id:
        raise HTTPException(
            status_code=403, detail="You can only edit your own comments"
        )

    updates = {
        "content": comment_data.content,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.task_comments.update_one({"id": comment_id}, {"$set": updates})
    updated_comment = await db.task_comments.find_one({"id": comment_id}, {"_id": 0})
    return TaskComment(**updated_comment)


@api_router.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_task_comment(
    task_id: str, comment_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a task comment (only by the author or admin)"""
    comment = await db.task_comments.find_one(
        {"id": comment_id, "task_id": task_id}, {"_id": 0}
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if (
        comment.get("user_id") != current_user.id
        and current_user.role.lower() != "admin"
    ):
        raise HTTPException(
            status_code=403, detail="You can only delete your own comments"
        )

    await db.task_comments.delete_one({"id": comment_id})

    # Update comment count on task
    await db.tasks.update_one({"id": task_id}, {"$inc": {"comment_count": -1}})

    return {"message": "Comment deleted"}


# ============ TASK ATTACHMENTS ROUTES ============


@api_router.post("/tasks/{task_id}/attachments", response_model=TaskAttachment)
async def upload_task_attachment(
    task_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an attachment to a task"""
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check file size (limit to 10MB)
    if file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 10MB."
        )

    # Create attachments directory if it doesn't exist (relative to server.py location)
    attachments_dir = Path(__file__).parent.parent / "uploads" / "task_attachments"
    attachments_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{task_id}_{uuid.uuid4().hex}{file_extension}"
    file_path = attachments_dir / unique_filename

    # Save file
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Create attachment record
    attachment = TaskAttachment(
        task_id=task_id,
        filename=unique_filename,
        original_filename=file.filename,
        file_size=len(content),
        mime_type=file.content_type,
        uploaded_by=current_user.id,
        uploaded_by_name=current_user.name,
        file_path=str(file_path),
    )

    await db.task_attachments.insert_one(attachment.model_dump())

    # Update attachment count on task
    await db.tasks.update_one({"id": task_id}, {"$inc": {"attachment_count": 1}})

    # Create activity log
    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action_type="attachment_added",
        action_details={"filename": file.filename},
    )
    await db.task_activities.insert_one(activity.model_dump())

    return attachment


@api_router.get("/tasks/{task_id}/attachments", response_model=List[TaskAttachment])
async def get_task_attachments(
    task_id: str, current_user: User = Depends(get_current_user)
):
    """Get all attachments for a task"""
    attachments = (
        await db.task_attachments.find({"task_id": task_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )
    return [TaskAttachment(**a) for a in attachments]


@api_router.get("/tasks/{task_id}/attachments/{attachment_id}/download")
async def download_task_attachment(
    task_id: str, attachment_id: str, current_user: User = Depends(get_current_user)
):
    """Download a task attachment"""
    attachment = await db.task_attachments.find_one(
        {"id": attachment_id, "task_id": task_id}, {"_id": 0}
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = Path(attachment["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
        filename=attachment["original_filename"],
        media_type=attachment["mime_type"],
    )


@api_router.delete("/tasks/{task_id}/attachments/{attachment_id}")
async def delete_task_attachment(
    task_id: str, attachment_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a task attachment"""
    attachment = await db.task_attachments.find_one(
        {"id": attachment_id, "task_id": task_id}, {"_id": 0}
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Check permissions (can delete if uploaded by user or user is admin)
    if (
        attachment.get("uploaded_by") != current_user.id
        and current_user.role.lower() != "admin"
    ):
        raise HTTPException(
            status_code=403, detail="You can only delete your own attachments"
        )

    # Delete file from filesystem
    file_path = Path(attachment["file_path"])
    if file_path.exists():
        file_path.unlink()

    await db.task_attachments.delete_one({"id": attachment_id})

    # Update attachment count on task
    await db.tasks.update_one({"id": task_id}, {"$inc": {"attachment_count": -1}})

    return {"message": "Attachment deleted"}


# ============ TASK ACTIVITY ROUTES ============


@api_router.get("/tasks/{task_id}/activities", response_model=List[TaskActivity])
async def get_task_activities(
    task_id: str, current_user: User = Depends(get_current_user)
):
    """Get activity timeline for a task"""
    activities = (
        await db.task_activities.find({"task_id": task_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )
    return [TaskActivity(**a) for a in activities]


# ============ TASK APPROVE/REJECT ROUTES ============


@api_router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Approve a task that is under review"""
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check if task is under review
    if task.get("status") != "Under Review":
        raise HTTPException(status_code=400, detail="Task is not under review")

    # Check permissions - admins can approve any task, managers can approve tasks in projects they own, clients can approve tasks in their projects
    if current_user.role.lower() == "admin":
        # Admins can approve any task
        pass
    elif current_user.role.lower() == "manager":
        # Managers can approve tasks in projects they own
        if task.get("project_id"):
            project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
            if not project or project.get("project_owner") != current_user.id:
                raise HTTPException(
                    status_code=403, detail="Insufficient permissions to approve task"
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Managers can only approve project tasks they own",
            )
    elif current_user.role.lower() in ["client", "user"]:
        # Clients can approve tasks in projects they are members of
        if task.get("project_id"):
            project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

            # Check if user is in project guests list or team members
            user_email = current_user.email
            is_guest = any(
                guest.get("email") == user_email for guest in project.get("guests", [])
            )
            is_team_member = current_user.id in project.get("team_members", [])

            if not (is_guest or is_team_member):
                raise HTTPException(
                    status_code=403,
                    detail="You can only approve tasks in projects you are a member of",
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Clients can only approve project tasks, not standalone tasks",
            )
    else:
        raise HTTPException(
            status_code=403, detail="Insufficient permissions to approve task"
        )

    # Update task status to completed and set approval fields
    updates = {
        "status": "Completed",
        "approved_by": current_user.name,  # Keep for legacy support
        "approved_at": datetime.now(
            timezone.utc
        ).isoformat(),  # Keep for legacy support
        "approval_status": "approved",
        "approval_by": current_user.id,
        "approval_by_name": current_user.name,
        "approval_at": datetime.now(timezone.utc).isoformat(),
        "rejection_comment": None,  # Clear any previous rejection comment
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.tasks.update_one({"id": task_id}, {"$set": updates})
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})

    # Create activity log
    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action_type="approved",
        action_details={"previous_status": "Under Review", "new_status": "Completed"},
    )
    await db.task_activities.insert_one(activity.model_dump())

    # Send notification to assignee
    if task.get("assignee") and task["assignee"] != current_user.id:
        assignee_user = await db.users.find_one(
            {"$or": [{"id": task["assignee"]}, {"email": task["assignee"]}]}, {"_id": 0}
        )
        if assignee_user:
            notification_data = NotificationCreate(
                user_id=assignee_user.get("id"),
                type="task_approved",
                title="Task Approved! 🎉",
                message=f'{current_user.name} approved your task "{task.get("title")}"',
                link=f"/projects?selected={task.get('project_id')}"
                if task.get("project_id")
                else "/my-tasks",
                metadata={"task_id": task_id, "project_id": task.get("project_id")},
            )
            await create_notification(notification_data)

    return Task(**updated_task)


@api_router.post("/tasks/{task_id}/reject")
async def reject_task(
    task_id: str,
    rejection_request: TaskRejectionRequest,
    current_user: User = Depends(get_current_user),
):
    """Reject a task that is under review with reason"""
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check if task is under review
    if task.get("status") != "Under Review":
        raise HTTPException(status_code=400, detail="Task is not under review")

    # Check permissions - admins can reject any task, managers can reject tasks in projects they own, clients can reject tasks in their projects
    if current_user.role.lower() == "admin":
        # Admins can reject any task
        pass
    elif current_user.role.lower() == "manager":
        # Managers can reject tasks in projects they own
        if task.get("project_id"):
            project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
            if not project or project.get("project_owner") != current_user.id:
                raise HTTPException(
                    status_code=403, detail="Insufficient permissions to reject task"
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Managers can only reject project tasks they own",
            )
    elif current_user.role.lower() in ["client", "user"]:
        # Clients can reject tasks in projects they are members of
        if task.get("project_id"):
            project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

            # Check if user is in project guests list or team members
            user_email = current_user.email
            is_guest = any(
                guest.get("email") == user_email for guest in project.get("guests", [])
            )
            is_team_member = current_user.id in project.get("team_members", [])

            if not (is_guest or is_team_member):
                raise HTTPException(
                    status_code=403,
                    detail="You can only reject tasks in projects you are a member of",
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="Clients can only reject project tasks, not standalone tasks",
            )
    else:
        raise HTTPException(
            status_code=403, detail="Insufficient permissions to reject task"
        )

    # Update task status back to in progress and set rejection fields
    updates = {
        "status": "In Progress",
        "rejection_reason": rejection_request.comment,  # Keep for legacy support
        "rejected_by": current_user.name,  # Keep for legacy support
        "rejected_at": datetime.now(
            timezone.utc
        ).isoformat(),  # Keep for legacy support
        "approval_status": "rejected",
        "approval_by": current_user.id,
        "approval_by_name": current_user.name,
        "approval_at": datetime.now(timezone.utc).isoformat(),
        "rejection_comment": rejection_request.comment,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.tasks.update_one({"id": task_id}, {"$set": updates})
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})

    # Create activity log
    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        user_name=current_user.name,
        action_type="rejected",
        action_details={
            "previous_status": "Under Review",
            "new_status": "In Progress",
            "reason": rejection_request.comment,
        },
    )
    await db.task_activities.insert_one(activity.model_dump())

    # Send notification to assignee
    if task.get("assignee") and task["assignee"] != current_user.id:
        assignee_user = await db.users.find_one(
            {"$or": [{"id": task["assignee"]}, {"email": task["assignee"]}]}, {"_id": 0}
        )
        if assignee_user:
            notification_data = NotificationCreate(
                user_id=assignee_user.get("id"),
                type="task_rejected",
                title="Task Needs Changes ⚠️",
                message=f'{current_user.name} requested changes for "{task.get("title")}": {rejection_request.comment}',
                link=f"/projects?selected={task.get('project_id')}"
                if task.get("project_id")
                else "/my-tasks",
                priority="urgent",
                metadata={
                    "task_id": task_id,
                    "project_id": task.get("project_id"),
                    "reason": rejection_request.comment,
                    "sender_name": current_user.name,
                    "task_title": task.get("title"),
                },
            )
            await create_notification(notification_data)

    return Task(**updated_task)


# ============ END TASK APPROVE/REJECT ROUTES ============


@api_router.post("/labels", response_model=TaskLabel)
async def create_task_label(
    label_data: TaskLabelCreate, current_user: User = Depends(get_current_user)
):
    """Create a new task label"""
    label = TaskLabel(**label_data.model_dump(), created_by=current_user.id)

    await db.task_labels.insert_one(label.model_dump())
    return label


@api_router.get("/labels", response_model=List[TaskLabel])
async def get_task_labels(
    project_id: Optional[str] = None, current_user: User = Depends(get_current_user)
):
    """Get all task labels (global or project-specific)"""
    query = {}
    if project_id:
        query = {"$or": [{"project_id": project_id}, {"project_id": None}]}
    else:
        query = {"project_id": None}

    labels = await db.task_labels.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    return [TaskLabel(**l) for l in labels]


@api_router.put("/labels/{label_id}", response_model=TaskLabel)
async def update_task_label(
    label_id: str,
    label_data: TaskLabelCreate,
    current_user: User = Depends(get_current_user),
):
    """Update a task label"""
    label = await db.task_labels.find_one({"id": label_id}, {"_id": 0})
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # Check if user can edit this label
    if label.get("created_by") != current_user.id and current_user.role.lower() not in [
        "admin",
        "manager",
    ]:
        raise HTTPException(status_code=403, detail="You can only edit your own labels")

    await db.task_labels.update_one({"id": label_id}, {"$set": label_data.model_dump()})
    updated_label = await db.task_labels.find_one({"id": label_id}, {"_id": 0})
    return TaskLabel(**updated_label)


@api_router.delete("/labels/{label_id}")
async def delete_task_label(
    label_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a task label"""
    label = await db.task_labels.find_one({"id": label_id}, {"_id": 0})
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # Check if user can delete this label
    if label.get("created_by") != current_user.id and current_user.role.lower() not in [
        "admin",
        "manager",
    ]:
        raise HTTPException(
            status_code=403, detail="You can only delete your own labels"
        )

    await db.task_labels.delete_one({"id": label_id})
    return {"message": "Label deleted"}


# ============ RECURRING TASKS ROUTES ============


async def generate_tasks_from_recurring_template(
    recurring_task: dict, target_date: datetime = None
):
    """
    Generate actual tasks from a recurring task template.

    Args:
        recurring_task: The recurring task template
        target_date: The date to generate tasks for (defaults to today)

    Returns:
        List of generated task IDs
    """
    if target_date is None:
        target_date = datetime.now(timezone.utc)

    generated_task_ids = []

    logging.info(
        f"📝 Generating tasks from template: '{recurring_task.get('title')}' (ID: {recurring_task.get('id')})"
    )

    # Determine who to create tasks for
    if recurring_task.get("assign_to_team"):
        # Get all team members (excluding clients)
        users = await db.users.find(
            {"role": {"$in": ["admin", "manager", "team member", "user"]}}, {"_id": 0}
        ).to_list(1000)

        logging.info(f"📋 Creating tasks for {len(users)} team members")

        # Create a task for each team member
        for user in users:
            task = Task(
                title=recurring_task.get("title"),
                description=recurring_task.get("description", ""),
                status=recurring_task.get("status", "Not Started"),
                priority=recurring_task.get("priority", "Medium"),
                assignee=user["id"],
                project_id=recurring_task.get("project_id"),
                due_date=recurring_task.get("due_date"),
                created_by=recurring_task.get("created_by"),
                is_recurring_instance=True,
                recurring_task_id=recurring_task.get("id"),
            )
            await db.tasks.insert_one(task.model_dump())
            generated_task_ids.append(task.id)
            logging.debug(f"✅ Created task for {user.get('name', user.get('email'))}")

    elif recurring_task.get("assignee"):
        # Create task for specific assignee
        logging.info(
            f"📋 Creating task for specific assignee: {recurring_task.get('assignee')}"
        )
        task = Task(
            title=recurring_task.get("title"),
            description=recurring_task.get("description", ""),
            status=recurring_task.get("status", "Not Started"),
            priority=recurring_task.get("priority", "Medium"),
            assignee=recurring_task.get("assignee"),
            project_id=recurring_task.get("project_id"),
            due_date=recurring_task.get("due_date"),
            created_by=recurring_task.get("created_by"),
            is_recurring_instance=True,
            recurring_task_id=recurring_task.get("id"),
        )
        await db.tasks.insert_one(task.model_dump())
        generated_task_ids.append(task.id)
        logging.info(f"✅ Task created with ID: {task.id}")
    else:
        logging.warning(
            f"⚠️ No assignee specified for recurring task '{recurring_task.get('title')}'"
        )

    # Update last_generated timestamp
    await db.recurring_tasks.update_one(
        {"id": recurring_task.get("id")},
        {"$set": {"last_generated": target_date.isoformat()}},
    )

    logging.info(
        f"✅ Successfully generated {len(generated_task_ids)} tasks and updated last_generated to {target_date.isoformat()}"
    )

    return generated_task_ids


@api_router.post("/recurring-tasks")
async def create_recurring_task(
    task_data: dict, current_user: User = Depends(get_current_user)
):
    """Create a recurring task template and optionally generate first set of tasks"""
    if current_user.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and managers can create recurring tasks",
        )

    # Extract schedule_mode flag
    schedule_mode = task_data.pop("schedule_mode", False)

    recurring_task = {
        "id": str(uuid.uuid4()),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_generated": None,
        "is_active": True,
        "schedule_mode": schedule_mode,
        **task_data,
    }

    # Save the recurring task template
    await db.recurring_tasks.insert_one(recurring_task)

    # Only generate tasks immediately if NOT in schedule mode
    generated_count = 0
    if not schedule_mode:
        try:
            generated_ids = await generate_tasks_from_recurring_template(recurring_task)
            logging.info(
                f"Generated {len(generated_ids)} tasks from recurring template {recurring_task['id']}"
            )
            generated_count = len(generated_ids)
        except Exception as e:
            logging.error(f"Failed to generate initial tasks: {str(e)}")
            generated_count = 0
    else:
        logging.info(
            f"Recurring task {recurring_task['id']} created in schedule mode - tasks will be generated at scheduled time"
        )

    # Return clean response without MongoDB ObjectId
    response = {
        "id": recurring_task["id"],
        "title": recurring_task.get("title"),
        "description": recurring_task.get("description"),
        "status": recurring_task.get("status"),
        "priority": recurring_task.get("priority"),
        "assign_to_team": recurring_task.get("assign_to_team", False),
        "assignee": recurring_task.get("assignee"),
        "project_id": recurring_task.get("project_id"),
        "recurrence_frequency": recurring_task.get("recurrence_frequency"),
        "recurrence_interval": recurring_task.get("recurrence_interval"),
        "recurrence_days": recurring_task.get("recurrence_days", []),
        "recurrence_time": recurring_task.get("recurrence_time", "09:00"),
        "created_by": recurring_task["created_by"],
        "created_at": recurring_task["created_at"],
        "last_generated": recurring_task["last_generated"],
        "is_active": recurring_task["is_active"],
        "generated_count": generated_count,
    }

    return response


@api_router.get("/recurring-tasks")
async def get_recurring_tasks(current_user: User = Depends(get_current_user)):
    """Get all recurring task templates (Admin/Manager only)"""
    if current_user.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403, detail="Only admins and managers can view recurring tasks"
        )

    recurring_tasks = await db.recurring_tasks.find({}, {"_id": 0}).to_list(1000)
    return recurring_tasks


@api_router.put("/recurring-tasks/{task_id}")
async def update_recurring_task(
    task_id: str, updates: dict, current_user: User = Depends(get_current_user)
):
    """Update a recurring task template (Admin/Manager only)"""
    if current_user.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and managers can update recurring tasks",
        )

    recurring_task = await db.recurring_tasks.find_one({"id": task_id}, {"_id": 0})
    if not recurring_task:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    # Update the task
    await db.recurring_tasks.update_one({"id": task_id}, {"$set": updates})
    updated_task = await db.recurring_tasks.find_one({"id": task_id}, {"_id": 0})

    # Return clean response without MongoDB ObjectId
    response = {
        "id": updated_task["id"],
        "title": updated_task.get("title"),
        "description": updated_task.get("description"),
        "status": updated_task.get("status"),
        "priority": updated_task.get("priority"),
        "assign_to_team": updated_task.get("assign_to_team", False),
        "assignee": updated_task.get("assignee"),
        "project_id": updated_task.get("project_id"),
        "recurrence_frequency": updated_task.get("recurrence_frequency"),
        "recurrence_interval": updated_task.get("recurrence_interval"),
        "recurrence_days": updated_task.get("recurrence_days", []),
        "recurrence_time": updated_task.get("recurrence_time", "09:00"),
        "created_by": updated_task.get("created_by"),
        "created_at": updated_task.get("created_at"),
        "last_generated": updated_task.get("last_generated"),
        "is_active": updated_task.get("is_active", True),
    }

    return response


@api_router.delete("/recurring-tasks/{task_id}")
async def delete_recurring_task(
    task_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a recurring task template (Admin/Manager only)"""
    if current_user.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and managers can delete recurring tasks",
        )

    await db.recurring_tasks.delete_one({"id": task_id})
    return {"message": "Recurring task deleted"}


@api_router.post("/recurring-tasks/{task_id}/generate")
async def generate_tasks_from_template(
    task_id: str, current_user: User = Depends(get_current_user)
):
    """Manually generate tasks from a recurring task template"""
    if current_user.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403, detail="Only admins and managers can generate tasks"
        )

    recurring_task = await db.recurring_tasks.find_one({"id": task_id}, {"_id": 0})
    if not recurring_task:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    # Generate tasks
    generated_ids = await generate_tasks_from_recurring_template(recurring_task)

    return {
        "message": f"Generated {len(generated_ids)} tasks",
        "task_ids": generated_ids,
        "count": len(generated_ids),
    }


def should_generate_task_today(recurring_task: dict) -> bool:
    """
    Check if a recurring task should generate tasks today based on its schedule

    Args:
        recurring_task: The recurring task template with schedule settings

    Returns:
        True if tasks should be generated today, False otherwise
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    current_day_name = today.strftime("%A")  # e.g., "Monday"
    current_time = now.time()

    # Check if already generated today
    last_generated = recurring_task.get("last_generated")
    if last_generated:
        try:
            last_gen_date = datetime.fromisoformat(last_generated)
            last_gen_date_only = last_gen_date.date()

            # Don't generate if already generated today
            if last_gen_date_only >= today:
                logging.debug(
                    f"Task '{recurring_task.get('title')}' already generated today ({last_gen_date_only})"
                )
                return False
        except Exception as e:
            logging.warning(f"Error parsing last_generated date: {e}")

    # Get the scheduled time (format: "HH:MM")
    recurrence_time_str = recurring_task.get("recurrence_time", "00:00")
    try:
        scheduled_hour, scheduled_minute = map(int, recurrence_time_str.split(":"))
        scheduled_time = (
            datetime.now(timezone.utc)
            .replace(
                hour=scheduled_hour, minute=scheduled_minute, second=0, microsecond=0
            )
            .time()
        )

        # Time window: only generate if current time is past scheduled time
        # and we haven't generated yet today (checked above)
        if current_time < scheduled_time:
            logging.debug(
                f"Task '{recurring_task.get('title')}' scheduled for {scheduled_time}, current time is {current_time}"
            )
            return False
    except Exception as e:
        logging.warning(f"Error parsing recurrence_time '{recurrence_time_str}': {e}")
        # If time parsing fails, continue with day-based checks
        pass

    frequency = recurring_task.get("recurrence_frequency", "").lower()
    interval = recurring_task.get("recurrence_interval", 1)
    recurrence_days = recurring_task.get("recurrence_days", [])

    # Daily tasks
    if frequency == "daily":
        # Check interval (every X days)
        if last_generated:
            try:
                last_gen_date = datetime.fromisoformat(last_generated).date()
                days_since_last = (today - last_gen_date).days
                should_gen = days_since_last >= interval
                logging.debug(
                    f"Daily task: days_since_last={days_since_last}, interval={interval}, should_generate={should_gen}"
                )
                return should_gen
            except:
                return True
        return True

    # Weekly tasks
    elif frequency == "weekly":
        # If specific days are set, check if today matches
        if recurrence_days:
            should_gen = current_day_name in recurrence_days
            logging.debug(
                f"Weekly task: current_day={current_day_name}, recurrence_days={recurrence_days}, should_generate={should_gen}"
            )
            return should_gen
        # Otherwise generate every week on the same day
        if last_generated:
            try:
                last_gen_date = datetime.fromisoformat(last_generated).date()
                weeks_since_last = (today - last_gen_date).days // 7
                return (
                    weeks_since_last >= interval
                    and last_gen_date.strftime("%A") == current_day_name
                )
            except:
                return True
        return True

    # Monthly tasks
    elif frequency == "monthly":
        # Generate on the same day of month
        if last_generated:
            try:
                last_gen_date = datetime.fromisoformat(last_generated).date()
                # Check if enough months have passed
                months_diff = (today.year - last_gen_date.year) * 12 + (
                    today.month - last_gen_date.month
                )
                return months_diff >= interval and today.day == last_gen_date.day
            except:
                return True
        return True

    # Yearly tasks
    elif frequency == "yearly":
        if last_generated:
            try:
                last_gen_date = datetime.fromisoformat(last_generated).date()
                years_diff = today.year - last_gen_date.year
                return (
                    years_diff >= interval
                    and today.month == last_gen_date.month
                    and today.day == last_gen_date.day
                )
            except:
                return True
        return True

    # Default: generate if no clear frequency set
    logging.debug(
        f"Task '{recurring_task.get('title')}' has no recognized frequency, defaulting to True"
    )
    return True


@api_router.post("/recurring-tasks/generate-all")
async def generate_all_recurring_tasks(current_user: User = Depends(get_current_user)):
    """Generate tasks for all active recurring task templates based on their schedule"""
    if current_user.role.lower() not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403, detail="Only admins and managers can generate tasks"
        )

    # Get all active recurring tasks
    recurring_tasks = await db.recurring_tasks.find(
        {"is_active": {"$ne": False}}, {"_id": 0}
    ).to_list(1000)

    total_generated = 0
    results = []

    for recurring_task in recurring_tasks:
        try:
            # Check if we should generate based on schedule
            should_generate = should_generate_task_today(recurring_task)

            if should_generate:
                generated_ids = await generate_tasks_from_recurring_template(
                    recurring_task
                )
                total_generated += len(generated_ids)
                results.append(
                    {
                        "template_id": recurring_task["id"],
                        "template_title": recurring_task.get("title"),
                        "generated_count": len(generated_ids),
                        "status": "generated",
                    }
                )
                logging.info(
                    f"Generated {len(generated_ids)} tasks for template '{recurring_task.get('title')}'"
                )
            else:
                results.append(
                    {
                        "template_id": recurring_task["id"],
                        "template_title": recurring_task.get("title"),
                        "generated_count": 0,
                        "status": "skipped - not scheduled for today",
                    }
                )
        except Exception as e:
            logging.error(
                f"Failed to generate tasks for template {recurring_task.get('id')}: {str(e)}"
            )
            results.append(
                {
                    "template_id": recurring_task["id"],
                    "template_title": recurring_task.get("title"),
                    "error": str(e),
                    "status": "error",
                }
            )

    return {
        "message": f"Generated {total_generated} tasks from {len(recurring_tasks)} templates",
        "total_generated": total_generated,
        "templates_processed": len(recurring_tasks),
        "results": results,
    }


# ============ DOCUMENT ROUTES ============


@api_router.post("/documents", response_model=Document)
async def create_document(
    doc_data: DocumentCreate, current_user: User = Depends(get_current_user)
):
    doc_dict = doc_data.model_dump()
    doc_dict["uploaded_by"] = current_user.id

    document = Document(**doc_dict)
    await db.documents.insert_one(document.model_dump())
    return document


@api_router.get("/documents/{project_id}", response_model=List[Document])
async def get_documents(project_id: str):
    docs = await db.documents.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [Document(**d) for d in docs]


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    await db.documents.delete_one({"id": doc_id})
    return {"message": "Document deleted"}


@api_router.put("/documents/{doc_id}")
async def update_document(doc_id: str, updates: dict):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.documents.update_one({"id": doc_id}, {"$set": updates})
    updated_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    return Document(**updated_doc)


# ============ INTERNAL NOTES ROUTES ============


@api_router.post("/internal-notes", response_model=InternalNote)
async def create_internal_note(
    note_data: InternalNoteCreate, current_user: User = Depends(get_current_user)
):
    note_dict = note_data.model_dump()
    note_dict["created_by"] = current_user.id

    note = InternalNote(**note_dict)
    await db.internal_notes.insert_one(note.model_dump())
    return note


@api_router.get("/internal-notes/{project_id}", response_model=List[InternalNote])
async def get_internal_notes(
    project_id: str, current_user: User = Depends(get_current_user)
):
    notes = await db.internal_notes.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(1000)
    return [InternalNote(**n) for n in notes]


@api_router.put("/internal-notes/{note_id}")
async def update_internal_note(
    note_id: str, content: str, current_user: User = Depends(get_current_user)
):
    note = await db.internal_notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.internal_notes.update_one(
        {"id": note_id},
        {
            "$set": {
                "content": content,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    updated_note = await db.internal_notes.find_one({"id": note_id}, {"_id": 0})
    return InternalNote(**updated_note)


@api_router.delete("/internal-notes/{note_id}")
async def delete_internal_note(
    note_id: str, current_user: User = Depends(get_current_user)
):
    await db.internal_notes.delete_one({"id": note_id})
    return {"message": "Note deleted"}


# ============ USEFUL LINKS ROUTES ============


@api_router.post("/useful-links", response_model=UsefulLink)
async def create_useful_link(
    link_data: UsefulLinkCreate, current_user: User = Depends(get_current_user)
):
    link_dict = link_data.model_dump()
    link_dict["created_by"] = current_user.id

    link = UsefulLink(**link_dict)
    await db.useful_links.insert_one(link.model_dump())
    return link


@api_router.get("/useful-links/{project_id}", response_model=List[UsefulLink])
async def get_useful_links(project_id: str):
    links = await db.useful_links.find({"project_id": project_id}, {"_id": 0}).to_list(
        1000
    )
    return [UsefulLink(**l) for l in links]


@api_router.put("/useful-links/{link_id}")
async def update_useful_link(
    link_id: str, updates: dict, current_user: User = Depends(get_current_user)
):
    link = await db.useful_links.find_one({"id": link_id}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    await db.useful_links.update_one({"id": link_id}, {"$set": updates})
    updated_link = await db.useful_links.find_one({"id": link_id}, {"_id": 0})
    return UsefulLink(**updated_link)


@api_router.delete("/useful-links/{link_id}")
async def delete_useful_link(
    link_id: str, current_user: User = Depends(get_current_user)
):
    await db.useful_links.delete_one({"id": link_id})
    return {"message": "Link deleted"}


# ============ MEETING NOTES ROUTES ============


@api_router.post("/meeting-notes", response_model=MeetingNote)
async def create_meeting_note(
    note_data: MeetingNoteCreate, current_user: User = Depends(get_current_user)
):
    # Clients cannot create meeting notes
    if current_user.role == "client":
        raise HTTPException(
            status_code=403, detail="Clients cannot create meeting notes"
        )

    note_dict = note_data.model_dump()
    note_dict["created_by"] = current_user.id

    note = MeetingNote(**note_dict)
    await db.meeting_notes.insert_one(note.model_dump())
    return note


@api_router.get("/meeting-notes/{project_id}", response_model=List[MeetingNote])
async def get_meeting_notes(
    project_id: str, current_user: User = Depends(get_current_user)
):
    # Clients cannot view meeting notes
    if current_user.role == "client":
        raise HTTPException(status_code=403, detail="Clients cannot view meeting notes")

    notes = await db.meeting_notes.find({"project_id": project_id}, {"_id": 0}).to_list(
        1000
    )
    return [MeetingNote(**n) for n in notes]


@api_router.put("/meeting-notes/{note_id}")
async def update_meeting_note(
    note_id: str, updates: dict, current_user: User = Depends(get_current_user)
):
    # Clients cannot update meeting notes
    if current_user.role == "client":
        raise HTTPException(
            status_code=403, detail="Clients cannot update meeting notes"
        )

    note = await db.meeting_notes.find_one({"id": note_id}, {"_id": 0})
    if not note:
        raise HTTPException(status_code=404, detail="Meeting note not found")

    await db.meeting_notes.update_one({"id": note_id}, {"$set": updates})
    updated_note = await db.meeting_notes.find_one({"id": note_id}, {"_id": 0})
    return MeetingNote(**updated_note)


@api_router.delete("/meeting-notes/{note_id}")
async def delete_meeting_note(
    note_id: str, current_user: User = Depends(get_current_user)
):
    # Clients cannot delete meeting notes
    if current_user.role == "client":
        raise HTTPException(
            status_code=403, detail="Clients cannot delete meeting notes"
        )

    await db.meeting_notes.delete_one({"id": note_id})
    return {"message": "Meeting note deleted"}


# ============ GUEST LINK ROUTES ============


@api_router.post("/guest-links", response_model=GuestLink)
async def create_guest_link(
    link_data: GuestLinkCreate, current_user: User = Depends(get_current_user)
):
    # Check if guest link already exists for this project
    existing_link = await db.guest_links.find_one(
        {"project_id": link_data.project_id}, {"_id": 0}
    )
    if existing_link:
        return GuestLink(**existing_link)

    guest_link = GuestLink(**link_data.model_dump())
    await db.guest_links.insert_one(guest_link.model_dump())
    return guest_link


@api_router.get("/guest-links")
async def get_all_guest_links(current_user: User = Depends(get_current_user)):
    """Get all guest links (for clients tab) - Admin & Manager only"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    links = await db.guest_links.find({}, {"_id": 0}).to_list(1000)
    return links


@api_router.get("/guest-links/project/{project_id}", response_model=GuestLink)
async def get_guest_link_by_project(
    project_id: str, current_user: User = Depends(get_current_user)
):
    link = await db.guest_links.find_one({"project_id": project_id}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Guest link not found")
    return GuestLink(**link)


@api_router.post("/guest-access/{token}")
async def guest_access(token: str, guest_data: GuestAccessRequest):
    link = await db.guest_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid guest link")

    # Check if expired
    if link.get("expires_at"):
        expires_at = datetime.fromisoformat(link["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=403, detail="Guest link expired")

    # Update guest info
    await db.guest_links.update_one(
        {"token": token},
        {
            "$set": {
                "guest_name": guest_data.guest_name,
                "guest_email": guest_data.guest_email,
            }
        },
    )

    # Get project
    project = await db.projects.find_one({"id": link["project_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"project": Project(**project), "guest_link": GuestLink(**link)}


@api_router.get("/guest-project/{token}", response_model=Project)
async def get_guest_project(token: str):
    link = await db.guest_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid guest link")

    # Check if expired
    if link.get("expires_at"):
        expires_at = datetime.fromisoformat(link["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=403, detail="Guest link expired")

    project = await db.projects.find_one({"id": link["project_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return Project(**project)


@api_router.post("/guest-approve-all/{token}")
async def guest_approve_all_tasks(token: str):
    link = await db.guest_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid guest link")

    # Mark all tasks as approved
    await db.guest_links.update_one(
        {"token": token}, {"$set": {"all_tasks_approved": True}}
    )

    return {"message": "All tasks approved"}


@api_router.post("/guest-satisfaction/{token}")
async def guest_confirm_satisfaction(token: str, satisfied: bool):
    link = await db.guest_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid guest link")

    if satisfied:
        # Set expiration to 2 weeks from now
        expires_at = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        await db.guest_links.update_one(
            {"token": token},
            {
                "$set": {
                    "satisfaction_confirmed": True,
                    "satisfaction_confirmed_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": expires_at,
                }
            },
        )

    return {
        "message": "Satisfaction recorded",
        "expires_at": expires_at if satisfied else None,
    }


@api_router.post("/guest-approve-task/{token}/{task_id}")
async def guest_approve_task(token: str, task_id: str):
    # Get guest link to verify and get guest info
    link = await db.guest_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid guest link")

    # Get task
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Update task with approval info
    await db.tasks.update_one(
        {"id": task_id},
        {
            "$set": {
                "approved_by_guest": True,
                "approved_by": link.get("guest_name", "Guest"),
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "status": "Completed",
            }
        },
    )

    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return Task(**updated_task)


@api_router.post("/guest-approve-document/{token}/{doc_id}")
async def guest_approve_document(token: str, doc_id: str):
    # Get guest link to verify and get guest info
    link = await db.guest_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Invalid guest link")

    # Get document
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update document with approval info
    await db.documents.update_one(
        {"id": doc_id},
        {
            "$set": {
                "approved_by_guest": True,
                "approved_by": link.get("guest_name", "Guest"),
                "approved_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    updated_doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    return Document(**updated_doc)


# ============ JIBBLE INTEGRATION ============

# Jibble API Configuration
JIBBLE_CLIENT_ID = settings.jibble_client_id
JIBBLE_CLIENT_SECRET = settings.jibble_client_secret
JIBBLE_WORKSPACE_API = "https://workspace.prod.jibble.io/v1"
JIBBLE_TIME_TRACKING_API = "https://time-tracking.prod.jibble.io/v1"
JIBBLE_TIME_ATTENDANCE_API = "https://time-attendance.prod.jibble.io/v1"
JIBBLE_TOKEN_URL = "https://identity.prod.jibble.io/connect/token"

# Cache for Jibble Bearer token
jibble_token_cache = {"token": None, "expires_at": None}


async def get_jibble_credentials():
    """Get Jibble credentials from database first, then fall back to environment"""
    try:
        # Check database first
        integration = await db.integrations.find_one(
            {"name": "jibble", "is_connected": True}
        )
        if integration and integration.get("credentials"):
            return (
                integration["credentials"]["client_id"],
                integration["credentials"]["secret_key"],
            )
    except Exception as e:
        logger.error(f"Error getting Jibble credentials from database: {str(e)}")

    # Fall back to environment variables
    client_id = settings.jibble_client_id
    secret_key = settings.jibble_client_secret

    if client_id and secret_key:
        return (client_id, secret_key)

    return None, None


async def get_jibble_bearer_token():
    """Get or refresh Jibble Bearer token using OAuth Client Credentials flow"""
    import requests
    from datetime import datetime, timedelta

    # Check if we have a valid cached token
    if jibble_token_cache["token"] and jibble_token_cache["expires_at"]:
        if datetime.now(timezone.utc) < jibble_token_cache["expires_at"]:
            return jibble_token_cache["token"]

    # Get credentials (database first, then .env)
    client_id, secret_key = await get_jibble_credentials()

    if not client_id or not secret_key:
        logger.error("No Jibble credentials found in database or environment")
        return None

    # Request new token
    try:
        response = requests.post(
            JIBBLE_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": secret_key,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )

        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)

            # Cache the token
            jibble_token_cache["token"] = access_token
            jibble_token_cache["expires_at"] = datetime.now(timezone.utc) + timedelta(
                seconds=expires_in - 60
            )

            logger.info("Successfully obtained Jibble Bearer token")
            return access_token
        else:
            logger.error(
                f"Failed to get Jibble token: {response.status_code} - {response.text}"
            )
            return None

    except Exception as e:
        logger.error(f"Error getting Jibble Bearer token: {str(e)}")
        return None


@api_router.get("/jibble/team-activity")
async def get_jibble_team_activity():
    """Fetch real-time team activity from Jibble"""
    try:
        import requests

        # Get Bearer token
        bearer_token = await get_jibble_bearer_token()
        if not bearer_token:
            logger.error("Failed to obtain Jibble Bearer token")
            return []

        # Get people/members from Jibble
        response = requests.get(
            f"{JIBBLE_WORKSPACE_API}/People",
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        if response.status_code != 200:
            logger.error(
                f"Jibble API returned status {response.status_code}: {response.text}"
            )
            return []

        people_data = response.json()

        # Handle OData response format
        if isinstance(people_data, dict) and "value" in people_data:
            people_list = people_data["value"]
        elif isinstance(people_data, list):
            people_list = people_data
        else:
            logger.error(
                f"Unexpected Jibble People API response format: {type(people_data)}"
            )
            return []

        # Get latest time entries for each person (active entries)
        # Fetch all time entries and filter for latest ones per person
        time_entries_response = requests.get(
            f"{JIBBLE_TIME_TRACKING_API}/TimeEntries?$filter=nextTimeEntryId eq null&$top=1000",
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        time_entries = []
        if time_entries_response.status_code == 200:
            entries_data = time_entries_response.json()
            # Handle OData response format
            if isinstance(entries_data, dict) and "value" in entries_data:
                time_entries = entries_data["value"]
            elif isinstance(entries_data, list):
                time_entries = entries_data

        # Create a map of personId to their latest entry
        latest_entries_map = {}
        today = datetime.now(timezone.utc).date().isoformat()

        for entry in time_entries:
            person_id = entry.get("personId")
            # Only consider entries from today or yesterday for "active" status
            belongs_to_date = entry.get("belongsToDate", "")

            if person_id and person_id not in latest_entries_map:
                latest_entries_map[person_id] = entry

        # Get project and activity names
        projects_response = requests.get(
            f"{JIBBLE_WORKSPACE_API}/Projects",
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        projects_map = {}
        if projects_response.status_code == 200:
            projects_data = projects_response.json()
            projects_list = (
                projects_data.get("value", projects_data)
                if isinstance(projects_data, dict)
                else projects_data
            )
            for proj in projects_list:
                projects_map[proj.get("id")] = proj.get("name", "Unknown Project")

        activities_response = requests.get(
            f"{JIBBLE_WORKSPACE_API}/Activities",
            headers={
                "Authorization": f"Bearer {bearer_token}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        activities_map = {}
        if activities_response.status_code == 200:
            activities_data = activities_response.json()
            activities_list = (
                activities_data.get("value", activities_data)
                if isinstance(activities_data, dict)
                else activities_data
            )
            for act in activities_list:
                activities_map[act.get("id")] = act.get("name", "Unknown Activity")

        # Process team members
        team_activity = []
        for person in people_list:
            person_id = person.get("id")

            # Determine status from latest time entry
            status = "OUT"  # Default to OUT
            last_activity = "No recent activity"
            current_activity = None
            current_project = None

            if person_id in latest_entries_map:
                entry = latest_entries_map[person_id]
                entry_type = entry.get("type", "Out")
                entry_time = entry.get("time", entry.get("localTime", ""))
                break_id = entry.get("breakId")

                # Determine status based on entry type
                if entry_type == "In" and break_id:
                    status = "BREAK"
                    # Format time for display
                    try:
                        time_obj = datetime.fromisoformat(
                            entry_time.replace("Z", "+00:00")
                        )
                        formatted_time = time_obj.strftime("%I:%M %p")
                        last_activity = f"On break since {formatted_time}"
                    except:
                        last_activity = f"On break"
                elif entry_type == "In":
                    status = "IN"
                    # Format time for display
                    try:
                        time_obj = datetime.fromisoformat(
                            entry_time.replace("Z", "+00:00")
                        )
                        formatted_time = time_obj.strftime("%I:%M %p")
                        last_activity = f"Active since {formatted_time}"
                    except:
                        last_activity = "Active now"
                    # Get current activity and project
                    project_id = entry.get("projectId")
                    activity_id = entry.get("activityId")
                    current_project = projects_map.get(project_id, None)
                    current_activity = activities_map.get(activity_id, None)
                elif entry_type == "Out":
                    status = "OUT"
                    # Format time for display
                    try:
                        time_obj = datetime.fromisoformat(
                            entry_time.replace("Z", "+00:00")
                        )
                        formatted_time = time_obj.strftime("%I:%M %p")
                        last_activity = f"Clocked out at {formatted_time}"
                    except:
                        last_activity = "Clocked out"
                else:
                    # Break entry
                    status = "BREAK"
                    last_activity = "On break"

            # Get initials
            name = person.get("fullName", person.get("preferredName", "Unknown"))
            name_parts = name.split()
            initials = (
                "".join([part[0].upper() for part in name_parts[:2]])
                if name_parts
                else "U"
            )

            team_activity.append(
                {
                    "id": person.get("id"),
                    "name": name,
                    "email": person.get("email", ""),
                    "role": person.get("positionName", "Team Member"),
                    "status": status,
                    "avatar": initials,
                    "lastActivity": last_activity,
                    "currentActivity": current_activity,
                    "currentProject": current_project,
                }
            )

        logger.info(
            f"Successfully fetched {len(team_activity)} team members from Jibble"
        )
        return team_activity

    except Exception as e:
        # Return empty array if Jibble fails, don't break the app
        logger.error(f"Jibble API error: {str(e)}")
        return []


@api_router.post("/jibble/sync-team-members")
async def sync_jibble_team_members(current_user: User = Depends(get_current_user)):
    """Sync team members from Jibble to create user accounts (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        team_activity = await get_jibble_team_activity()

        synced_count = 0
        updated_count = 0

        for member in team_activity:
            # Check if user already exists
            existing_user = await db.users.find_one({"email": member["email"]})

            if existing_user:
                # Update name if it's "Unknown" or empty
                if existing_user.get("name") == "Unknown" or not existing_user.get(
                    "name"
                ):
                    await db.users.update_one(
                        {"email": member["email"]},
                        {
                            "$set": {
                                "name": member["name"],
                                "jibble_id": member["id"],
                                "synced_from_jibble": True,
                            }
                        },
                    )
                    updated_count += 1
            elif member["email"]:
                # Create user account with default password
                default_password = get_password_hash("changeme123")

                user = User(name=member["name"], email=member["email"], role="user")

                user_doc = user.model_dump()
                user_doc["password_hash"] = default_password
                user_doc["jibble_id"] = member["id"]
                user_doc["synced_from_jibble"] = True

                await db.users.insert_one(user_doc)
                synced_count += 1

        return {
            "message": f"Successfully synced {synced_count} new and updated {updated_count} existing team members from Jibble",
            "synced_count": synced_count,
            "updated_count": updated_count,
            "total_members": len(team_activity),
        }

    except Exception as e:
        logger.error(f"Failed to sync team members: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ USERS ROUTE ============


@api_router.get("/users")
async def get_users(
    current_user: User = Depends(get_current_user),
    pagination: PaginationParams = Depends()
):
    """
    Get users with pagination and caching
    Performance optimized: Uses cache and only fetches needed fields
    """
    # Try cache first
    cache_key = user_list_cache_key()
    cached_users = await cache.get(cache_key)
    
    if cached_users:
        # Add online status from cache
        online_user_ids = manager.get_online_users()
        for u in cached_users:
            # Support both dicts and User model instances in cache
            if isinstance(u, dict):
                u["is_online"] = u.get("id") in online_user_ids
            else:
                u.is_online = getattr(u, "id", None) in online_user_ids
        
        # Paginate cached results
        start_idx = pagination.skip
        end_idx = start_idx + pagination.limit
        paginated_users = cached_users[start_idx:end_idx]
        
        return paginate_response(
            data=paginated_users,
            total=len(cached_users),
            page=pagination.page,
            limit=pagination.limit
        )
    
    # Count total users
    total = await db.users.count_documents({})
    
    # Fetch users with field projection
    users = await db.users.find(
        {},
        USER_LIST_FIELDS
    ).skip(pagination.skip).limit(pagination.limit).to_list(pagination.limit)

    # Add online status to each user (keep as dicts)
    online_user_ids = manager.get_online_users()
    for u in users:
        u["is_online"] = u.get("id") in online_user_ids
    
    # Cache for 5 minutes
    await cache.set(cache_key, users, ttl_seconds=300)

    return paginate_response(
        data=users,
        total=total,
        page=pagination.page,
        limit=pagination.limit
    )


@api_router.put("/users/me", response_model=User)
async def update_my_settings(
    updates: UserSettingsUpdate, current_user: User = Depends(get_current_user)
):
    """Update current user's settings (profile image, timezone, name)"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    await db.users.update_one({"id": current_user.id}, {"$set": update_data})

    updated_user = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "password_hash": 0}
    )
    return User(**updated_user)


@api_router.put("/users/me/password")
async def update_my_password(
    password_update: PasswordUpdate, current_user: User = Depends(get_current_user)
):
    """Update current user's password"""
    # Verify current password
    user = await db.users.find_one({"id": current_user.id})
    if not verify_password(password_update.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash new password
    password_hash = get_password_hash(password_update.new_password)

    await db.users.update_one(
        {"id": current_user.id}, {"$set": {"password_hash": password_hash}}
    )

    return {"message": "Password updated successfully"}


@api_router.put("/users/{user_id}/password")
async def update_user_password(
    user_id: str, new_password: str, current_user: User = Depends(get_current_user)
):
    """Update user password (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Hash new password
    password_hash = get_password_hash(new_password)

    await db.users.update_one(
        {"id": user_id}, {"$set": {"password_hash": password_hash}}
    )

    return {"message": "Password updated successfully"}


@api_router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    updates: UserRoleUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update user details - role, name, email (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Build update data
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    # Validate role if provided
    if "role" in update_data:
        valid_roles = ["admin", "manager", "team member", "user", "client"]
        if update_data["role"] not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
            )

    await db.users.update_one({"id": user_id}, {"$set": update_data})

    # Fetch updated user
    updated_user = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0}
    )
    return User(**updated_user)


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Don't allow deleting yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}


@api_router.post("/admin/impersonate/{user_id}", response_model=Token)
async def admin_impersonate(
    user_id: str, current_user: User = Depends(get_current_user)
):
    """Admin impersonation - allows admin to login as another user"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get the target user
    target_user = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0}
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create token for target user
    user_obj = User(**target_user)
    access_token = create_access_token(data={"sub": user_obj.id})

    return Token(access_token=access_token, token_type="bearer", user=user_obj)


@api_router.get("/team-members-list", response_model=List[User])
async def get_team_members_list(current_user: User = Depends(get_current_user)):
    """Get list of team members (only admin, manager, and team member roles)"""
    # No permission check - frontend ProtectedRoute handles access control

    # Internal team members only (exclude clients and admins)
    users = await db.users.find(
        {"role": {"$in": ["manager", "team member", "user"]}},
        {"_id": 0, "password_hash": 0},
    ).to_list(1000)
    # Sort by name for consistent display
    users.sort(key=lambda u: u.get("name", "").lower())
    return [User(**u) for u in users]


# ============ RBAC ENDPOINTS ============


@api_router.get("/roles/config")
async def get_role_configurations(current_user: User = Depends(get_current_user)):
    """Get role-level permission configurations (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get all role configs from database
    configs = await db.role_configs.find({}, {"_id": 0}).to_list(10)

    # Start with default configurations for all roles
    config_dict = {
        "admin": DEFAULT_ROLE_PERMISSIONS["admin"].model_dump(),
        "manager": DEFAULT_ROLE_PERMISSIONS["manager"].model_dump(),
        "user": DEFAULT_ROLE_PERMISSIONS["user"].model_dump(),
        "client": DEFAULT_ROLE_PERMISSIONS["client"].model_dump(),
    }

    # Override with database configs if they exist
    for config in configs:
        config_dict[config["role"]] = config["permissions"]

    return config_dict


@api_router.put("/roles/config")
async def update_role_configuration(
    update: RoleConfigUpdate, current_user: User = Depends(get_current_user)
):
    """Update role-level permissions (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate role
    valid_roles = ["admin", "manager", "user", "client"]
    if update.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    # Update or insert role config
    role_config = RoleConfig(
        role=update.role,
        permissions=update.permissions,
        updated_by=current_user.id,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

    await db.role_configs.update_one(
        {"role": update.role}, {"$set": role_config.model_dump()}, upsert=True
    )

    # Notify all users with this role about permission changes
    users_with_role = await db.users.find(
        {"role": update.role}, {"id": 1, "_id": 0}
    ).to_list(1000)

    if users_with_role:
        user_ids = [u["id"] for u in users_with_role]
        await manager.broadcast_permission_change(user_ids)
        logging.info(
            f"Notified {len(user_ids)} users about permission changes for role '{update.role}'"
        )

    return {"message": f"Role configuration for '{update.role}' updated successfully"}


@api_router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str, current_user: User = Depends(get_current_user)
):
    """Get effective permissions for a user (role + overrides)"""
    # Admin can view any user, others can only view themselves
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = user["role"]

    # Get role-level permissions
    role_config = await db.role_configs.find_one({"role": user_role}, {"_id": 0})

    if role_config:
        role_permissions = role_config["permissions"]
    else:
        # Use default permissions if no custom config exists
        role_permissions = DEFAULT_ROLE_PERMISSIONS.get(
            user_role, DEFAULT_ROLE_PERMISSIONS["user"]
        ).model_dump()

    # Apply user-specific overrides if they exist
    effective_permissions = (
        role_permissions.copy()
        if isinstance(role_permissions, dict)
        else role_permissions
    )

    if user.get("permission_overrides"):
        if isinstance(effective_permissions, dict):
            effective_permissions.update(user["permission_overrides"])
        else:
            # If effective_permissions is a Pydantic model, convert to dict first
            perm_dict = (
                effective_permissions.model_dump()
                if hasattr(effective_permissions, "model_dump")
                else dict(effective_permissions)
            )
            perm_dict.update(user["permission_overrides"])
            effective_permissions = perm_dict

    return {
        "user_id": user_id,
        "role": user["role"],  # Return actual user role (could be guest or client)
        "effective_role": user_role,  # Show which role's permissions are being used
        "role_permissions": role_permissions
        if isinstance(role_permissions, dict)
        else role_permissions.model_dump()
        if hasattr(role_permissions, "model_dump")
        else role_permissions,
        "permission_overrides": user.get("permission_overrides"),
        "effective_permissions": effective_permissions
        if isinstance(effective_permissions, dict)
        else effective_permissions.model_dump()
        if hasattr(effective_permissions, "model_dump")
        else effective_permissions,
    }


@api_router.put("/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: str,
    update: UserPermissionsUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update user-specific permission overrides (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update user's permission overrides
    permission_overrides = (
        update.permission_overrides.model_dump()
        if update.permission_overrides
        else None
    )

    await db.users.update_one(
        {"id": user_id}, {"$set": {"permission_overrides": permission_overrides}}
    )

    # Notify this specific user about their permission changes
    await manager.broadcast_permission_change([user_id])
    logging.info(f"Notified user {user_id} about permission override changes")

    return {"message": "User permissions updated successfully"}


@api_router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    """Upload and store user profile image as base64"""
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read file content
    file_content = await file.read()

    # Convert to base64
    base64_image = base64.b64encode(file_content).decode("utf-8")
    image_url = f"data:{file.content_type};base64,{base64_image}"

    # Update user profile image
    await db.users.update_one(
        {"id": current_user.id}, {"$set": {"profile_image_url": image_url}}
    )

    return {"profile_image_url": image_url}


# ============ BUSINESS SETTINGS ROUTES ============


@api_router.get("/business-settings")
async def get_business_settings(current_user: User = Depends(get_current_user)):
    """Get business settings (all users can view)"""
    settings = await db.business_settings.find_one({}, {"_id": 0})
    if not settings:
        # Return default empty settings
        return {
            "company_name": "",
            "company_email": "",
            "company_phone": "",
            "company_address": "",
            "company_logo_url": None,
        }
    return BusinessSettings(**settings)


@api_router.put("/business-settings")
async def update_business_settings(
    settings: BusinessSettingsUpdate, current_user: User = Depends(get_current_user)
):
    """Update business settings (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.id

    existing = await db.business_settings.find_one({})
    if existing:
        await db.business_settings.update_one({}, {"$set": update_data})
    else:
        new_settings = BusinessSettings(**update_data, id=str(uuid.uuid4()))
        await db.business_settings.insert_one(new_settings.model_dump())

    updated = await db.business_settings.find_one({}, {"_id": 0})
    return BusinessSettings(**updated)


# ============ INTEGRATIONS ROUTES ============


@api_router.get("/integrations/status")
async def get_integrations_status(current_user: User = Depends(get_current_user)):
    """Get status of all integrations"""
    integrations = await db.integrations.find({}, {"_id": 0, "credentials": 0}).to_list(
        100
    )

    # Ensure we have entries for both integrations
    integration_map = {i["name"]: i for i in integrations}

    result = []

    # Check Jibble - if not in DB, check .env
    if "jibble" in integration_map:
        result.append(integration_map["jibble"])
    else:
        # Check if Jibble credentials exist in .env
        jibble_client_id = settings.jibble_client_id
        jibble_secret = settings.jibble_secret_key

        if jibble_client_id and jibble_secret:
            # Jibble is connected via .env
            result.append(
                {
                    "name": "jibble",
                    "is_connected": True,
                    "config": {"source": "environment"},
                    "webhook_url": None,
                    "connected_at": None,
                    "connected_via": "environment",
                }
            )
        else:
            result.append(
                {
                    "name": "jibble",
                    "is_connected": False,
                    "config": None,
                    "webhook_url": None,
                    "connected_at": None,
                }
            )

    # Check GoHighLevel
    if "gohighlevel" in integration_map:
        result.append(integration_map["gohighlevel"])
    else:
        result.append(
            {
                "name": "gohighlevel",
                "is_connected": False,
                "config": None,
                "webhook_url": None,
                "connected_at": None,
            }
        )

    return result


@api_router.post("/integrations/ghl/test-connection")
async def test_ghl_connection(
    request: GHLTestConnectionRequest, current_user: User = Depends(get_current_user)
):
    """Test GoHighLevel connection before saving"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {request.api_key}",
                "Version": "2021-07-28",
            }

            # Test API key by fetching location details
            location_response = await client.get(
                f"https://services.leadconnectorhq.com/locations/{request.location_id}",
                headers=headers,
                timeout=10.0,
            )

            if location_response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid GoHighLevel credentials or Location ID",
                )

            location_data = location_response.json()

            return {
                "success": True,
                "message": "Connection successful!",
                "location_name": location_data.get("name", "Unknown Location"),
            }

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to connect to GoHighLevel: {str(e)}"
        )


@api_router.post("/integrations/ghl/fetch-pipelines")
async def fetch_ghl_pipelines(
    request: GHLFetchPipelinesRequest, current_user: User = Depends(get_current_user)
):
    """Fetch pipelines from GoHighLevel"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {request.api_key}",
                "Version": "2021-07-28",
            }

            # Fetch pipelines for the location
            pipelines_response = await client.get(
                f"https://services.leadconnectorhq.com/opportunities/pipelines",
                headers=headers,
                params={"locationId": request.location_id},
                timeout=10.0,
            )

            if pipelines_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch pipelines")

            pipelines_data = pipelines_response.json()
            pipelines = pipelines_data.get("pipelines", [])

            # Format pipelines for frontend
            formatted_pipelines = [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "stages": p.get("stages", []),
                }
                for p in pipelines
            ]

            return {"success": True, "pipelines": formatted_pipelines}

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch pipelines: {str(e)}"
        )


@api_router.get("/integrations/ghl/pipelines")
async def get_ghl_pipelines(current_user: User = Depends(get_current_user)):
    """Get GoHighLevel pipelines (requires API key in query or stored)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # This endpoint is called during GHL connection setup
    # API key should be passed in header for testing before saving
    return {"message": "This endpoint will be called from frontend with temp API key"}


@api_router.post("/integrations/ghl/connect")
async def connect_ghl(
    request: GHLConnectRequest, current_user: User = Depends(get_current_user)
):
    """Connect GoHighLevel integration - Simple webhook mode"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Simple webhook mode - no API validation needed
    # Just generate and store webhook URL

    # Generate webhook URL using backend URL from environment or request
    if request.current_origin:
        backend_url = request.current_origin.rstrip("/")
    else:
        # Use the centralized helper function
        backend_url = get_frontend_url()

    webhook_url = f"{backend_url}/api/webhooks/ghl/opportunity"

    # Update or create integration
    existing = await db.integrations.find_one({"name": "gohighlevel"})

    integration_data = {
        "name": "gohighlevel",
        "is_connected": True,
        "credentials": None,  # No credentials needed for webhook-only mode
        "config": {
            "mode": "webhook-only",
            "outbound_webhook_url": request.api_key
            if request.api_key != "webhook-only"
            else None,  # Store user's GHL webhook URL here
        },
        "webhook_url": webhook_url,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "connected_by": current_user.id,
    }

    if existing:
        await db.integrations.update_one(
            {"name": "gohighlevel"}, {"$set": integration_data}
        )
    else:
        integration_data["id"] = str(uuid.uuid4())
        await db.integrations.insert_one(integration_data)

    return {
        "message": "GoHighLevel integration activated successfully",
        "is_connected": True,
        "webhook_url": webhook_url,
    }


@api_router.post("/integrations/jibble/connect")
async def connect_jibble(
    request: JibbleConnectRequest, current_user: User = Depends(get_current_user)
):
    """Connect Jibble integration and automatically sync team members"""
    import requests

    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # First test the Jibble credentials by trying to get an access token
    try:
        # Test Jibble connection
        token_response = requests.post(
            JIBBLE_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": request.client_id,
                "client_secret": request.secret_key,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Invalid Jibble credentials. Please check your Client ID and Secret Key.",
            )

        # Parse token response
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            raise HTTPException(
                status_code=400, detail="Failed to obtain access token from Jibble"
            )

    except requests.RequestException as e:
        raise HTTPException(
            status_code=400,
            detail="Failed to connect to Jibble API. Please check your internet connection and try again.",
        )

    # Store the credentials in database
    integration_data = {
        "name": "jibble",
        "is_connected": True,
        "credentials": {
            "client_id": request.client_id,
            "secret_key": request.secret_key,
        },
        "config": {"source": "ui"},
        "webhook_url": None,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "connected_by": current_user.id,
        "connected_via": "ui",
    }

    # Update or create integration
    existing = await db.integrations.find_one({"name": "jibble"})

    if existing:
        await db.integrations.update_one({"name": "jibble"}, {"$set": integration_data})
    else:
        integration_data["id"] = str(uuid.uuid4())
        await db.integrations.insert_one(integration_data)

    # Automatically sync team members after successful connection
    try:
        # Get Jibble team members using the new credentials
        people_response = requests.get(
            "https://workspace.prod.jibble.io/v1/People",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"$select": "id,fullName,email,positionName,avatar,isActive"},
            timeout=10,
        )

        if people_response.status_code == 200:
            people_data = people_response.json()
            people_list = people_data.get("value", [])

            synced_count = 0
            for person in people_list:
                person_email = person.get("email", "").lower()

                if person_email:
                    # Check if user already exists
                    existing_user = await db.users.find_one({"email": person_email})

                    if not existing_user:
                        # Create user account with default password
                        user_data = {
                            "id": str(uuid.uuid4()),
                            "name": person.get("fullName", "Unknown"),
                            "email": person_email,
                            "role": "team_member",
                            "password_hash": get_password_hash("changeme123"),
                            "profile_image_url": person.get("avatar"),
                            "timezone": None,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "jibble_id": person.get("id"),
                            "synced_from_jibble": True,
                        }

                        await db.users.insert_one(user_data)
                        synced_count += 1

            return {
                "message": f"Jibble connected successfully! Synced {synced_count} new team members.",
                "is_connected": True,
                "synced_count": synced_count,
                "total_members": len(people_list),
            }
        else:
            # Connection successful but sync failed
            return {
                "message": "Jibble connected successfully, but team sync failed. You can manually sync from the Dashboard.",
                "is_connected": True,
                "synced_count": 0,
            }

    except Exception as e:
        logger.error(f"Failed to sync team members after Jibble connection: {str(e)}")
        # Connection successful but sync failed
        return {
            "message": "Jibble connected successfully, but team sync failed. You can manually sync from the Dashboard.",
            "is_connected": True,
            "synced_count": 0,
        }


@api_router.delete("/integrations/{integration_name}/disconnect")
async def disconnect_integration(
    integration_name: str, current_user: User = Depends(get_current_user)
):
    """Disconnect an integration (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if integration_name not in ["jibble", "gohighlevel"]:
        raise HTTPException(status_code=400, detail="Invalid integration name")

    await db.integrations.update_one(
        {"name": integration_name},
        {
            "$set": {
                "is_connected": False,
                "credentials": None,
                "config": None,
                "webhook_url": None,
            }
        },
    )

    return {"message": f"{integration_name} disconnected successfully"}


class SyncToGHLRequest(BaseModel):
    frontend_origin: Optional[str] = None


@api_router.post("/projects/{project_id}/sync-to-ghl")
async def sync_project_to_ghl(
    project_id: str,
    request_data: SyncToGHLRequest,
    current_user: User = Depends(get_current_user),
):
    """Send project data to GoHighLevel via webhook"""
    # Check if GHL integration is active
    ghl_integration = await db.integrations.find_one(
        {"name": "gohighlevel", "is_connected": True}
    )
    if not ghl_integration:
        raise HTTPException(
            status_code=400, detail="GoHighLevel integration not active"
        )

    outbound_url = ghl_integration.get("config", {}).get("outbound_webhook_url")
    if not outbound_url:
        raise HTTPException(status_code=400, detail="GHL webhook URL not configured")

    # Get project details
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get or create guest link (using old system that stores in project document)
    # This matches the manual guest link generation
    if not project.get("guest_link"):
        # Generate unique token like the manual generation does
        guest_token = str(uuid.uuid4())
        await db.projects.update_one(
            {"id": project_id},
            {
                "$set": {
                    "guest_link": guest_token,
                    "guest_link_created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        project["guest_link"] = guest_token
        logger.info(
            f"Auto-generated guest link for project {project_id} during GHL sync"
        )

    # Get frontend URL from request or fallback
    if request_data.frontend_origin:
        frontend_url = request_data.frontend_origin.rstrip("/")
    else:
        # Use the centralized helper function
        frontend_url = get_frontend_url()

    # Build guest link using the same format as manual generation
    guest_link = f"{frontend_url}/guest-invite/{project['guest_link']}"

    # Get tasks
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    pending_tasks = [t for t in tasks if t.get("status") != "Completed"]
    completed_tasks = [t for t in tasks if t.get("status") == "Completed"]

    # Get deliverables
    deliverables = await db.deliverables.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(1000)

    # Calculate project progress
    total_tasks = len(tasks)
    completed_count = len(completed_tasks)
    progress_percentage = (
        (completed_count / total_tasks * 100) if total_tasks > 0 else 0
    )

    # Prepare payload
    payload = {
        "project_id": project_id,
        "project_name": project["name"],
        "client_name": project.get("client_name"),
        "client_email": project.get("client_email"),
        "client_phone": project.get("client_phone"),
        "company_name": project.get("company_name"),
        "status": project.get("status"),
        "priority": project.get("priority"),
        "budget": project.get("budget"),
        "start_date": project.get("start_date"),
        "guest_link": guest_link,
        "progress_percentage": round(progress_percentage, 2),
        "total_tasks": total_tasks,
        "pending_tasks_count": len(pending_tasks),
        "completed_tasks_count": completed_count,
        "pending_tasks": [
            {
                "title": t["title"],
                "due_date": t.get("due_date"),
                "priority": t.get("priority"),
            }
            for t in pending_tasks[:10]
        ],  # Send first 10
        "deliverables": [
            {
                "name": d["name"],
                "status": d.get("status"),
                "approved": d.get("approved_by_guest", False),
            }
            for d in deliverables
        ],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }

    # Send to GHL
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(outbound_url, json=payload, timeout=10.0)

            if response.status_code >= 400:
                raise HTTPException(
                    status_code=500,
                    detail=f"GHL webhook returned {response.status_code}",
                )

            return {
                "status": "success",
                "message": "Project data synced to GoHighLevel",
                "ghl_response_status": response.status_code,
            }

    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to send to GHL: {str(e)}")


# ============ GHL WEBHOOK ENDPOINT ============


@api_router.post("/webhooks/ghl/opportunity")
async def ghl_opportunity_webhook(request: Request):
    """Receive GoHighLevel opportunity webhooks"""
    try:
        # Log request details
        logger.info(
            f"GHL Webhook received - Method: {request.method}, Content-Type: {request.headers.get('content-type')}"
        )

        # Try to get the body
        body = await request.body()
        logger.info(f"Raw body: {body}")

        # Parse JSON
        try:
            payload = await request.json()
        except:
            # If JSON parsing fails, try to parse the body manually
            if body:
                import json

                payload = json.loads(body)
            else:
                payload = {}

        # Log the full payload for debugging
        logger.info(f"GHL Webhook received. Payload keys: {list(payload.keys())}")
        logger.info(f"Full payload: {payload}")

        # Get GHL integration config
        ghl_integration = await db.integrations.find_one(
            {"name": "gohighlevel", "is_connected": True}
        )
        if not ghl_integration:
            logger.warning("GHL webhook received but integration not connected")
            return {"status": "integration_not_connected"}

        # If payload is empty, return success for now (might be a test ping)
        if not payload:
            logger.info("Empty payload received - might be a test webhook from GHL")
            return {"status": "test_webhook_received"}

        # Extract stage information - GHL can send stage name or ID
        opportunity_stage_id = (
            payload.get("stageId")
            or payload.get("stage_id")
            or payload.get("pipelineStageId")
            or payload.get("customData", {}).get("stageId")
        )
        opportunity_stage_name = payload.get("pipleline_stage") or payload.get(
            "pipeline_stage"
        )

        configured_stage_id = ghl_integration.get("config", {}).get("stage_id")

        logger.info(
            f"Stage info - ID: {opportunity_stage_id}, Name: {opportunity_stage_name}, Expected ID: {configured_stage_id}"
        )

        # Check if stage matches - either by ID or by name containing "Getting Started"
        stage_matches = False
        if opportunity_stage_id == configured_stage_id:
            stage_matches = True
        elif opportunity_stage_name and "Getting Started" in opportunity_stage_name:
            stage_matches = True
        elif opportunity_stage_id and "Getting Started" in str(opportunity_stage_id):
            stage_matches = True

        if not stage_matches:
            logger.info(
                f"Opportunity not in configured stage. Stage ID: {opportunity_stage_id}, Stage Name: {opportunity_stage_name}, Expected: {configured_stage_id}"
            )
            return {"status": "stage_not_matched"}

        logger.info("✅ Stage matched! Proceeding to create project...")

        # Extract opportunity details from webhook payload directly
        opportunity_id = (
            payload.get("opportunity_id")
            or payload.get("id")
            or payload.get("opportunityId")
            or payload.get("customData", {}).get("id")
        )
        opportunity_name = (
            payload.get("opportunity_name")
            or payload.get("name")
            or payload.get("title", "Untitled Opportunity")
        )
        opportunity_value = (
            payload.get("lead_value")
            or payload.get("monetaryValue")
            or payload.get("value", 0)
        )

        # Get contact details - check both root level and customData
        contact_id = (
            payload.get("contact_id")
            or payload.get("contactId")
            or payload.get("customData", {}).get("contactId")
        )

        # Try to get from customData first (more reliable), then root level
        custom_data = payload.get("customData", {})
        contact_name = (
            payload.get("client_name")
            or custom_data.get("Client name")
            or custom_data.get("client name")
            or payload.get("full_name")
            or payload.get("contact_name")
            or "Unknown"
        )
        contact_email = (
            payload.get("client_email")
            or custom_data.get("client email")
            or custom_data.get("Client email")
            or payload.get("email")
        )
        contact_phone = (
            payload.get("client_phone")
            or custom_data.get("client phone")
            or custom_data.get("Client phone")
            or payload.get("phone")
        )
        company_name = (
            payload.get("company_name")
            or custom_data.get("client business name")
            or custom_data.get("Client business name")
            or ""
        )

        description = payload.get(
            "description",
            f"Imported from GoHighLevel Opportunity (ID: {opportunity_id})",
        )

        logger.info(
            f"Creating project with: name={opportunity_name}, client={contact_name}, email={contact_email}"
        )

        # NO API CALLS TO GHL - All data comes from webhook payload
        # If you include notes/tasks in your GHL webhook payload, add them here
        notes_list = (
            payload.get("notes", []) if isinstance(payload.get("notes"), list) else []
        )
        tasks_list = (
            payload.get("tasks", []) if isinstance(payload.get("tasks"), list) else []
        )

        # Create project in Millionaze
        project_id = str(uuid.uuid4())
        project = Project(
            id=project_id,
            name=opportunity_name,
            company_name=company_name,  # Already extracted from payload
            business_name=company_name,  # Use same as company name
            client_name=contact_name,
            client_email=contact_email,
            client_phone=payload.get("phone"),  # Get phone from payload
            budget=float(opportunity_value) if opportunity_value else 0.0,
            status="Getting Started",
            priority="Medium",
            start_date=datetime.now(timezone.utc).isoformat(),  # Set start date to now
            description=f"Imported from GoHighLevel Opportunity (ID: {opportunity_id})",
            created_by="gohighlevel_integration",
            team_members=[],
        )

        await db.projects.insert_one(project.model_dump())

        logger.info(f"✅ Project created: {project_id} - {opportunity_name}")

        # Import notes as internal notes
        logger.info(f"Importing {len(notes_list)} notes...")
        for note in notes_list:
            note_content = note.get("body") or note.get("content", "")
            if note_content:
                internal_note = InternalNote(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    content=note_content,
                    created_by="gohighlevel_integration",
                )
                await db.internal_notes.insert_one(internal_note.model_dump())
                logger.info(f"  ✅ Note imported: {note_content[:50]}...")

        # Import tasks
        logger.info(f"Importing {len(tasks_list)} tasks...")
        for task in tasks_list:
            task_title = task.get("title") or task.get("name", "Untitled Task")
            task_description = task.get("description") or task.get("body", "")
            task_due_date = task.get("dueDate") or task.get("due_date")

            new_task = Task(
                id=str(uuid.uuid4()),
                project_id=project_id,
                title=task_title,
                description=task_description,
                assignee=None,  # Leave unassigned as requested
                due_date=task_due_date,
                priority="Medium",
                status="Not Started",
            )
            await db.tasks.insert_one(new_task.model_dump())
            logger.info(f"  ✅ Task imported: {task_title}")

        # Generate guest link for the project
        guest_token = str(uuid.uuid4())
        guest_link = GuestLink(
            id=str(uuid.uuid4()), project_id=project_id, token=guest_token
        )
        await db.guest_links.insert_one(guest_link.model_dump())
        logger.info(f"✅ Guest link generated: {guest_token}")

        # Construct guest link URL using centralized helper
        frontend_url = get_frontend_url()
        guest_link_url = f"{frontend_url}/guest/{guest_token}"

        logger.info(
            f"✅ Successfully created project {project_id} from GHL opportunity {opportunity_id}"
        )
        logger.info(f"✅ Guest link: {guest_link_url}")

        # Return success with guest link (GHL can capture this in webhook response if needed)
        return {
            "status": "success",
            "project_id": project_id,
            "guest_link": guest_link_url,
            "notes_imported": len(notes_list),
            "tasks_imported": len(tasks_list),
        }

    except Exception as e:
        import traceback

        logger.error(f"Error processing GHL webhook: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}


# ============ CHAT & NOTIFICATION REST API ENDPOINTS ============


@api_router.get("/projects/{project_id}/status")
async def get_project_status(
    project_id: str, current_user: User = Depends(get_current_user)
):
    """Get project status to determine chat channel visibility"""
    try:
        project = await db.projects.find_one({"id": project_id})

        if not project:
            return {"status": "notFound", "message": "Project not found in database"}

        # Check if project is archived
        if project.get("archived", False):
            return {"status": "inactive", "message": "Project is archived"}

        # Check if project is completed
        if project.get("status") == "Completed":
            return {"status": "inactive", "message": "Project is completed"}

        return {"status": "active", "message": "Project is active"}

    except Exception as e:
        logging.error(f"Error checking project status: {str(e)}")
        return {"status": "error", "message": "Error checking project status"}


@api_router.get("/channels")
async def get_channels(current_user: User = Depends(get_current_user)):
    """Get all channels organized by category (Company, Project, DM)"""
    # Clients only see project channels they're part of
    if current_user.role == "client":
        channels = await db.channels.find(
            {
                "members": current_user.id,
                "type": "project",  # Only project channels, no direct messages or company channels
            },
            {"_id": 0},
        ).to_list(length=None)
        logging.info(
            f"Client user {current_user.id} ({current_user.role}) fetching channels, found {len(channels)} project channels"
        )
    else:
        # Team members (including 'user' role), managers, and admins see all channels they're members of
        channels = await db.channels.find(
            {"members": current_user.id}, {"_id": 0}
        ).to_list(length=None)
        logging.info(
            f"Team member {current_user.id} fetching channels, found {len(channels)} channels"
        )

    # Filter project channels based on project status (active, not completed, not archived)
    filtered_channels = []
    for channel in channels:
        if channel.get("type") == "project":
            project_id = channel.get("project_id")
            if project_id:
                # Check project status
                project = await db.projects.find_one({"id": project_id})
                if project:
                    # Hide channel if project is archived or completed
                    if (
                        project.get("archived", False)
                        or project.get("status") == "Completed"
                    ):
                        logging.info(
                            f"Hiding project channel {channel['id']} for project {project_id}: archived={project.get('archived', False)}, status={project.get('status')}"
                        )
                        continue
                else:
                    # Hide channel if project doesn't exist
                    logging.info(
                        f"Hiding project channel {channel['id']} for non-existent project {project_id}"
                    )
                    continue

        filtered_channels.append(channel)

    # Organize channels by category for better frontend organization
    organized_channels = {
        "company": [],
        "project": [],
        "direct": [],
        "team": [],
        "announcement": [],
    }

    for channel in filtered_channels:
        channel_type = channel.get("type", "team")
        if channel_type in organized_channels:
            organized_channels[channel_type].append(channel)
        else:
            organized_channels["team"].append(channel)

    # Sort channels within each category by name
    for category in organized_channels:
        organized_channels[category] = sorted(
            organized_channels[category], key=lambda x: x.get("name", "").lower()
        )

    logging.info(
        f"User {current_user.id} ({current_user.role}) channels organized: Company={len(organized_channels['company'])}, Project={len(organized_channels['project'])}, Direct={len(organized_channels['direct'])}, Team={len(organized_channels['team'])}, Announcement={len(organized_channels['announcement'])}"
    )

    # Return both flat list (for compatibility) and organized structure
    return {
        "channels": filtered_channels,  # Flat list for backward compatibility
        "organized": organized_channels,  # Organized by category for new UI
    }


@api_router.post("/channels")
async def create_channel(
    channel_data: ChannelCreate, current_user: User = Depends(get_current_user)
):
    """
    Create a new channel.

    Original implementation restricted this to admin/manager only, but the
    RBAC design in this project allows regular team members to create channels
    as well (except clients). To match the documented behavior, we only block
    'client' users here.
    """
    # Permission check - block clients from creating channels
    if current_user.role == "client":
        raise HTTPException(
            status_code=403, detail="Clients are not allowed to create channels"
        )

    # Set updated timestamp and ensure slug
    channel_dict = channel_data.model_dump()
    channel_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not channel_dict.get("slug"):
        channel_dict["slug"] = str(uuid.uuid4())

    # Create channel
    channel = Channel(**channel_dict, created_by=current_user.id)

    # Add creator to members if not already
    if current_user.id not in channel.members:
        channel.members.append(current_user.id)

    # For company-wide public channels, add all team members (excluding clients only)
    if channel.category == "company" and not channel.is_private:
        # Get all team members (excluding clients)
        team_members = await db.users.find(
            {"role": {"$in": ["admin", "manager", "team member", "user"]}},
            {"_id": 0, "id": 1},
        ).to_list(length=None)

        team_member_ids = [member["id"] for member in team_members]
        # Add team members to channel (avoid duplicates)
        for member_id in team_member_ids:
            if member_id not in channel.members:
                channel.members.append(member_id)

    # Save to database
    await db.channels.insert_one(channel.model_dump())

    # Broadcast channel creation to all connected users
    await manager.broadcast_channel_update()

    logging.info(
        f"Channel '{channel.name}' created by {current_user.name} ({current_user.role})"
    )
    return channel


@api_router.post("/channels/{channel_id}/messages")
async def send_channel_message(
    channel_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
):
    """Send a message to a channel"""
    # Verify user is member of channel
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this channel")

    # Check channel permissions
    channel_permissions = channel.get("permissions", {})

    # Check if channel is read-only
    if channel_permissions.get("read_only", False):
        # Only admin and manager can send messages in read-only channels
        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="This channel is read-only")

    # Check if user can send messages
    if not channel_permissions.get("can_send_messages", True):
        # Only admin and manager can send messages if disabled for everyone
        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to send messages in this channel",
            )

    # Create message
    message = Message(
        channel_id=channel_id,
        content=message_data.content,
        mentions=message_data.mentions,
        reply_to=message_data.reply_to,
        attachments=message_data.attachments,
        sender_id=current_user.id,
        sender_name=current_user.name,
    )

    # Save to database
    await db.messages.insert_one(message.model_dump())

    # Broadcast message to all channel members via WebSocket
    await manager.broadcast_to_channel(
        {"type": "new_message", "message": message.model_dump()}, channel_id
    )

    # Create notifications and track unread for all channel members except sender
    channel_members = channel.get("members", [])
    for member_id in channel_members:
        if member_id != current_user.id:
            # Increment unread count for this user in this channel
            await db.channel_unreads.update_one(
                {"user_id": member_id, "channel_id": channel_id},
                {
                    "$inc": {"unread_count": 1},
                    "$set": {"last_message_at": message.created_at},
                },
                upsert=True,
            )

            # Create notification for new message (not just mentions)
            channel_name = channel.get("name", "Unknown Channel")
            notification_data = NotificationCreate(
                user_id=member_id,
                type="new_message",
                title=f"New message in {channel_name}",
                message=f"{current_user.name}: {message.content[:100]}",
                link=f"/chats?channel={channel_id}",
                metadata={"message_id": message.id, "channel_id": channel_id},
            )
            await create_notification(notification_data)

    # Create additional notifications for mentions
    if message.mentions:
        for mentioned_user_id in message.mentions:
            if mentioned_user_id != current_user.id:
                notification_data = NotificationCreate(
                    user_id=mentioned_user_id,
                    type="mention",
                    title=f"{current_user.name} mentioned you",
                    message=message.content[:100],
                    link=f"/chats?channel={channel_id}",
                    priority="urgent",
                    metadata={
                        "message_id": message.id,
                        "channel_id": channel_id,
                        "sender_name": current_user.name,
                    },
                )
                await create_notification(notification_data)

    return message


@api_router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get messages from a channel with pagination"""
    # Verify user is member of channel
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel or current_user.id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member of this channel")

    query = {"channel_id": channel_id}
    if before:
        query["created_at"] = {"$lt": before}

    messages = (
        await db.messages.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=None)
    )

    # Mark channel as read for this user
    await db.channel_unreads.update_one(
        {"user_id": current_user.id, "channel_id": channel_id},
        {"$set": {"unread_count": 0}},
        upsert=True,
    )

    return list(reversed(messages))


@api_router.post("/messages/{message_id}/analyze-for-task")
async def analyze_message_for_task(
    message_id: str, current_user: User = Depends(get_current_user)
):
    """
    Analyze a chat message using AI to extract potential task details.
    Returns task suggestions if the message contains actionable items.
    """
    from openai import AsyncOpenAI
    import json

    # Get the message
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get channel to verify it's a project channel
    channel = await db.channels.find_one({"id": message.get("channel_id")}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Only work with project channels
    if channel.get("type") != "project":
        return {
            "is_actionable": False,
            "message": "Task extraction only works in project channels",
        }

    project_id = channel.get("project_id")
    if not project_id:
        return {
            "is_actionable": False,
            "message": "No project associated with this channel",
        }

    # Get project details
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get team members for assignee suggestions
    team_member_ids = [project.get("created_by")] + project.get("team_members", [])
    team_members = await db.users.find(
        {"id": {"$in": team_member_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1},
    ).to_list(length=None)

    # Initialize OpenAI client
    api_key = settings.emergent_llm_key or settings.openai_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    client = AsyncOpenAI(api_key=api_key)

    system_message = """You are a task extraction AI assistant. Analyze chat messages to identify actionable tasks.

Your job:
1. Determine if the message contains an actionable task/request
2. If yes, extract: title, description, priority, due date (if mentioned), and suggest an assignee

Return JSON ONLY with this exact structure:
{
  "is_actionable": true/false,
  "task_title": "Brief task title (max 100 chars)",
  "task_description": "Detailed description with context",
  "priority": "Low"/"Medium"/"High",
  "suggested_due_date": "YYYY-MM-DD" or null,
  "suggested_assignee": "team_member_name" or null,
  "confidence": 0.0-1.0
}

Examples of actionable messages:
- "Can you create a contact form on the homepage?"
- "We need to add ABC feature by Friday"
- "Please fix the login bug ASAP"

Examples of non-actionable:
- "Thanks for the update"
- "Looks good!"
- "When can we have a meeting?"

Return ONLY valid JSON, no other text."""

    # Prepare context
    team_names = [m.get("name") for m in team_members if m.get("name")]

    # Build prompt
    prompt = f"""Analyze this message and extract task details if it's actionable:

MESSAGE: "{message.get("content")}"

PROJECT CONTEXT:
- Project Name: {project.get("name")}
- Team Members: {", ".join(team_names)}

Return JSON only."""

    try:
        # Call AI
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt},
            ],
        )

        # Parse response
        response_text = response.choices[0].message.content.strip()

        # Try to extract JSON from response
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        result = json.loads(response_text)

        # Add metadata
        result["message_id"] = message_id
        result["message_content"] = message.get("content")
        result["project_id"] = project_id
        result["project_name"] = project.get("name")
        result["channel_id"] = channel.get("id")

        # Try to match suggested assignee to actual user
        if result.get("suggested_assignee"):
            suggested_name = result["suggested_assignee"].lower()
            matched_user = None
            for member in team_members:
                if (
                    member.get("name", "").lower() in suggested_name
                    or suggested_name in member.get("name", "").lower()
                ):
                    matched_user = member
                    break

            if matched_user:
                result["suggested_assignee_id"] = matched_user.get("id")
                result["suggested_assignee_name"] = matched_user.get("name")
            else:
                result["suggested_assignee_id"] = None
                result["suggested_assignee_name"] = None

        return result

    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse AI response as JSON: {response_text}")
        return {
            "is_actionable": False,
            "error": "Failed to parse AI response",
            "raw_response": response_text[:200] if response_text else "",
        }
    except Exception as e:
        logging.error(f"AI task extraction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@api_router.get("/channels/unreads/counts")
async def get_unread_counts(current_user: User = Depends(get_current_user)):
    """Get unread message counts for all channels"""
    unreads = await db.channel_unreads.find(
        {"user_id": current_user.id, "unread_count": {"$gt": 0}}, {"_id": 0}
    ).to_list(length=None)

    # Return as a dict with channel_id as key
    unread_dict = {item["channel_id"]: item["unread_count"] for item in unreads}
    return unread_dict


@api_router.put("/channels/{channel_id}/mark-read")
async def mark_channel_read(
    channel_id: str, current_user: User = Depends(get_current_user)
):
    """Mark a channel as read (clear unread count)"""
    await db.channel_unreads.update_one(
        {"user_id": current_user.id, "channel_id": channel_id},
        {"$set": {"unread_count": 0}},
        upsert=True,
    )
    return {"success": True}


@api_router.post("/messages/{message_id}/reactions")
async def add_message_reaction(
    message_id: str, reaction_data: dict, current_user: User = Depends(get_current_user)
):
    """Add or remove a reaction to a message"""
    emoji = reaction_data.get("emoji")
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji required")

    # Get the message
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = message.get("reactions", {})
    action = None  # Track if we're adding or removing

    # Toggle reaction
    if emoji in reactions:
        if current_user.id in reactions[emoji]:
            # Remove reaction
            reactions[emoji] = [
                uid for uid in reactions[emoji] if uid != current_user.id
            ]
            if not reactions[emoji]:
                del reactions[emoji]
            action = "removed"
        else:
            # Add reaction
            reactions[emoji].append(current_user.id)
            action = "added"
    else:
        # Add new reaction
        reactions[emoji] = [current_user.id]
        action = "added"

    # Update message
    await db.messages.update_one({"id": message_id}, {"$set": {"reactions": reactions}})

    # Broadcast reaction update via WebSocket to all channel members
    channel_id = message.get("channel_id")
    if channel_id:
        await manager.broadcast_to_channel(
            {
                "type": f"reaction_{action}",
                "message_id": message_id,
                "emoji": emoji,
                "user_id": current_user.id,
                "user_name": current_user.name,
                "reactions": reactions,
            },
            channel_id,
        )

    return {"success": True, "reactions": reactions}


@api_router.post("/messages/{message_id}/mark-read")
async def mark_message_read(
    message_id: str, current_user: User = Depends(get_current_user)
):
    """Mark a message as read by the current user"""
    # Get the message
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Don't mark your own messages as read
    if message.get("sender_id") == current_user.id:
        return {"success": True, "already_read": True}

    # Check if user already marked it as read
    read_by = message.get("read_by", [])
    if current_user.id in read_by:
        return {"success": True, "already_read": True}

    # Add user to read_by list
    await db.messages.update_one(
        {"id": message_id}, {"$addToSet": {"read_by": current_user.id}}
    )

    # Broadcast read receipt via WebSocket
    await manager.broadcast_to_channel(
        {
            "type": "message_read",
            "message_id": message_id,
            "user_id": current_user.id,
            "user_name": current_user.name,
        },
        message.get("channel_id"),
    )

    return {"success": True}


@api_router.get("/messages/{message_id}/read-by")
async def get_message_read_by(
    message_id: str, current_user: User = Depends(get_current_user)
):
    """Get list of users who have read a message"""
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    read_by_ids = message.get("read_by", [])

    # Get user details
    users = await db.users.find(
        {"id": {"$in": read_by_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(100)

    return {"read_by": users}


@api_router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a channel with hierarchical permissions"""
    # Get channel first
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Don't allow deleting General channel
    if channel.get("name") == "General":
        raise HTTPException(status_code=400, detail="Cannot delete General channel")

    # Permission check with hierarchy
    channel_created_by = channel.get("created_by")
    is_admin = current_user.role == "admin"
    is_manager = current_user.role == "manager"

    # Admin can delete any channel
    # Manager can delete channels they created, but not admin-created channels
    if not is_admin:
        if not is_manager:
            raise HTTPException(
                status_code=403, detail="Only admins and managers can delete channels"
            )

        # Check if manager is trying to delete admin-created channel
        creator_user = await db.users.find_one({"id": channel_created_by}, {"_id": 0})
        if creator_user and creator_user.get("role") == "admin":
            raise HTTPException(
                status_code=403, detail="Managers cannot delete admin-created channels"
            )

    # Delete channel
    result = await db.channels.delete_one({"id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Delete all messages in the channel
    await db.messages.delete_many({"channel_id": channel_id})

    # Clear unread counts
    await db.channel_unreads.delete_many({"channel_id": channel_id})

    # Broadcast channel update
    await manager.broadcast_channel_update()

    logging.info(
        f"Channel '{channel['name']}' deleted by {current_user.name} ({current_user.role})"
    )
    return {"success": True}


@api_router.get("/direct-channels/{user_id}")
async def get_or_create_direct_channel(
    user_id: str, current_user: User = Depends(get_current_user)
):
    """Get or create a direct message channel with another user"""
    # Check if DM channel already exists
    channel = await db.channels.find_one(
        {"type": "direct", "members": {"$all": [current_user.id, user_id]}}, {"_id": 0}
    )

    if channel:
        return channel

    # Get other user info
    other_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create new DM channel
    channel_data = ChannelCreate(
        name=f"{current_user.name} & {other_user['name']}",
        type="direct",
        members=[current_user.id, user_id],
    )

    channel = Channel(**channel_data.model_dump(), created_by=current_user.id)
    await db.channels.insert_one(channel.model_dump())

    # Notify both users

    return channel


# ============ NEW CHANNEL MANAGEMENT ENDPOINTS ============


@api_router.put("/channels/{channel_id}")
async def update_channel(
    channel_id: str,
    update_data: ChannelUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update channel settings - Admin, Manager, and channel creator only"""
    # Get existing channel
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Permission check - admin, manager, or channel creator
    channel_created_by = channel.get("created_by")
    is_admin = current_user.role == "admin"
    is_manager = current_user.role == "manager"
    is_creator = current_user.id == channel_created_by

    if not (is_admin or (is_manager and channel_created_by != "admin") or is_creator):
        raise HTTPException(
            status_code=403, detail="Insufficient permissions to update this channel"
        )

    # Prepare update data
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name
    if update_data.description is not None:
        update_dict["description"] = update_data.description
    if update_data.is_private is not None:
        update_dict["is_private"] = update_data.is_private
    if update_data.permissions is not None:
        update_dict["permissions"] = update_data.permissions
    if update_data.category is not None:
        update_dict["category"] = update_data.category

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Update channel
    result = await db.channels.update_one({"id": channel_id}, {"$set": update_dict})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Broadcast channel update
    await manager.broadcast_channel_update()

    # Get updated channel
    updated_channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    return updated_channel


@api_router.post("/channels/{channel_id}/members")
async def manage_channel_members(
    channel_id: str,
    member_action: ChannelMemberAction,
    current_user: User = Depends(get_current_user),
):
    """Add or remove members from channel - Admin and Manager only"""
    # Permission check
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and managers can manage channel members",
        )

    # Get existing channel
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Additional permission check for managers
    if current_user.role == "manager" and channel.get("created_by") == "admin":
        raise HTTPException(
            status_code=403, detail="Managers cannot modify admin-created channels"
        )

    current_members = set(channel.get("members", []))

    if member_action.action == "add":
        # Add members
        for user_id in member_action.user_ids:
            # Verify user exists and is not a client
            user = await db.users.find_one({"id": user_id}, {"_id": 0})
            if not user:
                continue  # Skip invalid users
            if user.get("role") == "client":
                continue  # Skip clients from team channels
            current_members.add(user_id)

        # Update channel
        await db.channels.update_one(
            {"id": channel_id},
            {
                "$set": {
                    "members": list(current_members),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        action_message = "added to"

    elif member_action.action == "remove":
        # Remove members (except channel creator)
        channel_creator = channel.get("created_by")
        for user_id in member_action.user_ids:
            if user_id != channel_creator:  # Can't remove creator
                current_members.discard(user_id)

        # Update channel
        await db.channels.update_one(
            {"id": channel_id},
            {
                "$set": {
                    "members": list(current_members),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        action_message = "removed from"
    else:
        raise HTTPException(
            status_code=400, detail="Invalid action. Use 'add' or 'remove'"
        )

    # Broadcast channel update
    await manager.broadcast_channel_update()

    logging.info(
        f"Users {member_action.user_ids} {action_message} channel '{channel['name']}' by {current_user.name}"
    )
    return {
        "success": True,
        "action": member_action.action,
        "affected_users": member_action.user_ids,
    }


@api_router.get("/channels/{channel_id}/members")
async def get_channel_members(
    channel_id: str, current_user: User = Depends(get_current_user)
):
    """Get list of channel members with their details"""
    # Get channel and verify user has access
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check if user is member of channel or has admin/manager privileges
    if current_user.id not in channel.get("members", []) and current_user.role not in [
        "admin",
        "manager",
    ]:
        raise HTTPException(
            status_code=403, detail="Not authorized to view channel members"
        )

    member_ids = channel.get("members", [])
    if not member_ids:
        return {"members": []}

    # Get member details
    members = await db.users.find(
        {"id": {"$in": member_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "profile_image_url": 1},
    ).to_list(100)

    # Add additional info
    for member in members:
        # Check if member is online
        member["is_online"] = member["id"] in manager.get_online_users()
        member["is_creator"] = member["id"] == channel.get("created_by")

    return {"members": members}


@api_router.get("/users/available-for-channel")
async def get_users_available_for_channel(
    channel_id: Optional[str] = None, current_user: User = Depends(get_current_user)
):
    """Get list of users that can be added to channels (excludes clients only)"""
    # Permission check
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403, detail="Only admins and managers can view available users"
        )

    # Get all team members (exclude clients only, include 'user' role)
    query = {"role": {"$in": ["admin", "manager", "team member", "user"]}}

    # If channel_id provided, exclude existing members
    if channel_id:
        channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
        if channel:
            existing_members = channel.get("members", [])
            if existing_members:
                query["id"] = {"$nin": existing_members}

    users = await db.users.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "profile_image_url": 1},
    ).to_list(100)

    # Add online status
    for user in users:
        user["is_online"] = user["id"] in manager.get_online_users()

    return {"users": users}


@api_router.delete("/channels/{channel_id}/members/{user_id}")
async def remove_channel_member(
    channel_id: str, user_id: str, current_user: User = Depends(get_current_user)
):
    """Remove a single member from channel"""
    # Permission check
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and managers can remove channel members",
        )

    # Get channel
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Additional permission check for managers
    if current_user.role == "manager" and channel.get("created_by") == "admin":
        raise HTTPException(
            status_code=403, detail="Managers cannot modify admin-created channels"
        )

    # Can't remove channel creator
    if user_id == channel.get("created_by"):
        raise HTTPException(status_code=400, detail="Cannot remove channel creator")

    # Remove user from members
    result = await db.channels.update_one(
        {"id": channel_id},
        {
            "$pull": {"members": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Broadcast channel update
    await manager.broadcast_channel_update()

    return {"success": True}


@api_router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Get user's notifications"""
    query = {"user_id": current_user.id}
    if unread_only:
        query["read"] = False

    notifications = (
        await db.notifications.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(length=None)
    )
    return notifications


@api_router.get("/notifications/unread-count")
async def get_unread_notification_count(current_user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents(
        {"user_id": current_user.id, "read": False}
    )
    return {"count": count}


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str, current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id}, {"$set": {"read": True}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"success": True}


@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.id, "read": False}, {"$set": {"read": True}}
    )
    return {"success": True}


@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str, current_user: User = Depends(get_current_user)
):
    """Delete a notification"""
    result = await db.notifications.delete_one(
        {"id": notification_id, "user_id": current_user.id}
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"success": True}


# ============ BATCH ENDPOINTS (Phase 3 Optimization) ============

@api_router.post("/users/batch")
async def batch_get_users(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Batch fetch users by IDs
    Reduces multiple requests into one (Request Batching optimization)
    """
    user_ids = request.get("ids", [])
    
    if not user_ids:
        return []
    
    # Limit to 100 users per batch
    user_ids = user_ids[:100]
    
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        USER_LIST_FIELDS
    ).to_list(100)
    
    return [User(**u) for u in users]


@api_router.post("/projects/batch")
async def batch_get_projects(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Batch fetch projects by IDs"""
    project_ids = request.get("ids", [])
    
    if not project_ids:
        return []
    
    project_ids = project_ids[:50]
    
    projects = await db.projects.find(
        {"id": {"$in": project_ids}},
        PROJECT_LIST_FIELDS
    ).to_list(50)
    
    return [Project(**p) for p in projects]


@api_router.post("/tasks/batch")
async def batch_get_tasks(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Batch fetch tasks by IDs"""
    task_ids = request.get("ids", [])
    
    if not task_ids:
        return []
    
    task_ids = task_ids[:100]
    
    tasks = await db.tasks.find(
        {"id": {"$in": task_ids}},
        TASK_LIST_FIELDS
    ).to_list(100)
    
    return [Task(**t) for t in tasks]


# Include email routes
api_router.include_router(email_router)

# Mount API router to FastAPI app
app.include_router(api_router)

# Add GZip compression middleware (should be added BEFORE CORS)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configure CORS
cors_origins = settings.cors_origins.split(",")
# Strip whitespace from each origin
cors_origins = [origin.strip() for origin in cors_origins]
# If using wildcard "*", we cannot use allow_credentials=True per CORS spec
# So we either allow all origins without credentials, or use specific origins with credentials
print(f"CORS Origins configured: {cors_origins}")
if cors_origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def auto_generate_scheduled_tasks():
    """Background task to automatically generate scheduled recurring tasks"""
    while True:
        try:
            # Wait for 1 minute between checks for more responsive scheduling
            await asyncio.sleep(60)  # 60 seconds = 1 minute

            logging.info(
                "Auto-scheduler: Checking for scheduled recurring tasks to generate"
            )

            # Get all active recurring tasks
            recurring_tasks = await db.recurring_tasks.find(
                {"is_active": {"$ne": False}}, {"_id": 0}
            ).to_list(1000)

            total_generated = 0

            for recurring_task in recurring_tasks:
                try:
                    # Log the current time vs scheduled time for debugging
                    recurrence_time_str = recurring_task.get("recurrence_time", "00:00")
                    current_time_str = datetime.now(timezone.utc).strftime("%H:%M")

                    # Check if we should generate based on schedule
                    should_generate = should_generate_task_today(recurring_task)

                    if should_generate:
                        generated_ids = await generate_tasks_from_recurring_template(
                            recurring_task
                        )
                        total_generated += len(generated_ids)
                        logging.info(
                            f"Auto-scheduler: ✅ Generated {len(generated_ids)} tasks for '{recurring_task.get('title')}' (ID: {recurring_task.get('id')}) at UTC {current_time_str}"
                        )
                    else:
                        logging.debug(
                            f"Auto-scheduler: ⏰ Skipped '{recurring_task.get('title')}' - scheduled for {recurrence_time_str} UTC (current: {current_time_str} UTC)"
                        )
                except Exception as e:
                    logging.error(
                        f"Auto-scheduler: ❌ Failed to generate tasks for template {recurring_task.get('id')}: {str(e)}"
                    )

            if total_generated > 0:
                logging.info(
                    f"Auto-scheduler: ✅ Generated {total_generated} tasks from {len(recurring_tasks)} templates"
                )
            else:
                logging.debug(
                    f"Auto-scheduler: No tasks generated this cycle (checked {len(recurring_tasks)} templates)"
                )

        except Exception as e:
            logging.error(f"Auto-scheduler error: {str(e)}")
            await asyncio.sleep(60)  # Wait 1 minute before retrying after error


# Vercel serverless function handler
# Note: Background tasks (auto_generate_scheduled_tasks) won't run in Vercel's serverless environment.
# Consider using Vercel Cron Jobs or an external scheduler for recurring tasks.
handler = app

