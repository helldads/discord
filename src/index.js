// discord verification
import { verifyKey } from './lib/discord.js';

const commandImporters = {
	stats: () => import('./commands/stats.js'),
	quote: () => import('./commands/quote.js'),
	modhelp: () => import('./commands/modhelp.js'),
	help: () => import('./commands/help.js'),
	lfg: () => import('./commands/lfg.js'),
	submit: () => import('./commands/submit.js'),
	update: () => import('./commands/update.js'),
	highscores: () => import('./commands/highscores.js'),
	event: () => import('./commands/event.js'),
};

const scheduledImporters = {
	'0 17 * * *': () => import('./events/daily-quote.js'),
	'0 6 * * 2': () => import('./events/weekly-stats.js'),
};

async function getCommandHandler(name) {
	const importer = commandImporters[name];
	if (!importer) return null;

	try {
		const module = await importer();
		return module.handler;
	} catch (err) {
		console.error(`Failed to load handler for command "${name}"`, err);
		return null;
	}
}

async function handleScheduledEvent(cron, event, env, ctx) {
	const importer = scheduledImporters[cron];
	if (!importer) return false;

	try {
		const module = await importer();
		if (typeof module.handler !== 'function') {
			console.error(`No handler exported for cron "${cron}"`);
			return false;
		}

		ctx.waitUntil(module.handler(event, env, ctx));
		return true;
	} catch (err) {
		console.error(`Failed to load handler for cron "${cron}"`, err);
		return false;
	}
}

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
			const handler = await getCommandHandler(name);
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
		await handleScheduledEvent(event.cron, event, env, ctx);
	},
};
