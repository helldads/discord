/**
 * Utility helpers for formatting values used across slash commands.
 */

/**
 * Format a number with thousands separators.
 *
 * @param {number} value - The numeric value to format.
 * @returns {string} Human readable number string.
 */
export function formatNumber(value) {
	// reuse formatter between multiple calls
	if (!formatNumber._formatter) {
		formatNumber._formatter = new Intl.NumberFormat('en-US');
	}
	return formatNumber._formatter.format(value);
}

export function formatDataTable(columns, dataset) {
	// Determine max width per column
	const colWidths = columns.map((col) => {
		const maxDataLen = dataset.reduce(
			(max, row) => Math.max(max, String(row[col] ?? '').length),
			col.length, // account for header too
		);
		return maxDataLen;
	});

	// Helper to pad each value
	const pad = (val, len) => (/^[\d\.,-]+$/.test(val) ? String(val ?? '').padStart(len, ' ') : String(val ?? '').padEnd(len, ' '));

	// Build header row
	const header = columns.map((col, i) => pad(col, colWidths[i])).join(' | ');

	// Separator row
	const separator = colWidths.map((len) => '-'.repeat(len)).join('-|-');

	// Build data rows
	const rows = dataset.map((row) => {
		return columns.map((col, i) => pad(row[col], colWidths[i])).join(' | ');
	});

	// Combine into final table string
	return ['```text', header, separator, ...rows, '```'].join('\n');
}

export function formatQuote(quote) {
	return `🗨️ *"${quote.quote}"*\n\n— **${quote.author}**`;
}
