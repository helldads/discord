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
		const categoryChoices = Object.keys(quotes);
		const categoryOption = interaction.data.options?.find((o) => o.name === 'category');
		let category = 'any';

		if (!categoryOption?.value || categoryOption.value == category) {
			category = categoryChoices[Math.floor(Math.random() * categoryChoices.length)];
		} else {
			const choice = command.options[0].choices.find((c) => c.value === categoryOption.value);
			category = choice ? choice.name : '';
		}

		const text = quotes[category][Math.floor(Math.random() * quotes[category].length)];
		const message = { author: category, text };

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
