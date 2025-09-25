import { formatNumber } from '../lib/format.js';

const EVENT_KEY = 'kotks2';

const DIVISIONS = [
	{ key: 'science', column: 'event_kotk_science_kills', name: 'Science Team' },
	{ key: 'baldzerkers', column: 'event_kotk_baldzerkers_kills', name: 'Baldzerkers' },
	{ key: 'diaper', column: 'event_kotk_diaper_kills', name: 'Diaper Division' },
	{ key: 'crayon', column: 'event_kotk_crayon_kills', name: 'Crayon Commandos' },
	{ key: 'snack', column: 'event_kotk_snack_kills', name: 'S.N.A.C.K. Division' },
];

export const command = {
	name: 'event',
	description: 'Display summary of the King of the Kill - Season 2 event.',
};

export async function handler(interaction, env, ctx) {
	const eventKey = env.HELLDADS_CURRENT_EVENT_KEY ?? EVENT_KEY;

	let totalsRow = {};
	try {
		const columns = DIVISIONS.map((division) => `SUM(${division.column}) AS ${division.key}`).join(', ');
		const res = await env.STATISTICS_DB.prepare(`SELECT ${columns}, COUNT(*) AS submissions FROM submissions WHERE event_key = ?;`)
			.bind(eventKey)
			.all();
		totalsRow = res?.results?.[0] || {};
	} catch (err) {
		console.error('Error reading event totals', err);
	}

	const divisionTotals = DIVISIONS.map((division) => ({
		name: division.name,
		total: Number(totalsRow?.[division.key] || 0),
	}));

	divisionTotals.sort((a, b) => b.total - a.total);

	const totalKills = divisionTotals.reduce((sum, division) => sum + division.total, 0);
	const totalSubmissions = Number(totalsRow?.submissions || 0);
	const averageKills = totalSubmissions > 0 ? Math.floor(totalKills / totalSubmissions) : 0;

	let highestSubmission = null;
	try {
		const unionQueries = DIVISIONS.map(
			(division) =>
				`SELECT user, name, '${division.name}' AS division, ${division.column} AS kills, date FROM submissions WHERE event_key = ? AND ${division.column} IS NOT NULL`,
		).join(' UNION ALL ');
		const res = await env.STATISTICS_DB.prepare(`${unionQueries} ORDER BY kills DESC LIMIT 1;`)
			.bind(...Array(DIVISIONS.length).fill(eventKey))
			.all();
		highestSubmission = res?.results?.[0] || null;
	} catch (err) {
		console.error('Error reading highest submission', err);
	}

	let timeLeftLine = 'Time left: Unknown';
	const eventEnd = env.HELLDADS_CURRENT_EVENT_END;
	if (eventEnd) {
		const endDate = new Date(eventEnd);
		if (!Number.isNaN(endDate.getTime())) {
			const diffMs = endDate.getTime() - Date.now();
			if (diffMs <= 0) {
				const formatted = endDate.toLocaleString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					hour: 'numeric',
					minute: '2-digit',
					hour12: true,
				});
				timeLeftLine = `Event ended on ${formatted}`;
			} else {
				const totalMinutes = Math.floor(diffMs / (60 * 1000));
				const days = Math.floor(totalMinutes / (60 * 24));
				const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
				const minutes = totalMinutes % 60;
				const formatted = endDate.toLocaleString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					hour: 'numeric',
					minute: '2-digit',
					hour12: true,
				});
				const segments = [
					days > 0 ? `${days} day${days === 1 ? '' : 's'}` : null,
					`${hours} hour${hours === 1 ? '' : 's'}`,
					`${minutes} minute${minutes === 1 ? '' : 's'}`,
				].filter(Boolean);
				timeLeftLine = `Time left: ${segments.join(' ')} (${formatted})`;
			}
		}
	}

	const rankingLines = divisionTotals.map((division, index) => {
		const rank = index + 1;
		return `${rank}. ${division.name}: ${formatNumber(division.total)} kills`;
	});

	const highestLine = highestSubmission
		? `Highest result per mission: ${highestSubmission.name || `<@${highestSubmission.user}>`} with ${formatNumber(
				highestSubmission.kills,
			)} kills`
		: 'Highest result per mission: N/A';

	const message = [
		'King of the Kill - Season 2',
		'',
		...rankingLines,
		'',
		`Total kills: ${formatNumber(totalKills)}`,
		`Total submissions: ${formatNumber(totalSubmissions)}`,
		`Average kills: ${formatNumber(averageKills)}`,
		highestLine,
		'',
		timeLeftLine,
		'',
		'Use /submit to contribute your kill count after each mission! If you beat the highest result per mission, you must attach a screenshot as proof.',
	].join('\n');

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
