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
	return new Intl.NumberFormat('en-US').format(value);
}
