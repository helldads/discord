import { formatNumber } from '../lib/format.js';

const EVENT_KEY = 'hpp25';
const MAX_SUBMISSION = 1000;

const DIVISIONS = {
	diaper: {
		column: 'event_diaper_count',
		display: 'Diaper Division',
	},
	baldzerkers: {
		column: 'event_baldzerkers_count',
		display: 'Baldzerkers',
	},
	science: {
		column: 'event_science_count',
		display: 'Science Team',
	},
	crayon: {
		column: 'event_crayon_count',
		display: 'Crayon Commandos',
	},
	snack: {
		column: 'event_snack_count',
		display: 'S.N.A.C.K. Division',
	},
};

export const command = {
	name: 'submit',
	description: 'Submit all stratagems used per mission for your faction, or without options for your stats.',
	options: [
		{
			name: 'baldzerkers',
			description: 'Stratagems used by the Baldzerkers division',
			type: 4, // INTEGER
			required: false,
			min_value: 1,
			max_value: MAX_SUBMISSION,
		},
		{
			name: 'crayon',
			description: 'Stratagems used by the Crayon Commandos division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: MAX_SUBMISSION,
		},
		{
			name: 'diaper',
			description: 'Stratagems used by the Diaper Division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: MAX_SUBMISSION,
		},
		{
			name: 'science',
			description: 'Stratagems used by the Science Team division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: MAX_SUBMISSION,
		},
		{
			name: 'snack',
			description: 'Stratagems used by the S.N.A.C.K. Division',
			type: 4,
			required: false,
			min_value: 1,
			max_value: MAX_SUBMISSION,
		},
	],
};

function parseSubmission(options) {
	const provided = Object.entries(options).filter(([, value]) => value !== undefined && value !== null);

	if (provided.length > 1) {
		return {
			error: 'Only one division can be submitted at a time. Please submit separately.',
		};
	}

	const [divisionKey, stratagems] = provided[0];
	const division = DIVISIONS[divisionKey];
	if (!division) {
		return { error: 'Unknown division selected.' };
	}

	const count = Number(stratagems);

	if (count >= MAX_SUBMISSION) {
		return {
			error:
				'Submission count exceptionally high, congratulations! Please submit a screenshot to the mods first, so they can verify your results and add them manually.',
		};
	}

	return { division, stratagems };
}

function parseOptions(interaction) {
	const options = {};
	for (const opt of interaction.data.options || []) {
		options[opt.name] = opt.value;
	}
	return options;
}

async function countRecentSubmissions(db, eventKey, user) {
	const date = new Date(Date.now() - 10 * 60 * 1000).toISOString();
	const res = await db
		.prepare('SELECT COUNT(*) AS cnt FROM submissions WHERE event_key = ? AND user = ? AND date >= ?')
		.bind(eventKey, user, date)
		.first();
	return res ? Number(res.cnt) : 0;
}

async function getUserSubmissions(db, eventKey, userId) {
	const res = await db
		.prepare(
			'SELECT date, event_diaper_count, event_baldzerkers_count, event_science_count, event_crayon_count, event_snack_count FROM submissions WHERE event_key = ? AND user = ?;',
		)
		.bind(eventKey, userId)
		.all();
	return res?.results ?? [];
}

function formatSubmissionSummary(rows) {
	const submissions = [];
	const totals = {};

	for (const row of rows) {
		for (const [key, division] of Object.entries(DIVISIONS)) {
			const count = row[division.column];
			if (count === undefined || count === null) continue;

			const numericCount = Number(count);
			if (!Number.isFinite(numericCount)) continue;

			totals[key] = (totals[key] ?? 0) + numericCount;
			const timestampSeconds = Math.floor(new Date(row.date).getTime() / 1000);
			submissions.push(`<t:${timestampSeconds}:d> <t:${timestampSeconds}:t>: ${formatNumber(numericCount)} (${division.display})`);
		}
	}

	if (submissions.length === 0) {
		return 'You have no submissions for this event yet.';
	}

	const totalLines = Object.entries(totals).map(([key, total]) => {
		const division = DIVISIONS[key];
		return `• ${division.display}: ${formatNumber(total)}`;
	});

	const overall = Object.values(totals).reduce((sum, value) => sum + value, 0);

	return [
		'Here are your submissions for this event:',
		...submissions,
		'',
		'Totals:',
		...totalLines,
		`Overall: ${formatNumber(overall)}`,
	].join('\n');
}

async function getUserTotals(db, eventKey, userId, column) {
	const sql = `SELECT SUM(${column}) AS total FROM submissions WHERE event_key = ? AND user = ?;`;
	const res = await db.prepare(sql).bind(eventKey, userId).first();
	return res ? Number(res.total) : 0;
}

export async function handler(interaction, env, ctx) {
	const eventKey = env.HELLDADS_CURRENT_EVENT_KEY ?? EVENT_KEY;

	// safeguard to prevent submissions once the event has ended
	const eventEnd = env.HELLDADS_CURRENT_EVENT_END;
	let eventActive = false;
	if (eventKey !== '' && eventEnd !== '') {
		const endDate = new Date(eventEnd);
		if (!Number.isNaN(endDate.getTime())) {
			const diffMs = endDate.getTime() - Date.now();
			eventActive = diffMs >= 0;
		}
	}
	if (!eventActive) {
		return Response.json({
			type: 4,
			data: {
				content: 'No event is currently active.',
				flags: 64,
			},
		});
	}

	const options = parseOptions(interaction);
	const provided = Object.values(options).filter((value) => value !== undefined && value !== null);
	const userId = BigInt(interaction.member?.user?.id || interaction.user?.id || 0).toString();

	if (provided.length === 0) {
		try {
			const rows = await getUserSubmissions(env.STATISTICS_DB, eventKey, userId);
			const summary = formatSubmissionSummary(rows);

			return Response.json({
				type: 4,
				data: { content: summary, flags: 64 },
			});
		} catch (err) {
			console.error('Error reading user submissions', err);
			return Response.json({
				type: 4,
				data: { content: 'Failed to read your submissions.', flags: 64 },
			});
		}
	}

	const { division, stratagems, error } = parseSubmission(options);
	if (error) {
		return Response.json({
			type: 4,
			data: { content: error, flags: 64 },
		});
	}

	const username = interaction.member?.user?.username || interaction.user?.username || '';

	/*
	try {
		const count = await countRecentSubmissions(env.STATISTICS_DB, eventKey, userId);
		if (count >= 3) {
			return Response.json({
				type: 4,
				data: {
					content: 'You have submitted three times in a row. Please wait at least 5 minutes before submitting again.',
					flags: 64,
				},
			});
		}
	} catch (err) {
		console.error('Error checking submission rate limit', err);
	}
	*/

	const now = new Date().toISOString();
	const columns = ['user', 'name', 'date', 'event_key', division.column];
	const values = [userId, username, now, eventKey, stratagems];

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

	let totals = 0;
	try {
		totals = await getUserTotals(env.STATISTICS_DB, eventKey, userId, division.column);
	} catch (err) {
		console.error('Error reading user totals', err);
	}

	const message = `<@${userId}> reported **${formatNumber(stratagems)} stratagems used** for **${division.display}**. Thank you for your support!\nTotal contribution: ${formatNumber(totals)}`;

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
