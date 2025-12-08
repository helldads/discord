import { formatNumber } from '../lib/format.js';

const EVENT_KEY = 'reckoning2025';
const MAX_SUBMISSION = 75;
const EVENT_COLUMN = 'event_rec25_samples';

export const command = {
	name: 'submit',
	description: 'Submit how many samples you personally extracted.',
	options: [
		{
			name: 'samples',
			description: 'How many samples did you personally extract in your last mission?',
			type: 4, // INTEGER
			required: true,
			min_value: 1,
		},
	],
};

function parseSubmission(options) {
	const provided = Object.entries(options).filter(([, value]) => value !== undefined && value !== null);

	const [optionKey, samplesRaw] = provided[0];
	if (optionKey !== 'samples') {
		return { error: 'Unknown submission field.' };
	}

	const samples = Number(samplesRaw);
	if (!Number.isFinite(samples) || Number.isNaN(samples)) {
		return { error: 'Invalid sample count. Provide a positive number (max 50).' };
	}

	if (samples <= 0) {
		return { error: 'Sample count must be greater than zero.' };
	}

	if (samples > MAX_SUBMISSION) {
		return {
			error:
				'Sample count exceptionally high. Please provide a screenshot for moderators so they can verify your results and add them manually.',
		};
	}

	return { samples };
}

function parseOptions(interaction) {
	const options = {};
	for (const opt of interaction.data.options || []) {
		options[opt.name] = opt.value;
	}
	return options;
}

async function countRecentSubmissions(db, eventKey, user) {
	const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
	const res = await db
		.prepare('SELECT COUNT(*) AS cnt FROM submissions WHERE event_key = ? AND user = ? AND date >= ?')
		.bind(eventKey, user, date)
		.first();
	return res ? Number(res.cnt) : 0;
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
	const { samples, error } = parseSubmission(options);
	if (error) {
		return Response.json({
			type: 4,
			data: { content: error, flags: 64 },
		});
	}

	const userId = BigInt(interaction.member?.user?.id || interaction.user?.id || 0).toString();
	const username = interaction.member?.user?.username || interaction.user?.username || '';

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

	const now = new Date().toISOString();
	const columns = ['user', 'name', 'date', 'event_key', EVENT_COLUMN];
	const values = [userId, username, now, eventKey, samples];

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
		totals = await getUserTotals(env.STATISTICS_DB, eventKey, userId, EVENT_COLUMN);
	} catch (err) {
		console.error('Error reading user totals', err);
	}

	const message = `<@${userId}> submitted **${formatNumber(samples)} samples** . Thank you for your support!\nTotal contribution: ${formatNumber(totals)}`;

	return Response.json({
		type: 4,
		data: { content: message },
	});
}
