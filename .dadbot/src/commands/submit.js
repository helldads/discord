// Slash command for users to submit their personal game stats
import { statisticsFields } from '../data/statistics.js';

export const command = {
	name: 'submit',
	description: 'Submit your Helldivers statistics (in development)',
	options: statisticsFields.map((f) => ({
		name: f.name,
		description: f.description,
		type: f.type === 'string' || f.type === 'date' ? 3 : 4, // STRING or INTEGER
		required: false,
	})),
};

function gatherOptionValues(options) {
	const map = {};
	for (const opt of options || []) {
		map[opt.name] = opt.value;
	}
	return map;
}

function parseData(values) {
	const data = {};
	for (const field of statisticsFields) {
		if (values[field.name] !== undefined && values[field.name] !== '') {
			const val = values[field.name];
			if (field.type === 'int') {
				const n = parseInt(val, 10);
				if (!Number.isInteger(n)) {
					return { error: `${field.label} must be an integer.` };
				}
				data[field.name] = n;
			} else if (field.type === 'date') {
				if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
					return { error: `${field.label} must be in yyyy-mm-dd format.` };
				}
				// ensure the date is valid and not before game launch
				const date = new Date(`${val}T00:00:00Z`);
				if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== val) {
					return { error: `${field.label} is not a valid date.` };
				}
				const earliest = new Date('2024-02-08T00:00:00Z');
				if (date < earliest) {
					return { error: `${field.label} cannot be before Helldivers 2 release date on 2024-02-08.` };
				}
				data[field.name] = val;
			} else {
				data[field.name] = String(val);
			}
		}
	}
	return { data };
}

function formatData(data) {
	const lines = Object.entries(data).map(([k, v]) => `**${k}**: ${v}`);
	return lines.length > 0 ? lines.join('\n') : 'No data provided.';
}

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
	const placeholders = columns.map(() => '?').join(', ');
	const smSql = `INSERT INTO submissions (${columns.join(', ')}) VALUES (${placeholders});`;
	const updates = columns
		.slice(1)
		.map((c) => `${c} = excluded.${c}`)
		.join(', ');
	const hsSql = `INSERT INTO highscores(${columns.join(', ')}) VALUES (${placeholders}) ` + `ON CONFLICT(user) DO UPDATE SET ${updates}`;

	//const hsSql = `REPLACE INTO highscores (${columns.join(', ')}) VALUES (${placeholders});`;

	try {
		const stmtSubmission = env.STATISTICS_DB.prepare(smSql).bind(...values);
		const stmtHighscore = env.STATISTICS_DB.prepare(hsSql).bind(...values);
		// batch executes statements in a transaction
		await env.STATISTICS_DB.batch([stmtSubmission, stmtHighscore]);
	} catch (err) {
		console.error('Error writing to D1', err);
		return Response.json({
			type: 4,
			data: { content: 'Failed to store data.', flags: 64 },
		});
	}

	return Response.json({
		type: 4,
		data: { content: formatData(data), flags: 64 },
	});
}
