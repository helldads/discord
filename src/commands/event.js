import { formatNumber } from '../lib/format.js';

const EVENT_KEY = 'reckoning2025';
const EVENT_COLUMN = 'event_rec25_samples';

export const command = {
	name: 'event',
	description: 'Display summary of the Festival of Reckoning event.',
};

export async function handler(interaction, env, ctx) {
	const eventKey = env.HELLDADS_CURRENT_EVENT_KEY ?? EVENT_KEY;

	let totalsRow = {};
	try {
		const res = await env.STATISTICS_DB.prepare(
			`SELECT SUM(${EVENT_COLUMN}) AS samples, COUNT(*) AS submissions FROM submissions WHERE event_key = ?;`,
		)
			.bind(eventKey)
			.all();
		totalsRow = res?.results?.[0] || {};
	} catch (err) {
		console.error('Error reading event totals', err);
	}

	let leaderboard = [];
	try {
		const res = await env.STATISTICS_DB.prepare(
			`SELECT user, SUM(${EVENT_COLUMN}) AS samples FROM submissions WHERE event_key = ? GROUP BY user, name ORDER BY samples DESC LIMIT 10;`,
		)
			.bind(eventKey)
			.all();
		leaderboard = res?.results || [];
	} catch (err) {
		console.error('Error reading leaderboard', err);
	}

	const totalSamples = Number(totalsRow?.samples || 0);
	const totalSubmissions = Number(totalsRow?.submissions || 0);
	const averageSamples = totalSubmissions > 0 ? Math.floor(totalSamples / totalSubmissions) : 0;

	let highestSubmission = null;
	try {
		const res = await env.STATISTICS_DB.prepare(
			`SELECT user, ${EVENT_COLUMN} AS samples FROM submissions WHERE event_key = ? ORDER BY ${EVENT_COLUMN} DESC LIMIT 1;`,
		)
			.bind(eventKey)
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

	const leaderboardLines = leaderboard.map(
		(entry, index) => `${index + 1}. <@${entry.user}>: ${formatNumber(Number(entry.samples || 0))} samples`,
	);

	const highestLine =
		highestSubmission && Number(highestSubmission.samples || 0) > 0
			? `<:helldad:1316506358211805244> Highest result per submission: <@${highestSubmission.user}> with ${formatNumber(Number(highestSubmission.samples || 0))} samples`
			: 'Highest result per submission: N/A';

	const message = [
		'# Festival of Reckoning: Holiday Sample Donation Drive',
		'',
		'## Leaderboard',
		...(leaderboardLines.length > 0 ? leaderboardLines : ['No submissions yet.']),
		'',
		`:trophy: Total samples: ${formatNumber(totalSamples)}`,
		`:chart_with_upwards_trend: Total submissions: ${formatNumber(totalSubmissions)}`,
		`:bar_chart: Average samples: ${formatNumber(averageSamples)}`,
		highestLine,
		'',
		timeLeftLine,
		'',
		'Use /submit to contribute your personal sample count after each extraction! If you beat the highest result per extraction, you must attach a screenshot as proof.',
	].join('\n');

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
