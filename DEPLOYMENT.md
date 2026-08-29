# Farmer Marketplace Deployment Guide

This guide details how to set up, configure, and deploy the Farmer Marketplace to a staging or production environment.

## 1. System Requirements
- **Node.js**: v18.x or v20.x
- **Database**: PostgreSQL (e.g., Supabase, RDS, local)
- **External Services**: Razorpay Account (Test Mode enabled for staging)

---

## 2. Environment Variables

### Backend (`backend/.env`)
Copy the `backend/.env.example` file to `backend/.env` and configure:

```env
# Server Configuration
PORT=5000
NODE_ENV=production # Use 'development' for local

# Database
DATABASE_URL="postgresql://user:password@host:port/dbname?schema=public"

# Security
JWT_SECRET="your_strong_random_secret_string"
ALLOWED_ORIGINS="https://your-frontend-domain.com,http://localhost:3000"

# Razorpay Test Credentials (Test Mode)
RAZORPAY_KEY_ID="rzp_test_YOUR_KEY"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
RAZORPAY_WEBHOOK_SECRET="your_custom_webhook_secret"
```

### Frontend (`frontend/.env.local`)
Copy the `frontend/.env.example` file to `frontend/.env.local` and configure:

```env
# Point to your backend URL (no trailing slash)
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api

# Must match your backend RAZORPAY_KEY_ID
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY
```

---

## 3. Database & Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Initialize Database Schema**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   # Or npx prisma db push if no migrations are strictly maintained yet
   ```

3. **Start the Backend**
   ```bash
   npm run build
   npm start
   ```
   *Note: In production, it's recommended to use PM2 or a Docker container to manage the Node.js process.*

4. **Verify Health**
   Visit `https://your-backend-domain.com/api/health` and `https://your-backend-domain.com/api/ready`. Both should return a 200 OK status.

---

## 4. Frontend Setup

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

---

## 5. Razorpay & Webhook Configuration (Crucial)

To ensure the payment lifecycle works (Inventory reservation -> Capture -> Order Success), the backend must receive webhooks from Razorpay.

### In the Razorpay Dashboard:
1. Ensure you are in **Test Mode**.
2. Navigate to Settings -> Webhooks.
3. Click **Add New Webhook**.
4. **Webhook URL**: `https://your-backend-domain.com/api/webhooks/razorpay`
   *(If testing locally, use a service like `ngrok` to expose your local port 5000 to the internet).*
5. **Secret**: Enter the exact string you used for `RAZORPAY_WEBHOOK_SECRET` in your backend `.env`.
6. **Active Events**: Select the following events:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`

---

## 6. Security & CORS Notes

### HttpOnly Cookies
The authentication system relies on HttpOnly cookies. For this to work in production:
1. The frontend and backend must ideally share the same top-level domain (e.g., `api.example.com` and `www.example.com`).
2. If they are on completely different domains, you must ensure the backend sets `SameSite=None; Secure` on the cookies.
3. The `ALLOWED_ORIGINS` environment variable in the backend must *exactly* match the frontend's origin (including `https://`). `Access-Control-Allow-Origin: *` is **prohibited** when credentials are in use.

### Reverse Proxy (Nginx / Cloudflare)
Ensure your reverse proxy forwards the `X-Forwarded-For` and `X-Forwarded-Proto` headers so the Express backend knows whether the connection is secure.

---

## 7. Production Deployment Checklist

- [ ] Database credentials are secure and NOT pushed to Git.
- [ ] `JWT_SECRET` is uniquely generated and long.
- [ ] `ALLOWED_ORIGINS` strictly contains only your production frontend URLs.
- [ ] `NODE_ENV` is set to `production` on both backend and frontend.
- [ ] Razorpay Webhook is properly configured in the Razorpay dashboard.
- [ ] `SameSite` and `Secure` cookie settings are properly aligned with your domain strategy.
- [ ] Rate limiters (built into the backend) are functioning without locking out legitimate traffic.
- [ ] Both `/api/health` and `/api/ready` endpoints return 200 OK.
