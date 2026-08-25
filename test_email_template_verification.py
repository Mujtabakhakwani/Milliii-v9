#!/usr/bin/env python3
"""
Email Template Content Verification
Directly tests the email template to verify all required elements
"""

import sys
sys.path.append('/app/backend')

from services.email_templates import EmailTemplate

def test_team_member_welcome_template():
    """Test the team member welcome email template"""
    print("\n" + "="*80)
    print("EMAIL TEMPLATE CONTENT VERIFICATION")
    print("="*80)
    
    # Generate template
    template = EmailTemplate.team_member_welcome_template(
        recipient_name="John Doe",
        email="john.doe@example.com",
        password="SecurePass123",
        login_link="https://project-scanner-10.preview.emergentagent.com/login",
        inviter_name="Admin User"
    )
    
    html_content = template['html']
    text_content = template['text']
    subject = template['subject']
    
    print("\n📧 EMAIL SUBJECT:")
    print(f"   {subject}")
    
    # Verify required elements in HTML
    print("\n✅ HTML TEMPLATE VERIFICATION:")
    
    checks = {
        "Welcome to Millii branding": "Welcome to Millii!" in html_content,
        "Millii branding subtitle": "Your Project Management Platform" in html_content,
        "Recipient name": "John Doe" in html_content,
        "Inviter name": "Admin User" in html_content,
        "Email credentials": "john.doe@example.com" in html_content,
        "Password credentials": "SecurePass123" in html_content,
        "Login link": "https://project-scanner-10.preview.emergentagent.com/login" in html_content,
        "Login button": "Login to Millii" in html_content,
        "Getting Started section": "Getting Started" in html_content,
        "Security note": "For security, please change your password" in html_content,
        "Step 1 instruction": "Click the" in html_content and "button" in html_content,
        "Step 2 instruction": "Enter your email and password" in html_content,
        "Step 3 instruction": "Update your password in Settings" in html_content,
        "Step 4 instruction": "Start collaborating with your team" in html_content,
        "Gradient styling": "linear-gradient" in html_content,
        "Credentials box": "Your Login Credentials" in html_content
    }
    
    for check_name, result in checks.items():
        status = "✅" if result else "❌"
        print(f"   {status} {check_name}")
    
    # Verify required elements in TEXT
    print("\n✅ TEXT TEMPLATE VERIFICATION:")
    
    text_checks = {
        "Welcome message": "Welcome to Millii!" in text_content,
        "Recipient name": "John Doe" in text_content,
        "Inviter name": "Admin User" in text_content,
        "Email credentials": "john.doe@example.com" in text_content,
        "Password credentials": "SecurePass123" in text_content,
        "Login link": "https://project-scanner-10.preview.emergentagent.com/login" in text_content,
        "Getting Started section": "GETTING STARTED:" in text_content,
        "Security note": "For security, please change your password" in text_content,
        "Instructions present": "1." in text_content and "2." in text_content and "3." in text_content and "4." in text_content
    }
    
    for check_name, result in text_checks.items():
        status = "✅" if result else "❌"
        print(f"   {status} {check_name}")
    
    # Summary
    all_html_passed = all(checks.values())
    all_text_passed = all(text_checks.values())
    
    print("\n" + "="*80)
    print("TEMPLATE VERIFICATION SUMMARY")
    print("="*80)
    print(f"HTML Template: {'✅ ALL CHECKS PASSED' if all_html_passed else '❌ SOME CHECKS FAILED'}")
    print(f"Text Template: {'✅ ALL CHECKS PASSED' if all_text_passed else '❌ SOME CHECKS FAILED'}")
    print(f"Overall: {'✅ TEMPLATE VERIFIED' if all_html_passed and all_text_passed else '❌ TEMPLATE HAS ISSUES'}")
    print("="*80)
    
    # Print sample of HTML (first 500 chars)
    print("\n📄 HTML TEMPLATE SAMPLE (first 500 chars):")
    print(html_content[:500] + "...")
    
    # Print sample of TEXT (first 500 chars)
    print("\n📄 TEXT TEMPLATE SAMPLE (first 500 chars):")
    print(text_content[:500] + "...")
    
    return all_html_passed and all_text_passed

if __name__ == "__main__":
    success = test_team_member_welcome_template()
    sys.exit(0 if success else 1)
