import { statisticsFields } from '../data/statistics.js';

export const command = {
	name: 'highscores',
	description: 'Display highscores of all HellDads who /submit their results.',
};

export async function handler(interaction, env, ctx) {
	const lines = [];
	for (const field of statisticsFields) {
		if (field.name === 'name') continue;
		const order = field.name === 'enlist_date' ? 'ASC' : 'DESC';
		const sql = `SELECT user, name, ${field.name} AS val FROM highscores WHERE ${field.name} IS NOT NULL ORDER BY ${field.name} ${order} LIMIT 1;`;
		try {
			const res = await env.STATISTICS_DB.prepare(sql).all();
			const row = res?.results?.[0];
			if (row) {
				lines.push(`**${field.label}**: ${row.val} (${row.name || row.user} | <@${row.user}>)`);
			}
		} catch (err) {
			console.error('Error reading highscores', err);
		}
	}
	const message = lines.length ? lines.join('\n') : 'No highscores available.';
	return Response.json({
		type: 4,
		data: { content: message },
	});
}
