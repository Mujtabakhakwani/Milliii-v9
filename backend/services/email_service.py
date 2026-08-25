import asyncio
import logging
from typing import Dict, Any, Optional
from services.ghl_email_client import ghl_email_client
from services.email_templates import EmailTemplate
from models.email import (
    PasswordResetEmail, UserInvitationEmail,
    TaskNotificationEmail, TimeTrackingReportEmail, NotificationEmail
)

logger = logging.getLogger(__name__)

class EmailService:
    MAX_RETRIES = 3
    INITIAL_DELAY = 1  # seconds
    BACKOFF_FACTOR = 2
    MAX_DELAY = 60  # seconds
    
    @staticmethod
    async def send_password_reset(
        email_data: PasswordResetEmail,
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send password reset email with retry logic"""
        template = EmailTemplate.password_reset_template(
            email_data.recipient.name or "User",
            email_data.reset_link,
            email_data.expiration_hours
        )
        
        return await EmailService._send_with_retry(
            to_email=email_data.recipient.email,
            to_name=email_data.recipient.name,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            contact_id=contact_id
        )
    
    @staticmethod
    async def send_user_invitation(
        email_data: UserInvitationEmail,
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send user invitation email with retry logic"""
        template = EmailTemplate.user_invitation_template(
            email_data.recipient.name or "User",
            email_data.inviter_name or "Someone",
            email_data.project_name,
            email_data.invitation_link
        )
        
        return await EmailService._send_with_retry(
            to_email=email_data.recipient.email,
            to_name=email_data.recipient.name,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            contact_id=contact_id
        )

    @staticmethod
    async def send_team_member_welcome(
        recipient_name: str,
        recipient_email: str,
        password: str,
        login_link: str,
        inviter_name: str = "Admin",
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send team member welcome email with login credentials"""
        template = EmailTemplate.team_member_welcome_template(
            recipient_name=recipient_name,
            email=recipient_email,
            password=password,
            login_link=login_link,
            inviter_name=inviter_name
        )
        
        return await EmailService._send_with_retry(
            to_email=recipient_email,
            to_name=recipient_name,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            contact_id=contact_id
        )

    
    @staticmethod
    async def send_task_notification(
        email_data: TaskNotificationEmail,
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send task notification email with retry logic"""
        template = EmailTemplate.task_notification_template(
            email_data.recipient.name or "User",
            email_data.task_title,
            email_data.task_description or "No description provided",
            email_data.due_date or "Not specified",
            email_data.task_link or "#"
        )
        
        return await EmailService._send_with_retry(
            to_email=email_data.recipient.email,
            to_name=email_data.recipient.name,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            contact_id=contact_id
        )
    
    @staticmethod
    async def send_time_tracking_report(
        email_data: TimeTrackingReportEmail,
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send time tracking report email with retry logic"""
        template = EmailTemplate.time_tracking_report_template(
            email_data.recipient.name or "User",
            email_data.report_period,
            email_data.total_hours,
            email_data.report_link or "#"
        )
        
        return await EmailService._send_with_retry(
            to_email=email_data.recipient.email,
            to_name=email_data.recipient.name,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            contact_id=contact_id
        )
    
    @staticmethod
    async def send_notification_email(
        email_data: NotificationEmail,
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send notification email with retry logic and priority styling"""
        template = EmailTemplate.notification_email_template(
            recipient_name=email_data.recipient.name or "User",
            notification_type=email_data.notification_type,
            title=email_data.title,
            message=email_data.message,
            link=email_data.link,
            priority=email_data.priority,
            sender_name=email_data.sender_name,
            project_name=email_data.project_name,
            task_title=email_data.task_title
        )
        
        return await EmailService._send_with_retry(
            to_email=email_data.recipient.email,
            to_name=email_data.recipient.name,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            contact_id=contact_id
        )
    
    @staticmethod
    async def _send_with_retry(
        to_email: str,
        to_name: Optional[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        contact_id: Optional[str] = None,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """
        Send email with exponential backoff retry mechanism
        
        Implements exponential backoff strategy: delay = base * (factor ^ retry_count)
        """
        try:
            result = await ghl_email_client.send_email(
                to_email=to_email,
                to_name=to_name,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                contact_id=contact_id
            )
            
            if result.get("success"):
                logger.info(f"Email sent successfully to {to_email}")
                return result
            
            # Retry on failure if retries remaining
            if retry_count < EmailService.MAX_RETRIES:
                delay = EmailService.INITIAL_DELAY * (
                    EmailService.BACKOFF_FACTOR ** retry_count
                )
                delay = min(delay, EmailService.MAX_DELAY)
                
                logger.warning(
                    f"Email send failed for {to_email}, "
                    f"retrying in {delay}s (attempt {retry_count + 1}/"
                    f"{EmailService.MAX_RETRIES})"
                )
                
                await asyncio.sleep(delay)
                return await EmailService._send_with_retry(
                    to_email=to_email,
                    to_name=to_name,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                    contact_id=contact_id,
                    retry_count=retry_count + 1
                )
            
            logger.error(
                f"Failed to send email to {to_email} after "
                f"{EmailService.MAX_RETRIES} retries"
            )
            return result
            
        except Exception as e:
            logger.error(f"Exception during email send to {to_email}: {str(e)}")
            
            if retry_count < EmailService.MAX_RETRIES:
                delay = EmailService.INITIAL_DELAY * (
                    EmailService.BACKOFF_FACTOR ** retry_count
                )
                delay = min(delay, EmailService.MAX_DELAY)
                
                await asyncio.sleep(delay)
                return await EmailService._send_with_retry(
                    to_email=to_email,
                    to_name=to_name,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                    contact_id=contact_id,
                    retry_count=retry_count + 1
                )
            
            return {
                "success": False,
                "error_code": "SEND_FAILED",
                "error_message": str(e)
            }
