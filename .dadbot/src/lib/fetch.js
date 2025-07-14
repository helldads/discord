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
