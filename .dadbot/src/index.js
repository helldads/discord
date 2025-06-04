// Import crypto to verify Discord signature
import { verifyKey } from './verify-discord.js';

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

		// Respond to /helloworld command
		if (interaction.type === 2 && interaction.data.name === 'helloworld') {
			return Response.json({
				type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
				data: {
					content: 'Hello, world! 🌍',
				},
			});
		}

		return new Response('Unhandled request', { status: 400 });
	},
};
