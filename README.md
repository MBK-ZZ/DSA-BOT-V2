# DSA Bot V2

Discord bot for DSA server: DM notifications, tickets, support waiting room, and more.

## Deploy on Railway

1. Push this repo to GitHub.
2. In [Railway](https://railway.app), create a new project → **Deploy from GitHub** → select `DSA-BOT-V2`.
3. Add these **Environment Variables** in Railway:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `TICKET_CATEGORY_ID` | For tickets | Category where ticket channels are created |
| `TICKET_PANEL_CHANNEL_ID` | For tickets | Channel for ticket panel |
| `STAFF_ROLE_IDS` | For tickets | Comma-separated staff role IDs |
| `TICKET_LOGS_CHANNEL_ID` | No | Channel for closed ticket logs |

4. Railway will run `npm start` automatically.

## Discord Developer Portal

Enable these **Privileged Gateway Intents** for the bot:

- Message Content Intent
- Server Members Intent

## Local run

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

**Do not commit `.env`** — it contains your bot token.
