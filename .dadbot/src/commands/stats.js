import { formatStatsMessage } from '../lib/format.js';

/**
 * Slash command definition for `/stats`.
 * Displays community statistics collected from various services.
 */
export const command = {
	name: 'stats',
	description: 'Displays HellDads community stats',
	options: [
		{
			name: 'type',
			description: 'Which stats to display (optional)',
			type: 3,
			required: false,
			choices: [
				{ name: 'all', value: 'all' },
				{ name: 'reddit', value: 'reddit' },
				{ name: 'discord', value: 'discord' },
				{ name: 'tiktok', value: 'tiktok' },
				{ name: 'youtube', value: 'youtube' },
			],
		},
	],
};

/**
 * Handle the `/stats` slash command.
 *
 * @param {Object} interaction - Discord interaction payload.
 * @param {Object} env - Worker environment bindings.
 * @param {ExecutionContext} ctx - Worker execution context.
 */
export async function handler(interaction, env, ctx) {
	const typeOption = interaction.data.options?.find((opt) => opt.name === 'type');
	const typeValue = typeOption?.value || 'all';

	// Fetch the JSON
	try {
		const res = await fetch(env.HELLDADS_STATS_URL);
		const stats = await res.json();
		const message = formatStatsMessage(stats, typeValue);
		return Response.json({
			type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
			data: {
				content: message,
			},
		});
	} catch (err) {
		return Response.json({
			type: 4,
			data: {
				content: `Could not fetch community stats from ${env.HELLDADS_STATS_URL}. Please try again later.`,
			},
		});
	}
}
