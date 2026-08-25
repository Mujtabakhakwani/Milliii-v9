# 🚀 Deployment Checklist for app.millii.ai

## Pre-Deployment Verification ✅

- [x] All hardcoded URLs removed from codebase
- [x] Environment variables configured for app.millii.ai
- [x] Backend .env: FRONTEND_URL = https://app.millii.ai
- [x] Frontend .env: REACT_APP_BACKEND_URL = https://app.millii.ai/api
- [x] CORS configured for app.millii.ai
- [x] JWT_SECRET set (no fallback)
- [x] ENCRYPTION_KEY set (no fallback)
- [x] All URL generation uses get_frontend_url() helper
- [x] Comprehensive testing completed (Backend 94.4%, Frontend 100%)
- [x] Deployment health check passed
- [x] Chat file attachments working

---

## Deployment Steps

### Step 1: Deploy Application
1. Deploy your application to your hosting platform
2. Ensure MongoDB is accessible (connection string in MONGO_URL)
3. Verify all environment variables are set correctly

### Step 2: Configure DNS
1. Point `app.millii.ai` to your server IP address
2. Wait for DNS propagation (can take up to 48 hours, usually 15-30 minutes)
3. Test DNS: `nslookup app.millii.ai`

### Step 3: SSL Certificate
1. Ensure SSL certificate is installed for app.millii.ai
2. Verify HTTPS is working: `curl https://app.millii.ai`
3. Check for mixed content warnings

### Step 4: Verify Services
```bash
# Check all services are running
sudo supervisorctl status

# Restart all services to ensure environment variables are loaded
sudo supervisorctl restart all

# Check backend logs
tail -f /var/log/supervisor/backend.*.log

# Check frontend logs
tail -f /var/log/supervisor/frontend.*.log
```

### Step 5: Test Application
Visit: https://app.millii.ai

#### Quick Smoke Tests:
- [ ] Application loads without errors
- [ ] Login page displays correctly
- [ ] Can login with test credentials
- [ ] Dashboard loads with data
- [ ] API calls go to app.millii.ai/api/* (check Network tab)
- [ ] WebSocket connects (check Console for connection logs)

---

## Post-Deployment Testing Checklist

### Critical Features
- [ ] **Login/Logout** - Users can authenticate
- [ ] **Dashboard** - Displays correctly with stats
- [ ] **Projects** - Can create, view, edit projects
- [ ] **Tasks** - Can create, update, complete tasks
- [ ] **TimeSheet** - Displays time entries correctly
- [ ] **Chat** - Messages send/receive in real-time
- [ ] **File Upload** - Can attach files in chat
- [ ] **Team Members** - List displays correctly

### Link Generation Tests
- [ ] **Guest Invite Links** - Format: https://app.millii.ai/guest-invite/{token}
  - Create a project
  - Generate guest link
  - Copy and open in incognito window
  - Verify link works

- [ ] **Email Links** - All email links point to app.millii.ai
  - Trigger password reset
  - Check email contains: https://app.millii.ai/reset-password?token=...
  - Click link and verify it works

- [ ] **GHL Webhook** - Format: https://app.millii.ai/api/webhooks/ghl/opportunity
  - Go to Integrations → GoHighLevel
  - Verify webhook URL displays correctly
  - Test webhook by creating opportunity in GHL

### API Connectivity Tests
Open browser DevTools → Network tab:
- [ ] All API calls go to https://app.millii.ai/api/*
- [ ] No calls to trackfix-deploy or localhost
- [ ] WebSocket connects to wss://app.millii.ai/api/ws
- [ ] All requests return 200 OK (except expected errors)

### Integration Tests
- [ ] **GoHighLevel Integration**
  - Webhook URL: https://app.millii.ai/api/webhooks/ghl/opportunity
  - Reconnect integration if needed
  - Test by creating test opportunity

- [ ] **Email Notifications**
  - Test welcome email (invite new user)
  - Test password reset email
  - Test task notification email
  - Verify all links point to app.millii.ai

- [ ] **Google OAuth**
  - Test Google sign-in
  - Verify redirect back to: https://app.millii.ai/dashboard

---

## Troubleshooting

### Issue: Can't access app.millii.ai
**Solution:**
1. Check DNS: `nslookup app.millii.ai`
2. Check server is running: `curl http://YOUR_SERVER_IP`
3. Check SSL certificate is valid
4. Check firewall allows ports 80/443

### Issue: API calls failing
**Solution:**
1. Check REACT_APP_BACKEND_URL in frontend/.env
2. Verify CORS_ORIGINS in backend/.env includes app.millii.ai
3. Check backend is running: `sudo supervisorctl status backend`
4. Check backend logs: `tail -f /var/log/supervisor/backend.*.log`

### Issue: Guest links not working
**Solution:**
1. Check FRONTEND_URL in backend/.env is set to https://app.millii.ai
2. Restart backend: `sudo supervisorctl restart backend`
3. Generate a new guest link
4. Test in incognito window

### Issue: Email links point to wrong domain
**Solution:**
1. Check FRONTEND_URL in backend/.env
2. Restart backend: `sudo supervisorctl restart backend`
3. Test by sending a new email notification

### Issue: WebSocket not connecting
**Solution:**
1. Check WebSocket URL in browser console
2. Should be: wss://app.millii.ai/api/ws
3. Check if server supports WebSocket connections
4. Check firewall/load balancer WebSocket configuration

---

## Environment Variables Reference

### Backend (.env)
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="https://app.millii.ai"
JWT_SECRET="your-secure-jwt-secret"
ENCRYPTION_KEY="your-encryption-key"
FRONTEND_URL="https://app.millii.ai"
GHL_API_KEY="your-ghl-api-key"
GHL_SUB_ACCOUNT_ID="your-ghl-subaccount-id"
EMERGENT_LLM_KEY="your-llm-key"
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=https://app.millii.ai/api
REACT_APP_AUTH_URL=https://auth.emergentagent.com
WDS_SOCKET_PORT=443
```

---

## Success Metrics

Your deployment is successful when:
- ✅ Application accessible at https://app.millii.ai
- ✅ All API calls go to app.millii.ai/api/*
- ✅ Guest links use app.millii.ai domain
- ✅ Email links use app.millii.ai domain
- ✅ GHL webhook uses app.millii.ai domain
- ✅ Real-time chat working (WebSocket connected)
- ✅ All features functional (login, projects, tasks, chat)
- ✅ No console errors
- ✅ No mixed content warnings

---

## Support

If you encounter any issues during deployment:

1. **Check Logs:**
   ```bash
   tail -f /var/log/supervisor/backend.*.log
   tail -f /var/log/supervisor/frontend.*.log
   ```

2. **Check Service Status:**
   ```bash
   sudo supervisorctl status
   ```

3. **Restart Services:**
   ```bash
   sudo supervisorctl restart all
   ```

4. **Verify Configuration:**
   - Check .env files have correct values
   - Verify DNS is pointing to correct server
   - Check SSL certificate is valid

---

## Rollback Plan

If critical issues occur after deployment:

1. **Immediate:**
   - Point DNS back to old server (if applicable)
   - Takes 15-30 minutes for propagation

2. **Revert Configuration:**
   - Restore previous .env files
   - Restart services: `sudo supervisorctl restart all`

3. **Database:**
   - If needed, restore MongoDB backup
   - Backup command: `mongodump --uri="$MONGO_URL" --db=$DB_NAME`

---

## Post-Launch Monitoring

Monitor these for first 24 hours:
- [ ] Server CPU/Memory usage
- [ ] MongoDB connections
- [ ] API response times
- [ ] Error rates in logs
- [ ] User login success rate
- [ ] WebSocket connection stability

---

## Deployment Complete! 🎉

Once all checkboxes are complete, your Millii application is successfully deployed to **app.millii.ai** and all links are working correctly!

**Next:** Share the link with your team and start using the application!
