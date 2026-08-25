# 🌐 Custom Domain Setup Guide for app.millii.ai

## Complete Step-by-Step Instructions

Follow these steps to connect your custom domain `app.millii.ai` to your Emergent deployment.

---

## PART 1: Connect Domain in Emergent Platform

### Step 1: Access Deployments
1. Go to Emergent platform: https://emergentagent.com
2. Navigate to **Deployments** section
3. Find your deployment: `trackfix-deploy`

### Step 2: Link Your Domain
1. In the deployment, find the **"Custom Domain"** section
2. Click **"Link Domain"** button
3. Enter your domain: `app.millii.ai`
4. Click **"Next"**

### Step 3: Get DNS Configuration
Emergent will show you the DNS records you need to add. It will look like:

```
Type: A Record
Host: app
Value: [IP ADDRESS PROVIDED BY EMERGENT]
TTL: 300 (or default)
```

**IMPORTANT:** Copy or screenshot the IP address shown. You'll need it in the next step.

---

## PART 2: Configure DNS Records

### Step 4: Go to Your DNS Provider
You need to access the DNS settings for `millii.ai`:
- If using **GoDaddy**: Go to Domains → DNS
- If using **Namecheap**: Go to Domain List → Manage → Advanced DNS
- If using **Cloudflare**: Go to DNS → Records
- If using another provider: Find DNS Management section

### Step 5: Add A Record
1. Click **"Add Record"** or **"Add"**
2. Fill in these details:
   - **Type:** A
   - **Host/Name:** app
   - **Value/Points to:** [IP ADDRESS FROM EMERGENT]
   - **TTL:** 300 (or leave default)
   
3. **If using Cloudflare:**
   - Set Proxy Status to **"DNS only"** (gray cloud icon, NOT orange)
   - This is CRITICAL for proper routing

4. Click **"Save"** or **"Add Record"**

### Example Configurations:

**GoDaddy:**
```
Type: A
Name: app
Value: [IP from Emergent]
TTL: 1 Hour
```

**Namecheap:**
```
Type: A Record
Host: app
Value: [IP from Emergent]
TTL: Automatic
```

**Cloudflare:**
```
Type: A
Name: app
IPv4 address: [IP from Emergent]
Proxy status: DNS only (gray cloud)
TTL: Auto
```

---

## PART 3: Verify & Complete Setup

### Step 6: Wait for DNS Propagation
- **Minimum:** 5-15 minutes
- **Maximum:** 24 hours (rare)
- **Typical:** 15-30 minutes

### Step 7: Verify in Emergent
1. Go back to Emergent platform
2. In the Custom Domain section, click **"Check Status"**
3. Wait for green **"Verified"** status
4. Once verified, your domain is live!

### Step 8: Test Your Domain
Open a new browser tab (incognito mode recommended):
1. Go to: https://app.millii.ai
2. You should see your login page
3. Try logging in
4. Verify all features work

---

## PART 4: Verification Commands

### Check DNS Propagation
```bash
# Check if DNS is configured
nslookup app.millii.ai

# Should show the IP address from Emergent
```

### Test API Connectivity
```bash
# Test backend API
curl https://app.millii.ai/api/auth/me

# Should return authentication error (expected without token)
# NOT 404 Not Found
```

---

## ✅ SUCCESS CRITERIA

Your custom domain is working correctly when:
- [ ] `https://app.millii.ai` loads the login page
- [ ] Login works without errors
- [ ] Dashboard loads after login
- [ ] API calls in Network tab show: `app.millii.ai/api/*`
- [ ] No CORS errors in console
- [ ] All features work (projects, tasks, chat, etc.)

---

## 🔧 TROUBLESHOOTING

### Issue: "This site can't be reached"
**Solution:**
- DNS not propagated yet (wait 15-30 minutes)
- Check DNS record is correct: `nslookup app.millii.ai`
- Verify A record points to correct IP

### Issue: "Not Secure" or SSL Error
**Solution:**
- Wait for SSL certificate to be provisioned (5-10 minutes after DNS)
- Emergent automatically provisions SSL certificates
- If after 30 minutes, contact Emergent support

### Issue: Login page loads but API calls fail (404)
**Solution:**
- This was your original issue
- Should be fixed once domain is properly connected in Emergent
- Emergent automatically configures /api/* routing

### Issue: CORS errors in console
**Solution:**
- Already fixed! Your CORS_ORIGINS includes app.millii.ai
- Clear browser cache (Ctrl+Shift+Delete)
- Try in incognito mode

---

## 📋 CHECKLIST

### Before Starting:
- [ ] You own the domain millii.ai
- [ ] You have access to DNS settings
- [ ] You know which DNS provider you use

### During Setup:
- [ ] Linked domain in Emergent platform
- [ ] Copied IP address from Emergent
- [ ] Added A record to DNS provider
- [ ] Saved DNS changes

### After Setup:
- [ ] Waited 15-30 minutes for DNS propagation
- [ ] Verified domain status in Emergent (green checkmark)
- [ ] Tested https://app.millii.ai loads
- [ ] Tested login works
- [ ] Cleared browser cache

---

## 🎯 WHAT EMERGENT HANDLES AUTOMATICALLY

When you connect your custom domain, Emergent automatically:
- ✅ Provisions SSL certificate (HTTPS)
- ✅ Configures ingress routing
- ✅ Routes `/api/*` to backend (port 8001)
- ✅ Routes `/` to frontend (port 3000)
- ✅ Enables WebSocket connections
- ✅ Handles load balancing

**You don't need to configure any of this manually!**

---

## 📞 NEED HELP?

### If DNS isn't propagating:
1. Check DNS record is correct
2. Wait full 24 hours (rare but possible)
3. Try different device/network
4. Check with: https://dnschecker.org/

### If domain connects but API doesn't work:
1. Contact Emergent support
2. Mention: "API routing not working for custom domain"
3. They'll check ingress configuration

### If SSL certificate doesn't provision:
1. Wait 30 minutes after DNS verification
2. Check domain is verified in Emergent
3. Contact Emergent support if still not working

---

## 🚀 FINAL STEPS AFTER DOMAIN IS LIVE

Once your domain is working:

### 1. Update Any External Services
If you're using GoHighLevel or other integrations:
- Reconnect GHL integration (webhook URL will update)
- Update any external links pointing to your app
- Update any API keys stored with old domain

### 2. Inform Your Team
- Share new URL: https://app.millii.ai
- Old URL will still work: trackfix-deploy.preview.emergentagent.com
- Both domains are supported

### 3. Monitor for 24 Hours
- Check backend logs: `tail -f /var/log/supervisor/backend.*.log`
- Monitor error rates
- Verify all features working

---

## 📊 EXPECTED TIMELINE

| Step | Duration |
|------|----------|
| Link domain in Emergent | 2 minutes |
| Add DNS record | 5 minutes |
| DNS propagation | 15-30 minutes (up to 24 hours) |
| Domain verification | 1-2 minutes after DNS |
| SSL provisioning | 5-10 minutes after verification |
| **Total** | **30-60 minutes typically** |

---

## ✨ SUMMARY

1. **Link domain** in Emergent platform
2. **Add A record** to your DNS provider
3. **Wait** for DNS to propagate (15-30 min)
4. **Verify** in Emergent platform
5. **Test** https://app.millii.ai

**Your application is already configured for app.millii.ai!** 
Once DNS propagates, everything will work automatically.

---

## 🆘 EMERGENCY CONTACT

If you encounter issues during setup:
- **Emergent Support:** support@emergentagent.com
- **Documentation:** https://atlas-kb.com/atlas-e74243keac/articles/708702-deployments-and-custom-domains

Good luck with your domain setup! 🎉
