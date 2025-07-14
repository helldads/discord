# Dadbot Discord Bot

This worker handles slash commands for the Helldads Discord server.

## Commands

The bot currently implements the following slash commands:

- `/help` – Display an overview of commands and useful channels.
- `/highscores` – Display highscores of all HellDads who /submit their results. Use `user` to view a specific player's stats.
- `/modhelp` – Open a private support channel and ping the mods.
- `/quote` – Get a democratic Helldivers quote.
- `/stats` – Display community statistics gathered from Helldads services with formatted numbers.
- `/submit` – Share your game statistics for the highscores.

## Events

Once per day the bot posts a quote of the day into the dedicated channel for quotes.

## Environment Variables

The following environment variables must be provided:

- `DISCORD_APPLICATION_ID` – Application ID of the Discord bot.
- `DISCORD_GUILD_ID` – Guild ID where commands will be registered.
- `DISCORD_MODS_ROLE_ID` – ID of the Mods role to grant access to new support channels.
- `DISCORD_PUBLIC_KEY` – Public key for verifying requests.
- `DISCORD_QUOTE_CHANNEL_ID` – Channel ID where the daily quote is posted.
- `DISCORD_SUPPORT_CATEGORY_ID` – ID of the category where support channels or threads will be created.
- `DISCORD_TOKEN` – Bot token used for authentication.
- `HELLDADS_STATS_URL` – URL to the JSON with community stats.

See `.env.example` and `.dev.vars.example` for example values.

## Database Setup

This project uses a Cloudflare D1 database called `helldads-statistics`. After creating the binding in `wrangler.jsonc`, run the migrations to set up the schema:

```bash
npx wrangler d1 migrations apply helldads-statistics
```

This command applies all SQL migrations and creates the `submission` table used by the `/submit` command.

It also creates the `highscore` table which stores one record per user and is
automatically updated when a new submission is stored.

## Development

Install dependencies with `npm install` and run a local worker using:

```bash
npm run dev
```

Before testing commands locally, register them with Discord:

```bash
npm run register-commands
```
