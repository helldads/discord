import { quotesByAuthor } from '../data/quotes.js';

// Flatten all quotes across authors for quick random access
const allQuotes = Object.entries(quotesByAuthor).flatMap(([author, quotes]) => quotes.map((text) => ({ text, author })));

// Prepare the list of available authors for the slash command choices
const authorChoices = Object.keys(quotesByAuthor).map((name) => ({ name, value: name }));

export const command = {
	name: 'quote-of-the-day',
	description: 'Receive a random Helldivers quote.',
	options: [
		{
			name: 'author',
			description: 'Select a specific author (optional)',
			type: 3,
			required: false,
			choices: authorChoices,
		},
	],
};

export async function handler(interaction, env, ctx) {
	const authorOption = interaction.data.options?.find((o) => o.name === 'author');

	let quote;
	if (authorOption) {
		const selected = authorOption.value;
		const quotes = quotesByAuthor[selected];
		if (Array.isArray(quotes) && quotes.length > 0) {
			const text = quotes[Math.floor(Math.random() * quotes.length)];
			quote = { text, author: selected };
		}
	}

	if (!quote) {
		quote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
	}

	const message = `🗨️ *"${quote.text}"*\n\n— **${quote.author}**`;

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
