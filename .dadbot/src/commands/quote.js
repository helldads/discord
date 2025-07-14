import { formatQuote } from '../lib/format.js';
import { fetchJsonWithTimeout } from '../lib/fetch.js';

export const command = {
	name: 'quote',
	description: 'Receive a democratic Helldivers quote.',
	options: [
		{
			name: 'category',
			description: 'Select a specific category (optional)',
			type: 3,
			required: false,
			choices: [
				{ name: 'any', value: 'any' },
				{ name: 'Democracy Officer', value: 'democracy_officer' },
				{ name: 'Ship Master', value: 'ship_master' },
				{ name: 'Service Technician', value: 'service_technician' },
				{ name: 'General Brasch', value: 'general_brasch' },
				{ name: 'Training Manual Tips', value: 'training_manual_tips' },
				{ name: 'Barbaros Facts', value: 'barbaros_facts' },
			],
		},
	],
};

export async function handler(interaction, env, ctx) {
	try {
		const quotes = await fetchJsonWithTimeout(env.HELLDADS_QUOTES_ALL_URL);
		const authorChoices = Object.keys(quotes);
		const authorOption = interaction.data.options?.find((o) => o.name === 'author');
		let author = 'any';

		if (!authorOption?.value || authorOption.value == author) {
			author = authorChoices[Math.floor(Math.random() * authorChoices.length)];
		} else {
			const choice = command.options[0].choices.find((c) => c.value === authorOption.value);
			author = choice ? choice.name : '';
		}

		const text = quotes[author][Math.floor(Math.random() * quotes[author].length)];
		const message = { author, text };

		return Response.json({
			type: 4,
			data: { content: formatQuote(message) },
		});
	} catch (err) {
		return Response.json({
			type: 4,
			data: {
				content: 'Failed to get a quote.',
				flags: 64,
			},
		});
	}
}
