import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler as cleanupHandler, extractLifetimeHours } from '../src/events/cleanup-lfg.js';

const DISCORD_EPOCH = 1420070400000n;
const buildSnowflake = (dateMs) => ((BigInt(dateMs) - DISCORD_EPOCH) << 22n).toString();

const jsonResponse = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('extractLifetimeHours parses lifetimes', () => {
	assert.equal(extractLifetimeHours('lfg-3h-any'), 3);
	assert.equal(extractLifetimeHours('abc-12h-fun'), 12);
	assert.equal(extractLifetimeHours('lfg-any-thing'), null);
});

test('cleanup handler removes expired channels', async () => {
	const now = Date.now();
	const expiredChannel = { id: buildSnowflake(now - 4 * 60 * 60 * 1000), name: 'lfg-3h-any', parent_id: 'cat' };
	const activeChannel = { id: buildSnowflake(now - 2 * 60 * 60 * 1000), name: 'lfg-6h-any', parent_id: 'cat' };
	const unlimitedChannel = { id: buildSnowflake(now - 10 * 60 * 60 * 1000), name: 'lfg-any', parent_id: 'cat' };

	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, options = {}) => {
		calls.push({ url, options });
		if (!options.method || options.method === 'GET') {
			return jsonResponse([expiredChannel, activeChannel, unlimitedChannel]);
		}

		return new Response(null, { status: 204 });
	};

	const env = {
		DISCORD_TOKEN: 't',
		DISCORD_GUILD_ID: 'g',
		DISCORD_LFG_CATEGORY_ID: 'cat',
	};

	try {
		await cleanupHandler({}, env, {});
		const deleteCalls = calls.filter((c) => c.options.method === 'DELETE');
		assert.equal(deleteCalls.length, 1);
		assert.ok(deleteCalls[0].url.endsWith(expiredChannel.id));
	} finally {
		globalThis.fetch = originalFetch;
	}
});
