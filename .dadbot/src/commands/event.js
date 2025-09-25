import { formatNumber } from '../lib/format.js';

const EVENT_KEY = 'kotks2';

const DIVISIONS = [
	{ key: 'science', column: 'event_kotk_science_kills', name: 'Science Team', logo: '<:st_logo:1345027109944299562>' },
	{ key: 'baldzerkers', column: 'event_kotk_baldzerkers_kills', name: 'Baldzerkers', logo: '<:bz_logo:1345027059327438848>' },
	{ key: 'diaper', column: 'event_kotk_diaper_kills', name: 'Diaper Division', logo: '<:dd_logo:1345027087446052914>' },
	{ key: 'crayon', column: 'event_kotk_crayon_kills', name: 'Crayon Commandos', logo: '<:cc_logo:1345027134862655549>' },
	{ key: 'snack', column: 'event_kotk_snack_kills', name: 'S.N.A.C.K. Division', logo: '<:sd_logo:1395099109203116083>' },
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
		logo: division.logo,
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
				timeLeftLine = `:clock7: **Time left**: ${segments.join(' ')} (${formatted} GMT)`;
			}
		}
	}

	const rankingLines = divisionTotals.map((division, index) => {
		const icon =
			index == 0
				? ':first_place:'
				: index == 1
					? ':second_place:'
					: index == 2
						? ':third_place:'
						: index == 3
							? '<:helldad:1316506358211805244>'
							: '<:helldads_baby:1316435213559136316>';
		return `${icon} — ${division.logo} **${division.name}**: ${formatNumber(division.total)} kills`;
	});

	const highestLine = highestSubmission
		? `<:xdad:1419602524545093692> Highest result per mission: <@${highestSubmission.user}> with ${formatNumber(highestSubmission.kills)} kills`
		: 'Highest result per mission: N/A';

	const message = [
		'# King of the Kill - Season 2',
		'',
		'## Leaderboard',
		...rankingLines,
		'',
		`:trophy: Total kills: ${formatNumber(totalKills)}`,
		`:chart_with_upwards_trend: Total submissions: ${formatNumber(totalSubmissions)}`,
		`:bar_chart: Average kills: ${formatNumber(averageKills)}`,
		highestLine,
		'',
		timeLeftLine,
		'',
		'-# Use `/submit` to contribute your kill count after each mission! If you beat the highest result per mission, you must attach a screenshot as proof. Learn more about our divisions in <#1345040640949489674>.',
	].join('\n');

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
