// Slash command for users to update their personal game stats
import { statisticsFields } from '../data/statistics.js';
import { formatData, gatherOptionValues, parseData } from '../lib/statistics.js';

export const command = {
	name: 'update',
	description: 'Update your Helldivers statistics (in development)',
	options: statisticsFields.map((f) => ({
		name: f.name,
		description: f.description,
		type: f.type === 'string' || f.type === 'date' ? 3 : 4, // STRING or INTEGER
		required: false,
	})),
};

export async function handler(interaction, env, ctx) {
	const optionsMap = gatherOptionValues(interaction.data.options);

	const { data, error } = parseData(optionsMap);
	if (error) {
		return Response.json({
			type: 4,
			data: { content: `Error: ${error}`, flags: 64 },
		});
	}
	const userId = BigInt(interaction.member?.user?.id || interaction.user?.id || 0).toString();
	const now = new Date().toISOString();

	// build insert statement dynamically so unspecified fields remain NULL
	const columns = ['user', 'date'];
	const values = [userId, now];
	for (const [key, value] of Object.entries(data)) {
		columns.push(key);
		values.push(value);
	}

	// Only update when new data has been provided
	if (columns.length > 2) {
		const placeholders = columns.map(() => '?').join(', ');
		const smSql = `INSERT INTO submissions (${columns.join(', ')}) VALUES (${placeholders});`;
		const updates = columns
			.slice(1)
			.map((c) => `${c} = excluded.${c}`)
			.join(', ');
		const hsSql = `INSERT INTO highscores(${columns.join(', ')}) VALUES (${placeholders}) ` + `ON CONFLICT(user) DO UPDATE SET ${updates}`;

		try {
			const stmtSubmission = env.STATISTICS_DB.prepare(smSql).bind(...values);
			const stmtHighscore = env.STATISTICS_DB.prepare(hsSql).bind(...values);
			// batch executes statements in a transaction
			await env.STATISTICS_DB.batch([stmtSubmission, stmtHighscore]);
		} catch (err) {
			console.error('Error writing to database', err);
			return Response.json({
				type: 4,
				data: { content: 'Failed to store data.', flags: 64 },
			});
		}
	}

	// fetch the highscore for this user
	let highscore = null;
	try {
		const res = await env.STATISTICS_DB.prepare('SELECT * FROM highscores WHERE user = ?').bind(userId).all();
		if (res?.results?.length) {
			highscore = res.results[0];
		}
	} catch (err) {
		console.error('Error reading from database', err);
	}

	const changed = formatData(data);
	const summary = highscore ? formatData(highscore, ['user', 'date', 'verified']) : 'No highscore found.';

	return Response.json({
		type: 4,
		data: {
			content: `**Updated Values**\n${changed}\n\n**Current Highscore**\n${summary}`,
			flags: 64,
		},
	});
}
