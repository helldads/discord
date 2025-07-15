/**
 * Fetch JSON data from a URL with an abort timeout.
 *
 * @param {string} url - Request URL.
 * @param {number} [timeout=5000] - Timeout in milliseconds.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} When the request fails or times out.
 */
export async function fetchJsonWithTimeout(url, timeout = 5000) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);
	try {
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(id);
		if (!res.ok) {
			throw new Error(`Request failed with status ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(id);
	}
}
