// discord verification
import { verifyKey } from './lib/discord.js';

// slash commands
import * as stats from './commands/stats.js';
import * as quote from './commands/quote.js';
import * as modHelp from './commands/modhelp.js';
import * as help from './commands/help.js';
import * as submit from './commands/submit.js';
import * as update from './commands/update.js';
import * as highscores from './commands/highscores.js';

// scheduled events
import * as dailyQuote from './events/daily-quote.js';
import * as weeklyStats from './events/weekly-stats.js';

const commandHandlers = {
	[stats.command.name]: stats.handler,
	[quote.command.name]: quote.handler,
	[modHelp.command.name]: modHelp.handler,
	[help.command.name]: help.handler,
	[submit.command.name]: submit.handler,
	[update.command.name]: update.handler,
	[highscores.command.name]: highscores.handler,
};

export default {
	// FETCH http request handler
	async fetch(request, env, ctx) {
		if (request.method !== 'POST') {
			return new Response('Expected POST', { status: 405 });
		}

		// Verify the signature
		const signature = request.headers.get('X-Signature-Ed25519');
		const timestamp = request.headers.get('X-Signature-Timestamp');
		const body = await request.text();

		const isValidRequest = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
		if (!isValidRequest) {
			return new Response('Invalid request signature', { status: 401 });
		}

		// Parse the interaction
		const interaction = JSON.parse(body);

		// Pong on PING
		if (interaction.type === 1) {
			return Response.json({ type: 1 }); // PONG
		}

		// Handle slash commands
		if (interaction.type === 2) {
			const name = interaction.data.name;
			const handler = commandHandlers[name];
			if (handler) {
				return await handler(interaction, env, ctx);
			} else {
				return Response.json({
					type: 4,
					data: { content: 'Command not found.' },
				});
			}
		}

		return new Response('Unhandled request', { status: 400 });
	},

	// SCHEDULED cron request handler
	async scheduled(event, env, ctx) {
		switch (event.cron) {
			// daily quote-of-the-day in the Afternoon
			case '0 17 * * *':
				ctx.waitUntil(dailyQuote.handler(event, env, ctx));
				break;
			// weekly community stats on Monday Morning
			case '0 6 * * 2':
				ctx.waitUntil(weeklyStats.handler(event, env, ctx));
				break;
		}
	},
};
