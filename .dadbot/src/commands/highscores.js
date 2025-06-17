import { statisticsFields } from '../data/statistics.js';
import { formatData } from '../lib/statistics.js';
import { formatNumber } from '../lib/format.js';

export const command = {
	name: 'highscores',
	description: 'Display highscores of all HellDads who /submit their results.',
	options: [
		{
			name: 'user',
			description: 'Discord user mention or player name',
			type: 3, // STRING
			required: false,
		},
		{
			name: 'top10',
			description: 'Top 10 list per category',
			type: 3, // STRING
			required: false,
			choices: statisticsFields
				.filter((f) => !['user', 'name', 'date', 'verified'].includes(f.name))
				.map((f) => ({ name: f.label, value: f.name })),
		},
	],
};

export async function handler(interaction, env, ctx) {
	const userOption = interaction.data.options?.find((o) => o.name === 'user');
	const userValue = userOption?.value?.trim();
	const fieldOption = interaction.data.options?.find((o) => o.name === 'top10');
	const fieldValue = fieldOption?.value;
	let message = 'No highscores available.';

	if (fieldValue) {
		const field = statisticsFields.find((f) => f.name === fieldValue);
		if (field) {
			const lines = [];
			const order = field.name === 'enlist_date' ? 'ASC' : 'DESC';
			const sql = `SELECT user, name, ${field.name} AS val FROM highscores WHERE ${field.name} IS NOT NULL ORDER BY ${field.name} ${order} LIMIT 10;`;
			try {
				const res = await env.STATISTICS_DB.prepare(sql).all();
				for (const [idx, row] of res?.results?.entries() || []) {
					let val = field.type === 'int' ? formatNumber(row.val) : row.val;
					lines.push(`${idx + 1}. ${val} (${row.name || row.user} | <@${row.user}>)`);
				}
				if (lines.length) {
					message = `**Top ${field.label}**\n` + lines.join('\n');
				}
			} catch (err) {
				console.error('Error reading highscores', err);
			}
		}
	} else if (userValue) {
		let row = null;
		try {
			const match = /^<@!?(\d+)>$/.exec(userValue);
			if (match || /^\d+$/.test(userValue)) {
				const userId = match ? match[1] : userValue;
				const res = await env.STATISTICS_DB.prepare('SELECT * FROM highscores WHERE user = ?').bind(userId).all();
				row = res?.results?.[0];
			} else {
				const res = await env.STATISTICS_DB.prepare('SELECT * FROM highscores WHERE name = ?').bind(userValue).all();
				row = res?.results?.[0];
			}
			if (row) {
				message = formatData(row, ['user', 'date', 'verified']);
			}
		} catch (err) {
			console.error('User not found.', err);
		}
	} else {
		const lines = [];
		for (const field of statisticsFields) {
			if (field.name === 'name') continue;
			const order = field.name === 'enlist_date' ? 'ASC' : 'DESC';
			const sql = `SELECT user, name, ${field.name} AS val FROM highscores WHERE ${field.name} IS NOT NULL ORDER BY ${field.name} ${order} LIMIT 1;`;
			try {
				const res = await env.STATISTICS_DB.prepare(sql).all();
				const row = res?.results?.[0];
				if (row) {
					let val = field.type === 'int' ? formatNumber(row.val) : row.val;
					lines.push(`**${field.label}**: ${val} (${row.name || row.user} | <@${row.user}>)`);
				}
			} catch (err) {
				console.error('Error reading highscores', err);
			}
		}
		if (lines.length) {
			message = lines.join('\n');
		}
	}
	return Response.json({
		type: 4,
		data: { content: message, flags: 64 },
	});
}
