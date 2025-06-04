// Import crypto to verify Discord signature
import { verifyKey } from './verify-discord.js';
import { quotesByAuthor } from './data/quotes.js';

// prepare quotes on worker startup
const allQuotes = Object.entries(quotesByAuthor).flatMap(([author, quotes]) => quotes.map((text) => ({ text, author })));

export default {
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

		// Handle /stats command
		if (interaction.type === 2 && interaction.data.name === 'stats') {
			const typeOption = interaction.data.options?.find((opt) => opt.name === 'type');
			const typeValue = typeOption?.value || 'community';

			// Fetch the JSON
			let stats;
			try {
				const res = await fetch(env.HELLDADS_STATS_URL);
				stats = await res.json();
			} catch (err) {
				return Response.json({
					type: 4,
					data: {
						content: 'Could not fetch community stats. Please try again later.',
					},
				});
			}

			// Format output
			let message = '';
			const unixTimestamp = Math.floor(new Date(stats.lastUpdated).getTime() / 1000);
			switch (typeValue) {
				case 'community':
					message =
						`**HellDads Community Stats**\n\n` +
						`Reddit: ${stats.reddit.subscribers} subscribers, ${stats.reddit.active_user_count} active users\n` +
						`Discord: ${stats.discord.approximate_member_count} members, ${stats.discord.approximate_presence_count} online\n` +
						`YouTube: ${stats.youtube.subscriber_count} subscribers, ${stats.youtube.video_count} videos\n\n` +
						`Last updated: <t:${unixTimestamp}:R>`;
					break;

				case 'reddit':
					message =
						`**HellDads Reddit Stats**\n` +
						`Subscribers: ${stats.reddit.subscribers}\n` +
						`Active users: ${stats.reddit.active_user_count}\n\n` +
						`Last updated: <t:${unixTimestamp}:R>`;
					break;

				case 'discord':
					message =
						`**HellDads Discord Stats**\n` +
						`Members: ${stats.discord.approximate_member_count}\n` +
						`Online: ${stats.discord.approximate_presence_count}\n\n` +
						`Last updated: <t:${unixTimestamp}:R>`;
					break;

				case 'youtube':
					message =
						`**HellDads YouTube Stats**\n` +
						`Subscribers: ${stats.youtube.subscriber_count}\n` +
						`Videos: ${stats.youtube.video_count}\n\n` +
						`Last updated: <t:${unixTimestamp}:R>`;
					break;

				default:
					message = 'Unknown type.';
			}

			return Response.json({
				type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
				data: {
					content: message,
				},
			});
		}

		// Handle /quote-of-the-day command
		if (interaction.type === 2 && interaction.data.name === 'quote-of-the-day') {
			const randomIndex = Math.floor(Math.random() * allQuotes.length);
			const randomQuote = allQuotes[randomIndex];

			return Response.json({
				type: 4,
				data: {
					content: `🗨️ *"${randomQuote.text}"*\n\n— **${randomQuote.author}**`,
				},
			});
		}
		return new Response('Unhandled request', { status: 400 });
	},
};
