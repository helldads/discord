import { statisticsFields } from '../data/statistics.js';

// Map field names to human readable labels for formatting output
const labels = Object.fromEntries(statisticsFields.map((f) => [f.name, f.label]));

/**
 * Convert a data object into a multi-line string.
 *
 * @param {Object} data - Raw data keyed by field name.
 * @param {string[]} [omit=[]] - Keys to ignore when generating output.
 * @returns {string} Formatted lines joined by newlines.
 */
export function formatData(data, omit = []) {
	const lines = Object.entries(data)
		.filter(([k, v]) => v !== undefined && v !== null && !omit.includes(k))
		.map(([k, v]) => {
			const label = labels[k] ?? k;
			return `**${label}**: ${v}`;
		});
	return lines.length > 0 ? lines.join('\n') : 'No data provided.';
}

/**
 * Convert an array of Discord option objects into a name/value map.
 *
 * @param {Array<{name: string, value: any}>} options - Option array from an interaction.
 * @returns {Object} Map with option names as keys.
 */
export function gatherOptionValues(options) {
	const map = {};
	for (const opt of options || []) {
		map[opt.name] = opt.value;
	}
	return map;
}

/**
 * Validate and normalize user provided statistic values.
 *
 * @param {Object} values - Map of raw option values keyed by field name.
 * @returns {{data?: Object, error?: string}} Normalized data or error message.
 */
export function parseData(values) {
	const data = {};
	for (const field of statisticsFields) {
		if (values[field.name] !== undefined && values[field.name] !== '') {
			const val = values[field.name];
			if (field.type === 'int') {
				const n = parseInt(val, 10);
				if (!Number.isInteger(n)) {
					return { error: `${field.label} must be an integer.` };
				}
				if (field.min !== undefined && n < field.min) {
					return { error: `${field.label} must be at least ${field.min}.` };
				}
				if (field.max !== undefined && n > field.max) {
					return { error: `${field.label} must be at most ${field.max}.` };
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
