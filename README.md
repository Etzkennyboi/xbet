# XBounty: Autonomous Bounty Verification Agent

XBounty is a decentralized bounty platform where an AI agent autonomously verifies on-chain tasks on X Layer and triggers instant payouts.

## 🚀 Quick Start (Development)

1.  **Backend SETUP**:
    ```bash
    npm install
    # Create a .env file based on the environment variables needed
    npm start
    ```

2.  **Frontend SETUP**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 🏗️ Deployment: Single-Endpoint (Recommended)
This project is now configured for a **Unified Deployment**. Your backend will build and serve your frontend from a single server. This avoids CORS issues and keeps everything on one URL.

### One-Click Deploy (Render / Railway / Fly.io)
1.  **Connect your GitHub repo**.
2.  **Build Command**: `npm run build`
3.  **Start Command**: `npm start`
4.  **Add Environment Variables**:
    *   `PORT`: `3001`
    *   (All other variables from your `.env`)

### Docker Deployment (Enterprise)
If you have Docker, simply run:
```bash
docker build -t xbounty .
docker run -p 3001:3001 --env-file .env xbounty
```

## 🔐 Environment Variables
Ensure the following are set in your production environment:
- `OKX_API_KEY`: Your OKX API Key
- `OKX_SECRET_KEY`: Your OKX Secret Key
- `OKX_PASSPHRASE`: Your OKX Passphrase
- `AGENT_WALLET_ADDRESS`: Your agent's payout wallet
- `DEEPSEEK_API_KEY`: For AI verification
- `DEEPSEEK_BASE_URL`: (Optional) Custom endpoint
- `VITE_API_URL`: (Frontend only) Your backend API URL

## 📂 Project Structure
- `/src`: Backend Express server and AI logic.
- `/frontend`: Vite + React frontend application.
- `package.json`: Root package manages backend and build scripts.
