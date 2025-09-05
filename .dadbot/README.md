# Dadbot Discord Bot

This worker handles slash commands for the HellDads Discord server.

## Commands

The bot currently implements the following slash commands:

- `/help` – Display an overview of commands and useful channels.
- `/highscores` – Display highscores of all HellDads who shared their results. Use `user` to view a specific player's stats.
- `/modhelp` – Open a private support channel and ping the mods.
- `/quote` – Get a democratic Helldivers quote.
- `/stats` – Display community statistics gathered from HellDads services with formatted numbers.
- `/update` – Update your game statistics for the highscores.
- `/event` – Display the current event and statistics.
- `/submit` – Submit your mission results for the current community event.

## Events

1. Once per day the bot posts a quote of the day into the main channel
   ([`src/events/daily-quote.js`](src/events/daily-quote.js)).
2. Once per week it also posts community statistics into the main channel
   ([`src/events/weekly-stats.js`](src/events/weekly-stats.js)).

## Environment Variables

The following environment variables must be provided:

- `DISCORD_APPLICATION_ID` – Application ID of the Discord bot.
- `DISCORD_GUILD_ID` – Guild ID where commands will be registered.
- `DISCORD_MODS_ROLE_ID` – ID of the Mods role to grant access to new support channels.
- `DISCORD_PUBLIC_KEY` – Public key for verifying requests.
- `DISCORD_MAIN_CHANNEL_ID` – Channel ID where scheduled updates are posted.
- `DISCORD_SUPPORT_CATEGORY_ID` – ID of the category where support channels or threads will be created.
- `DISCORD_TOKEN` – Bot token used for authentication.
- `HELLDADS_STATS_URL` – URL to the JSON with community stats.

See `.env.example` and `.dev.vars.example` for example values.

## Database Setup

This project uses a Cloudflare D1 database called `helldads-statistics`. After creating the binding in `wrangler.jsonc`, run the migrations to set up the schema:

```bash
npx wrangler d1 migrations apply helldads-statistics
```

This command applies all SQL migrations and creates the `submission` table used by the `/submit` and `/update` command.

It also creates the `highscore` table which stores one record per user and is
automatically updated when a new submission is stored.

## Development

Install dependencies with `npm install` and run a local worker using:

```bash
npm run dev
```

Before testing commands on Discord, you need to register them:

```bash
npm run register-commands
```

Tests are executed automatically before deployment via the `predeploy` script.
Run automated tests with:

```bash
npm test
```


Trigger local schedule handler (cronjob) when dev is running

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```
