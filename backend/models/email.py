from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict
from enum import Enum

class EmailType(str, Enum):
    PASSWORD_RESET = "password_reset"
    USER_INVITATION = "user_invitation"
    TASK_NOTIFICATION = "task_notification"
    TIME_TRACKING_REPORT = "time_tracking_report"
    # New notification email types
    MENTION_NOTIFICATION = "mention_notification"
    TASK_ASSIGNED_NOTIFICATION = "task_assigned_notification"
    TASK_APPROVED_NOTIFICATION = "task_approved_notification"
    TASK_REJECTED_NOTIFICATION = "task_rejected_notification"
    TASK_UNDER_REVIEW_NOTIFICATION = "task_under_review_notification"
    PROJECT_COMPLETED_NOTIFICATION = "project_completed_notification"
    PROJECT_CREATED_NOTIFICATION = "project_created_notification"
    NEW_MESSAGE_NOTIFICATION = "new_message_notification"

class EmailRecipient(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class EmailContent(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    body_html: str = Field(..., min_length=1)
    body_text: Optional[str] = None

class PasswordResetEmail(BaseModel):
    recipient: EmailRecipient
    reset_link: str
    expiration_hours: int = 24

class UserInvitationEmail(BaseModel):
    recipient: EmailRecipient
    project_name: str
    invitation_link: str
    inviter_name: Optional[str] = None

class TaskNotificationEmail(BaseModel):
    recipient: EmailRecipient
    task_title: str
    task_description: Optional[str] = None
    due_date: Optional[str] = None
    task_link: Optional[str] = None

class TimeTrackingReportEmail(BaseModel):
    recipient: EmailRecipient
    report_period: str
    total_hours: float
    report_link: Optional[str] = None
    detailed_data: Optional[Dict] = None

# New notification email models
class NotificationEmail(BaseModel):
    recipient: EmailRecipient
    notification_type: str
    title: str
    message: str
    link: Optional[str] = None
    priority: str = "normal"  # urgent, normal, low
    sender_name: Optional[str] = None
    project_name: Optional[str] = None
    task_title: Optional[str] = None

class EmailResponse(BaseModel):
    success: bool
    message: str
    email_id: Optional[str] = None
    error_code: Optional[str] = None
