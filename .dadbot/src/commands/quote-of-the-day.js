import { quotesByAuthor } from '../data/quotes.js';

const allQuotes = Object.entries(quotesByAuthor).flatMap(([author, quotes]) => quotes.map((text) => ({ text, author })));

export const command = {
	name: 'quote-of-the-day',
	description: 'Receive a random Helldivers quote.',
};

export async function handler(interaction, env, ctx) {
	const random = allQuotes[Math.floor(Math.random() * allQuotes.length)];
	const message = `🗨️ *"${random.text}"*\n\n— **${random.author}**`;

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
