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

	return Response.json({
		type: 4,
		data: { content: formatData(data), flags: 64 },
	});
}
