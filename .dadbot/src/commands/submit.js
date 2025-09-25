import { formatNumber } from '../lib/format.js';

const EVENT_KEY = 'kotks2';

const DIVISIONS = {
	diaper: {
		column: 'event_kotk_diaper_kills',
		display: 'Diaper Division',
	},
	baldzerkers: {
		column: 'event_kotk_baldzerkers_kills',
		display: 'Baldzerkers',
	},
	science: {
		column: 'event_kotk_science_kills',
		display: 'Science Team',
	},
	crayon: {
		column: 'event_kotk_crayon_kills',
		display: 'Crayon Commandos',
	},
	snack: {
		column: 'event_kotk_snack_kills',
		display: 'S.N.A.C.K. Division',
	},
};

export const command = {
	name: 'submit',
	description: 'Submit your mission kills for King of the Kill - Season 2.',
	options: [
		{
			name: 'baldzerkers',
			description: 'Kills scored for the Baldzerkers division',
			type: 4, // INTEGER
			required: false,
			min_value: 1,
			max_value: 2500,
		},
		{
			name: 'crayon',
			description: 'Kills scored for the Crayon Commandos division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: 2500,
		},
		{
			name: 'diaper',
			description: 'Kills scored for the Diaper Division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: 2500,
		},
		{
			name: 'science',
			description: 'Kills scored for the Science Team division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: 2500,
		},
		{
			name: 'snack',
			description: 'Kills scored for the S.N.A.C.K. Division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: 2500,
		},
	],
};

function parseSubmission(options) {
	const provided = Object.entries(options).filter(([, value]) => value !== undefined && value !== null);

	if (provided.length === 0) {
		return { error: 'Please submit kills for exactly one division.' };
	}

	if (provided.length > 1) {
		return {
			error: 'Only one division can be submitted at a time. Please submit separate commands.',
		};
	}

	const [divisionKey, killsRaw] = provided[0];
	const division = DIVISIONS[divisionKey];
	if (!division) {
		return { error: 'Unknown division selected.' };
	}

	const kills = Number(killsRaw);
	if (!Number.isFinite(kills) || Number.isNaN(kills)) {
		return { error: 'Invalid kill count. Provide a positive number (max 2500).' };
	}

	if (kills <= 0) {
		return { error: 'Kill count must be greater than zero.' };
	}

	if (kills > 2500) {
		return {
			error: 'Kill count too high. Please submit a screenshot to the mods so they can review and add it manually.',
		};
	}

	return { division, kills };
}

function parseOptions(interaction) {
	const options = {};
	for (const opt of interaction.data.options || []) {
		options[opt.name] = opt.value;
	}
	return options;
}

async function getRecentSubmissions(db, eventKey) {
	const sql = 'SELECT user, date FROM submissions WHERE event_key = ? ORDER BY date DESC LIMIT 3;';
	const res = await db.prepare(sql).bind(eventKey).all();
	return res?.results || [];
}

async function getUserTotals(db, eventKey, userId) {
	const sql = `
    SELECT
      SUM(event_kotk_diaper_kills) AS diaper,
      SUM(event_kotk_baldzerkers_kills) AS baldzerkers,
      SUM(event_kotk_science_kills) AS science,
      SUM(event_kotk_crayon_kills) AS crayon,
      SUM(event_kotk_snack_kills) AS snack
    FROM submissions
    WHERE event_key = ? AND user = ?;
  `;
	const res = await db.prepare(sql).bind(eventKey, userId).all();
	return res?.results?.[0] || {};
}

export async function handler(interaction, env, ctx) {
	const eventKey = env.HELLDADS_CURRENT_EVENT_KEY ?? EVENT_KEY;

	// safeguard to prevent submissions once the event has ended
	if (eventKey !== EVENT_KEY) {
		return Response.json({
			type: 4,
			data: {
				content: 'No event is currently active.',
				flags: 64,
			},
		});
	}

	const options = parseOptions(interaction);
	const { division, kills, error } = parseSubmission(options);
	if (error) {
		return Response.json({
			type: 4,
			data: { content: error, flags: 64 },
		});
	}

	const userId = BigInt(interaction.member?.user?.id || interaction.user?.id || 0).toString();
	const username = interaction.member?.user?.username || interaction.user?.username || '';

	try {
		const recent = await getRecentSubmissions(env.STATISTICS_DB, eventKey);
		if (recent.length === 3 && recent.every((entry) => String(entry.user) === userId)) {
			const lastTimestamp = new Date(recent[0].date || 0).getTime();
			const diffMinutes = (Date.now() - lastTimestamp) / (60 * 1000);
			if (diffMinutes < 5) {
				return Response.json({
					type: 4,
					data: {
						content: 'You have submitted three times in a row. Please wait at least 5 minutes before submitting again.',
						flags: 64,
					},
				});
			}
		}
	} catch (err) {
		console.error('Error checking submission rate limit', err);
	}

	const now = new Date().toISOString();
	const columns = ['user', 'name', 'date', 'event_key', division.column];
	const values = [userId, username, now, eventKey, kills];

	try {
		const placeholders = columns.map(() => '?').join(', ');
		const sql = `INSERT INTO submissions (${columns.join(', ')}) VALUES (${placeholders});`;
		const stmt = env.STATISTICS_DB.prepare(sql).bind(...values);
		await env.STATISTICS_DB.batch([stmt]);
	} catch (err) {
		console.error('Error writing to database', err);
		return Response.json({
			type: 4,
			data: { content: 'Failed to store data.', flags: 64 },
		});
	}

	let totals = {};
	try {
		totals = await getUserTotals(env.STATISTICS_DB, eventKey, userId);
	} catch (err) {
		console.error('Error reading user totals', err);
	}

	const contributions = Object.entries(DIVISIONS)
		.map(([key, info]) => ({ name: info.display, total: Number(totals[key] || 0) }))
		.filter((entry) => entry.total > 0)
		.sort((a, b) => b.total - a.total)
		.map((entry) => `- ${entry.name}: ${formatNumber(entry.total)}`);

	const messageLines = [`<@${userId}> submitted ${formatNumber(kills)} kills to ${division.display}. Thank you for your support!`];
	if (contributions.length) {
		messageLines.push('Total contribution:');
		messageLines.push(...contributions);
	}

	return Response.json({
		type: 4,
		data: { content: messageLines.join('\n') },
	});
}
