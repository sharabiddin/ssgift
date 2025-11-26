# GitHub Actions Deployment

This project uses GitHub Actions for automatic deployment to VPS.

## Setup Instructions

1. **Add GitHub Secrets:**
   Go to your repository Settings > Secrets and variables > Actions, and add:
   - `VPS_HOST`: Your VPS IP address
   - `VPS_USERNAME`: Your VPS username
   - `VPS_PASSWORD`: Your VPS password
   - `BOT_TOKEN`: Your Telegram bot token

2. **Deploy:**
   - Push to main branch for automatic deployment
   - Or manually trigger deployment from Actions tab

3. **VPS Requirements:**
   - Docker and docker-compose installed
   - SSH access enabled

## Manual Deployment (if needed)

If you prefer manual deployment, you can copy the entire project to your VPS and run:

```bash
# On your VPS
cd ~/secret-santa-bot
echo "BOT_TOKEN=your_bot_token_here" > .env
docker-compose up --build -d
```