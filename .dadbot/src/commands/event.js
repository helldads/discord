import { formatNumber, formatDataTable } from '../lib/format.js';

export const command = {
	name: 'event',
	description: 'Display results for the current community event: LUNGPUNCH',
};

export async function handler(interaction, env, ctx) {
	const eventKey = env.HELLDADS_CURRENT_EVENT_KEY;
	if (!eventKey) {
		return Response.json({
			type: 4,
			data: { content: 'No event is currently active.', flags: 64 },
		});
	}

	let totalLungs = 0;
	let totalEggs = 0;
	try {
		const res = await env.STATISTICS_DB.prepare(
			'SELECT SUM(event_spore_lungs_destroyed) AS lungs, SUM(event_eggs_destroyed) AS eggs FROM submissions WHERE event_key = ?;',
		)
			.bind(eventKey)
			.all();
		const row = res?.results?.[0];
		if (row) {
			totalLungs = row.lungs || 0;
			totalEggs = row.eggs || 0;
		}
	} catch (err) {
		console.error('Error reading event totals', err);
	}

	let table = 'No contributions yet.';
	try {
		const res = await env.STATISTICS_DB.prepare(
			'SELECT user, name, SUM(event_spore_lungs_destroyed) AS lungs, SUM(event_eggs_destroyed) AS eggs FROM submissions WHERE event_key = ? GROUP BY user ORDER BY SUM(event_spore_lungs_destroyed) + SUM(event_eggs_destroyed) DESC LIMIT 50;',
		)
			.bind(eventKey)
			.all();
		const dataset = [];
		for (const row of res?.results || []) {
			const lungs = row.lungs || 0;
			const eggs = row.eggs || 0;
			dataset.push({
				Name: row.name || `<@${row.user}>`,
				'Spore Lungs': formatNumber(lungs),
				'Eggs Sites': formatNumber(eggs),
				Total: formatNumber(lungs + eggs),
			});
		}
		if (dataset.length) {
			table = formatDataTable(['Name', 'Spore Lungs', 'Eggs Sites', 'Total'], dataset);
		}
	} catch (err) {
		console.error('Error reading event standings', err);
	}

	const message = [
		`OPERATION: ${eventKey.toUpperCase()}`,
		'',
		`Total Spore Lungs destroyed: ${formatNumber(totalLungs)}`,
		`Total Eggs Sites destroyed: ${formatNumber(totalEggs)}`,
		'',
		'Top Contributors:',
		'',
		table,
		'',
		'Report your mission results via: /submit',
	].join('\n');

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
