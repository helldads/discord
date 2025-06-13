# Dadbot Discord Bot

This worker handles slash commands for the Helldads Discord server.

## Commands

The bot currently implements the following slash commands:

- `/stats` – Display community statistics gathered from Helldads services.
- `/quote-of-the-day` – Post a random Helldivers quote.
- `/modhelp` – Open a private support channel and ping the mods.

## Events

Once per day the bot posts a quote of the day into the dedicated channel for quotes.

## Environment Variables

The following environment variables must be provided:

- `DISCORD_APPLICATION_ID` – Application ID of the Discord bot.
- `DISCORD_GUILD_ID` – Guild ID where commands will be registered.
- `DISCORD_MODS_ROLE_ID` – ID of the Mods role to grant access to new support channels.
- `DISCORD_PUBLIC_KEY` – Public key for verifying requests.
- `DISCORD_QUOTE_CHANNEL_ID` – Channel ID where the daily quote is posted.
- `DISCORD_TOKEN` – Bot token used for authentication.
- `DISCORD_SUPPORT_CATEGORY_ID` – ID of the category where support channels or threads will be created.
- `HELLDADS_STATS_URL` – URL to the JSON with community stats.

See `.env.example` and `.dev.vars.example` for example values.
