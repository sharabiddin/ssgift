# Secret Santa Telegram Bot 🎅

A Telegram bot for organizing Secret Santa gift exchanges in group chats and private conversations.

## Features

- **Create Games** (`/create`): Generate unique game IDs for Secret Santa events
- **Join Games** (`/join`): Participants can join using game IDs and set display names
- **Complete Games** (`/complete`): Game owners can generate and distribute Secret Santa assignments
- **Anonymous Chat** (`/chat`): Send messages to your Secret Santa partner anonymously
- **Inbox System** (`/inbox`): View all your Secret Santa conversations
- **Participant Management** (`/santas`): Check how many participants have joined your games
- **Private Assignments**: Each participant receives their assignment privately
- **Persistent Storage**: SQLite database survives bot restarts
- **Validation**: Prevents duplicate joins, requires minimum 3 participants

## Commands

- `/start` - Welcome message and bot introduction
- `/help` - Show available commands and usage instructions
- `/create` - Create a new Secret Santa game (returns game ID)
- `/join` - Join an existing game with game ID and set display name
- `/complete` - Complete the game and send assignments (game owner only)
- `/santas` - Check participants in your games
- `/chat` - Send anonymous messages to your Secret Santa partner
- `/inbox` - View all your Secret Santa conversations

## Quick Start

1. **Get a Bot Token:**
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Create a new bot with `/newbot`
   - Copy the bot token

2. **Set Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your bot token
   ```

3. **Run with Docker:**
   ```bash
   docker-compose up --build -d
   ```

## Development

```bash
# Install dependencies
npm install

# Set up database
node scripts/init-db.js

# Start bot
npm start
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Actions deployment instructions.

## Game Flow

1. **Game Owner** runs `/create` → Gets game ID
2. **Participants** run `/join` → Enter game ID and display name
3. **Game Owner** runs `/complete` → Bot generates assignments and sends private messages
4. **Everyone** receives their Secret Santa assignment privately
5. **Participants** can use `/chat` to communicate anonymously with their Secret Santa partner
6. **Use** `/inbox` to view all conversations and `/santas` to check game participants

## Requirements

- Node.js 18+
- Docker & Docker Compose (for deployment)
- Telegram Bot Token

## License

MIT