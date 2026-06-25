# DSA-BOT-V2

Discord bot for DSA server: DM notifications, ticket system, and support waiting room welcome.

## Deploy on Railway

1. Push this repo to GitHub.
2. In [Railway](https://railway.app), create a new project → **Deploy from GitHub repo** → select `DSA-BOT-V2`.
3. Add these **Variables** in Railway:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `TICKET_CATEGORY_ID` | Yes | Category where ticket channels are created |
| `TICKET_PANEL_CHANNEL_ID` | Yes | Channel for the ticket panel |
| `STAFF_ROLE_IDS` | Yes | Comma-separated staff role IDs |
| `TICKET_LOGS_CHANNEL_ID` | No | Channel for closed ticket logs |

4. Railway runs `npm start` automatically.

## Discord Developer Portal

Enable these **Privileged Gateway Intents**:

- Message Content Intent
- Server Members Intent

## Local run

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

## Commands

- `/ticketpanel` — post ticket panel (admin only)

## Notes

- Do **not** commit `.env` (token stays in Railway Variables only).
- Ticket counter is stored in `tickets-data.json` locally; on Railway it resets if the service redeploys unless you add persistent storage.
