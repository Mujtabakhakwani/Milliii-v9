from typing import Dict


class EmailTemplate:
    @staticmethod
    def password_reset_otp_template(
        recipient_name: str, otp: str, expiration_minutes: int = 10
    ) -> Dict[str, str]:
        """Generate password reset OTP email template"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">Password Reset OTP</h2>
                    <p>Hello {recipient_name},</p>
                    <p>We received a request to reset your password for your Millii account. Use the OTP below to reset your password:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="display: inline-block; padding: 20px 40px; 
                           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; border-radius: 10px; font-size: 32px; 
                           font-weight: bold; letter-spacing: 8px;">
                            {otp}
                        </div>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        This OTP will expire in {expiration_minutes} minutes for security reasons.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        This is an automated message from Millii. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        Password Reset OTP
        
        Hello {recipient_name},
        
        We received a request to reset your password for your Millii account. 
        
        Your OTP is: {otp}
        
        This OTP will expire in {expiration_minutes} minutes for security reasons.
        
        If you didn't request this password reset, please ignore this email and your password will remain unchanged.
        """

        return {
            "subject": f"Your Password Reset OTP: {otp} - Millii",
            "html": html_content,
            "text": text_content,
        }

    @staticmethod
    def password_reset_template(
        recipient_name: str, reset_link: str, expiration_hours: int
    ) -> Dict[str, str]:
        """Generate password reset email template"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">Password Reset Request</h2>
                    <p>Hello {recipient_name},</p>
                    <p>We received a request to reset your password for your Millii account. Click the button below to create a new password.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" 
                           style="display: inline-block; padding: 12px 24px; 
                           background-color: #007bff; color: white; 
                           text-decoration: none; border-radius: 4px; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        This link will expire in {expiration_hours} hours for security reasons.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        This is an automated message from Millii. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        Password Reset Request
        
        Hello {recipient_name},
        
        We received a request to reset your password for your Millii account. Copy the link below and paste it in your browser:
        
        {reset_link}
        
        This link will expire in {expiration_hours} hours for security reasons.
        
        If you didn't request this password reset, please ignore this email and your password will remain unchanged.
        """

        return {
            "subject": "Password Reset Request - Millii",
            "html": html_content,
            "text": text_content,
        }

    @staticmethod
    def user_invitation_template(
        recipient_name: str, inviter_name: str, project_name: str, invitation_link: str
    ) -> Dict[str, str]:
        """Generate user invitation email template"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">You're Invited to Collaborate!</h2>
                    <p>Hi {recipient_name},</p>
                    <p><strong>{inviter_name}</strong> has invited you to collaborate on the project <strong>{project_name}</strong> in Millii.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Project:</strong> {project_name}</p>
                        <p style="margin: 10px 0 0 0;"><strong>Invited by:</strong> {inviter_name}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_link}" 
                           style="display: inline-block; padding: 12px 24px; 
                           background-color: #28a745; color: white; 
                           text-decoration: none; border-radius: 4px; font-weight: bold;">
                            Accept Invitation
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        This invitation will expire in 7 days. Click the button above to get started!
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        This is an automated message from Millii. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        You're Invited to Collaborate!
        
        Hi {recipient_name},
        
        {inviter_name} has invited you to collaborate on the project {project_name} in Millii.
        
        Project: {project_name}
        Invited by: {inviter_name}
        
        Accept the invitation: {invitation_link}
        
        This invitation will expire in 7 days.
        """

        return {
            "subject": f"Invitation to {project_name} - Millii",
            "html": html_content,
            "text": text_content,
        }

    @staticmethod
    def task_notification_template(
        recipient_name: str,
        task_title: str,
        task_description: str,
        due_date: str,
        task_link: str,
    ) -> Dict[str, str]:
        """Generate task notification email template"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">New Task Assigned</h2>
                    <p>Hi {recipient_name},</p>
                    <p>A new task has been assigned to you in Millii.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #007bff; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0; color: #2c3e50;">{task_title}</h3>
                        <p style="margin: 10px 0;">{task_description}</p>
                        <p style="margin: 10px 0 0 0; color: #666;">
                            <strong>Due Date:</strong> {due_date}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{task_link}" 
                           style="display: inline-block; padding: 12px 24px; 
                           background-color: #007bff; color: white; 
                           text-decoration: none; border-radius: 4px; font-weight: bold;">
                            View Task Details
                        </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        This is an automated message from Millii. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        New Task Assigned
        
        Hi {recipient_name},
        
        A new task has been assigned to you in Millii.
        
        Title: {task_title}
        Description: {task_description}
        Due Date: {due_date}
        
        View the task: {task_link}
        """

        return {
            "subject": f"Task Assigned: {task_title} - Millii",
            "html": html_content,
            "text": text_content,
        }

    @staticmethod
    def time_tracking_report_template(
        recipient_name: str, report_period: str, total_hours: float, report_link: str
    ) -> Dict[str, str]:
        """Generate time tracking report email template"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50;">Time Tracking Report</h2>
                    <p>Hi {recipient_name},</p>
                    <p>Your time tracking report for <strong>{report_period}</strong> is ready to view.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center;">
                        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Summary</h3>
                        <div style="font-size: 48px; color: #007bff; font-weight: bold; margin: 10px 0;">
                            {total_hours}
                        </div>
                        <p style="margin: 5px 0; font-size: 18px; color: #666;">Total Hours</p>
                        <p style="margin: 15px 0 0 0; color: #666;">
                            <strong>Period:</strong> {report_period}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{report_link}" 
                           style="display: inline-block; padding: 12px 24px; 
                           background-color: #007bff; color: white; 
                           text-decoration: none; border-radius: 4px; font-weight: bold;">
                            View Full Report
                        </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        This is an automated message from Millii. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        Time Tracking Report
        
        Hi {recipient_name},
        
        Your time tracking report for {report_period} is ready to view.
        
        Summary:
        Total Hours: {total_hours} hours
        Period: {report_period}
        
        View full report: {report_link}
        """

        return {
            "subject": f"Time Tracking Report - {report_period} - Millii",
            "html": html_content,
            "text": text_content,
        }

    @staticmethod
    def notification_email_template(
        recipient_name: str,
        notification_type: str,
        title: str,
        message: str,
        link: str = None,
        priority: str = "normal",
        sender_name: str = None,
        project_name: str = None,
        task_title: str = None,
    ) -> Dict[str, str]:
        """Generate notification email template with priority styling"""

        # Get notification-specific details
        details = EmailTemplate._get_notification_details(
            notification_type, priority, sender_name, project_name, task_title
        )

        # Priority-based styling
        priority_styles = EmailTemplate._get_priority_styles(priority)

        # Get app URL dynamically from environment
        from config import settings

        app_url = settings.frontend_url.rstrip("/")
        full_link = f"{app_url}{link}" if link and not link.startswith("http") else link

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    {priority_styles["banner"]}
                    
                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <div style="display: flex; align-items: center; margin-bottom: 15px;">
                            <div style="font-size: 24px; margin-right: 12px;">{details["icon"]}</div>
                            <h2 style="margin: 0; color: {priority_styles["title_color"]};">{title}</h2>
                            {priority_styles["badge"]}
                        </div>
                        
                        <p style="margin: 15px 0; font-size: 16px;">{message}</p>
                        
                        {details["metadata"]}
                    </div>
                    
                    {EmailTemplate._get_action_button_html(full_link, details["button_text"], priority_styles["button_color"]) if full_link else ""}
                    
                    <div style="margin: 30px 0; padding: 15px; background-color: #f1f3f4; border-radius: 6px;">
                        <p style="margin: 0; color: #666; font-size: 14px;">
                            💡 <strong>Quick Access:</strong> You can also view all your notifications in the app by clicking the bell icon in the top navigation.
                        </p>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <div style="text-align: center;">
                        <p style="color: #999; font-size: 12px; margin: 5px 0;">
                            This is an automated notification from Millii. Please do not reply to this email.
                        </p>
                        <p style="color: #999; font-size: 12px; margin: 5px 0;">
                            <a href="{app_url}" style="color: #667eea; text-decoration: none;">Visit Millii Dashboard</a>
                        </p>
                    </div>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        {details["icon"]} {title}
        
        Hi {recipient_name},
        
        {message}
        
        {details["text_metadata"]}
        
        {f"View in app: {full_link}" if full_link else ""}
        
        ---
        This is an automated notification from Millii.
        Dashboard: {app_url}
        """

        # Priority-based subject prefixes
        subject_prefix = "🚨 URGENT: " if priority == "urgent" else ""

        return {
            "subject": f"{subject_prefix}{title} - Millii",
            "html": html_content,
            "text": text_content,
        }

    @staticmethod
    def _get_notification_details(
        notification_type: str,
        priority: str,
        sender_name: str = None,
        project_name: str = None,
        task_title: str = None,
    ) -> Dict[str, str]:
        """Get notification-specific details like icons and metadata"""
        details = {
            "mention": {
                "icon": "💬",
                "button_text": "View Message",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>From:</strong> {sender_name}</p>'
                if sender_name
                else "",
                "text_metadata": f"From: {sender_name}" if sender_name else "",
            },
            "task_assigned": {
                "icon": "📋",
                "button_text": "View Task",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>Task:</strong> {task_title}<br><strong>Project:</strong> {project_name}</p>'
                if task_title
                else "",
                "text_metadata": f"Task: {task_title}\nProject: {project_name}"
                if task_title
                else "",
            },
            "task_approved": {
                "icon": "✅",
                "button_text": "View Task",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>Task:</strong> {task_title}</p>'
                if task_title
                else "",
                "text_metadata": f"Task: {task_title}" if task_title else "",
            },
            "task_rejected": {
                "icon": "❌",
                "button_text": "View Task",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>Task:</strong> {task_title}</p>'
                if task_title
                else "",
                "text_metadata": f"Task: {task_title}" if task_title else "",
            },
            "task_under_review": {
                "icon": "👀",
                "button_text": "Review Task",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>Task:</strong> {task_title}<br><strong>Project:</strong> {project_name}</p>'
                if task_title
                else "",
                "text_metadata": f"Task: {task_title}\nProject: {project_name}"
                if task_title
                else "",
            },
            "project_completed": {
                "icon": "🎉",
                "button_text": "View Project",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>Project:</strong> {project_name}</p>'
                if project_name
                else "",
                "text_metadata": f"Project: {project_name}" if project_name else "",
            },
            "project_created": {
                "icon": "📁",
                "button_text": "View Project",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>Project:</strong> {project_name}</p>'
                if project_name
                else "",
                "text_metadata": f"Project: {project_name}" if project_name else "",
            },
            "new_message": {
                "icon": "📥",
                "button_text": "View Message",
                "metadata": f'<p style="margin: 10px 0; color: #666;"><strong>From:</strong> {sender_name}</p>'
                if sender_name
                else "",
                "text_metadata": f"From: {sender_name}" if sender_name else "",
            },
        }

        return details.get(
            notification_type,
            {"icon": "📢", "button_text": "View", "metadata": "", "text_metadata": ""},
        )

    @staticmethod
    def _get_priority_styles(priority: str) -> Dict[str, str]:
        """Get priority-specific styling elements"""
        if priority == "urgent":
            return {
                "banner": '<div style="background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%); color: white; padding: 12px 20px; border-radius: 6px 6px 0 0; text-align: center; font-weight: bold; font-size: 14px; letter-spacing: 0.5px;">🚨 URGENT NOTIFICATION</div>',
                "title_color": "#ff4757",
                "button_color": "#ff4757",
                "badge": '<span style="background-color: #ff4757; color: white; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-left: 10px;">URGENT</span>',
            }
        else:
            return {
                "banner": "",
                "title_color": "#2c3e50",
                "button_color": "#667eea",
                "badge": "",
            }

    @staticmethod
    def _get_action_button_html(link: str, button_text: str, button_color: str) -> str:
        """Generate action button HTML"""
        return f"""
        <div style="text-align: center; margin: 25px 0;">
            <a href="{link}" 
               style="display: inline-block; padding: 14px 28px; 
               background-color: {button_color}; color: white; 
               text-decoration: none; border-radius: 6px; font-weight: bold;
               box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                {button_text}
            </a>
        </div>
        """

    @staticmethod
    def team_member_welcome_template(
        recipient_name: str,
        email: str,
        password: str,
        login_link: str,
        inviter_name: str = "Admin",
    ) -> Dict[str, str]:
        """Generate team member welcome email with credentials"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #667eea; margin: 0;">Welcome to Millii!</h1>
                        <p style="color: #666; font-size: 14px; margin-top: 5px;">Your Project Management Platform</p>
                    </div>
                    
                    <p>Hi {recipient_name},</p>
                    <p><strong>{inviter_name}</strong> has added you as a team member to Millii. We're excited to have you on board!</p>
                    
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                padding: 25px; border-radius: 10px; color: white; margin: 25px 0;">
                        <h3 style="margin-top: 0; color: white;">Your Login Credentials</h3>
                        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p style="margin: 5px 0;"><strong>Email:</strong> {email}</p>
                            <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 16px;">{password}</code></p>
                        </div>
                        <p style="font-size: 13px; margin-bottom: 0; opacity: 0.9;">
                            ⚠️ For security, please change your password after your first login.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{login_link}" 
                           style="display: inline-block; padding: 16px 40px; 
                           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; text-decoration: none; border-radius: 8px; 
                           font-weight: bold; font-size: 16px;
                           box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                            Login to Millii →
                        </a>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h4 style="margin-top: 0; color: #2c3e50;">Getting Started</h4>
                        <ol style="margin: 10px 0; padding-left: 20px; color: #555;">
                            <li style="margin: 8px 0;">Click the "Login to Millii" button above</li>
                            <li style="margin: 8px 0;">Enter your email and password</li>
                            <li style="margin: 8px 0;">Update your password in Settings</li>
                            <li style="margin: 8px 0;">Start collaborating with your team!</li>
                        </ol>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                        If you have any questions or need help getting started, feel free to reach out to your team admin.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated message from Millii. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """

        text_content = f"""
        Welcome to Millii!
        
        Hi {recipient_name},
        
        {inviter_name} has added you as a team member to Millii. We're excited to have you on board!
        
        YOUR LOGIN CREDENTIALS:
        
        Email: {email}
        Password: {password}
        
        ⚠️ For security, please change your password after your first login.
        
        LOGIN HERE:
        {login_link}
        
        GETTING STARTED:
        
        1. Click the login link above or copy and paste it in your browser
        2. Enter your email and password
        3. Update your password in Settings
        4. Start collaborating with your team!
        
        If you have any questions or need help getting started, feel free to reach out to your team admin.
        
        ---
        This is an automated message from Millii. Please do not reply to this email.
        """

        return {
            "subject": f"Welcome to Millii - Your Account is Ready!",
            "html": html_content,
            "text": text_content,
        }
