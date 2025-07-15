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

/**
 * Format an array of objects as a plain text table.
 *
 * @param {string[]} columns - Column names to display.
 * @param {Object[]} dataset - Array of records to format.
 * @returns {string} Markdown formatted table in a code block.
 */
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

/**
 * Format a quote with markdown styling.
 *
 * @param {{text: string, author: string}} quote - Quote object.
 * @returns {string} Formatted quote for Discord.
 */
export function formatQuote(quote) {
	return `🗨️ *"${quote.text}"*\n\n— **${quote.author}**`;
}

/**
 * Format stats based on type
 *
 * @param {{stats: object, type: string}} statistics object and type.
 * @returns {string} Formatted message for Discord.
 */
export function formatStatsMessage(stats, type) {
	// Format output
	let message = '';
	const unixTimestamp = Math.floor(new Date(stats.lastUpdated).getTime() / 1000);
	switch (type) {
		case 'reddit':
			message =
				`**HellDads [Reddit](<https://reddit.com/r/HellDads>) Stats**\n` +
				`Subscribers: ${formatNumber(stats.reddit.subscribers)}\n` +
				`Active users: ${formatNumber(stats.reddit.active_user_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'discord':
			message =
				`**HellDads [Discord](<https://tinyurl.com/discord-helldads>) Stats**\n` +
				`Members: ${formatNumber(stats.discord.approximate_member_count)}\n` +
				`Online: ${formatNumber(stats.discord.approximate_presence_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'tiktok':
			message =
				`**HellDads [TikTok](<https://www.tiktok.com/@helldads>) Stats**\n` +
				`Follower: ${formatNumber(stats.tiktok.follower_count)}\n` +
				`Videos: ${formatNumber(stats.tiktok.video_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		case 'youtube':
			message =
				`**HellDads [YouTube](<https://www.youtube.com/@HellDadsHQ>) Stats**\n` +
				`Subscribers: ${formatNumber(stats.youtube.subscriber_count)}\n` +
				`Videos: ${formatNumber(stats.youtube.video_count)}\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;

		default:
			message =
				`**HellDads Community Stats**\n\n` +
				`[Reddit](<https://reddit.com/r/HellDads>): ${formatNumber(stats.reddit.subscribers)} subscribers, ${formatNumber(stats.reddit.active_user_count)} active users\n` +
				`[Discord](<https://tinyurl.com/discord-helldads>): ${formatNumber(stats.discord.approximate_member_count)} members, ${formatNumber(stats.discord.approximate_presence_count)} online\n` +
				`[TikTok](<https://www.tiktok.com/@helldads>): ${formatNumber(stats.tiktok.follower_count)} followers, ${formatNumber(stats.tiktok.video_count)} videos\n` +
				`[YouTube](<https://www.youtube.com/@HellDadsHQ>): ${formatNumber(stats.youtube.subscriber_count)} subscribers, ${formatNumber(stats.youtube.video_count)} videos\n\n` +
				`Last updated: <t:${unixTimestamp}:R>, [www.helldads.org](<https://www.helldads.org>)`;
			break;
	}

	return message;
}
