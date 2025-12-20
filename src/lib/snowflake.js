const DISCORD_EPOCH = 1420070400000n;

/**
 * Convert a Discord snowflake into a Unix timestamp in milliseconds.
 * @param {string|bigint} snowflake - Snowflake identifier.
 * @returns {number} Timestamp in milliseconds.
 */
export function getTimestampFromSnowflake(snowflake) {
	const id = BigInt(snowflake);
	return Number((id >> 22n) + DISCORD_EPOCH);
}
