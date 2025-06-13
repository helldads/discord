import { quotesByAuthor } from '../data/quotes.js';

// Flatten all quotes across authors for quick random access
const allQuotes = Object.entries(quotesByAuthor).flatMap(([author, quotes]) => quotes.map((text) => ({ text, author })));

// Prepare the list of available authors for the slash command choices
const authorChoices = Object.keys(quotesByAuthor).map((name) => ({ name, value: name }));

export function getRandomQuote(author) {
	if (author) {
		const quotes = quotesByAuthor[author];
		if (Array.isArray(quotes) && quotes.length > 0) {
			const text = quotes[Math.floor(Math.random() * quotes.length)];
			return { text, author };
		}
	}

	return allQuotes[Math.floor(Math.random() * allQuotes.length)];
}

export function formatQuote(quote) {
	return `🗨️ *"${quote.text}"*\n\n— **${quote.author}**`;
}

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

	const quote = getRandomQuote(authorOption?.value);
	const message = formatQuote(quote);

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
