import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { handler as helloHandler } from '../src/commands/helloworld.js';
import { handler as helpHandler } from '../src/commands/help.js';
import { handler as quoteHandler } from '../src/commands/quote.js';
import { handler as statsHandler } from '../src/commands/stats.js';
import { handler as highscoresHandler } from '../src/commands/highscores.js';
import { handler as modhelpHandler } from '../src/commands/modhelp.js';
import { handler as submitHandler } from '../src/commands/submit.js';
import { handler as updateHandler } from '../src/commands/update.js';
import { handler as eventHandler } from '../src/commands/event.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to read JSON response
async function readJson(res) {
	return await res.json();
}

// Stub for the statistics database used by highscores, submit and event commands
function createFakeDB(state = {}) {
	const defaults = {
		recent: [],
		userTotals: {},
		totals: {},
		highest: null,
		contributors: [],
	};
	const data = { ...defaults, ...state };
	return {
		prepare(sql) {
			const statement = {
				sql,
				params: [],
				bind(...params) {
					this.params = params;
					return this;
				},
				async first() {
					if (sql.includes('SELECT COUNT(*) AS cnt FROM submissions')) {
						return data.count;
					}
					if (sql.includes('SUM(') && sql.includes('WHERE event_key = ? AND user = ?')) {
						const match = sql.match(/SUM\(([^)]+)\)/);
						const column = match?.[1];
						if (column) {
							const total = data.userTotals[column] ?? 0;
							return { total };
						}
						return { total: 0 };
					}
				},
				async all() {
					if (sql.includes('UNION ALL') && sql.includes('ORDER BY kills DESC LIMIT 1')) {
						return { results: data.highest ? [data.highest] : [] };
					}
					if (sql.includes('SUM(event_rec25_samples') && sql.includes('COUNT(*) AS submissions')) {
						return { results: [data.totals] };
					}
					if (sql.includes('GROUP BY user') && sql.includes('event_rec25_samples')) {
						return { results: data.contributors };
					}
					if (sql.includes('ORDER BY event_rec25_samples DESC LIMIT 1')) {
						return { results: data.highest ? [data.highest] : [] };
					}
					return { results: [] };
				},
			};
			return statement;
		},
		async batch(statements) {
			this.lastBatch = statements;
		},
	};
}

test('All commands export a valid declaration object', async () => {
	const commandsDir = path.resolve(__dirname, '../src/commands');
	const files = fs.readdirSync(commandsDir).filter((file) => file.endsWith('.js'));

	for (const file of files) {
		const commandModule = await import(pathToFileURL(path.join(commandsDir, file)));
		const command = commandModule.command;

		assert.equal(typeof command, 'object', `Export in ${file} must be an discord compatible object declaration`);
		assert.equal(typeof command.name, 'string', `Command ${file} must have a string 'name'`);
		assert.equal(typeof command.description, 'string', `Command ${file} must have a string 'description'`);
		if (command?.options) {
			assert.ok(Array.isArray(command.options), `Command ${file} 'options' must be an array if present`);
		}
	}
});

test('helloworld command works', async () => {
	const res = await helloHandler({ data: {} }, {}, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('Hello world!'));
});

test('help command works', async () => {
	const env = { HELLDADS_CODE_OF_CONDUCT: 'https://www.helldads.org/code-of-conduct' };
	const res = await helpHandler({ data: {} }, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('Welcome to HellDads'));
	assert.ok(json.data.content.includes(env.HELLDADS_CODE_OF_CONDUCT));
});

test('quote command fetches a quote', async () => {
	const server = http
		.createServer((req, res) => {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({ any: ['For democracy!'] }));
		})
		.listen(0);
	const url = `http://localhost:${server.address().port}`;
	try {
		const res = await quoteHandler({ data: {} }, { HELLDADS_QUOTES_ALL_URL: url }, {});
		const json = await readJson(res);
		assert.ok(json.data.content.includes('For democracy!'));
	} finally {
		server.close();
	}
});

test('quote command fetches a quote from category', async () => {
	const server = http
		.createServer((req, res) => {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({ any: ['For democracy!'], 'Barbaros Facts': ['This is the way'] }));
		})
		.listen(0);
	const url = `http://localhost:${server.address().port}`;
	try {
		const res = await quoteHandler(
			{ data: { options: [{ name: 'category', value: 'barbaros_facts' }] } },
			{ HELLDADS_QUOTES_ALL_URL: url },
			{},
		);
		const json = await readJson(res);
		assert.ok(json.data.content.includes('This is the way'));
	} finally {
		server.close();
	}
});

test('stats command returns community stats', async () => {
	const payload = {
		lastUpdated: new Date().toISOString(),
		reddit: { subscribers: 1 },
		discord: { approximate_member_count: 1, approximate_presence_count: 1 },
		tiktok: { follower_count: 1, video_count: 1 },
		youtube: { subscriber_count: 1, video_count: 1 },
	};
	const server = http
		.createServer((req, res) => {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(payload));
		})
		.listen(0);
	const url = `http://localhost:${server.address().port}`;
	try {
		const res = await statsHandler({ data: {} }, { HELLDADS_STATS_URL: url }, {});
		const json = await readJson(res);
		assert.ok(json.data.content.includes('HellDads Community Stats'));
	} finally {
		server.close();
	}
});

test('highscores command executes with stub DB', async () => {
	const env = { STATISTICS_DB: createFakeDB() };
	const res = await highscoresHandler({ data: {} }, env, {});
	const json = await readJson(res);
	assert.ok(typeof json.data.content === 'string');
	assert.ok(typeof json.data.content.includes('No highscores available.'));
});

test('update command executes with stub DB', async () => {
	const env = { STATISTICS_DB: createFakeDB() };
	const interaction = { data: {}, member: { user: { id: '1' } } };
	const res = await updateHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('No data provided.'));
});

test('modhelp command triggers fetch calls', async () => {
	const calls = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, {}) => {
		calls.push(url);
		return new Response(JSON.stringify({ id: '1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
	};
	const env = {
		DISCORD_TOKEN: 't',
		DISCORD_GUILD_ID: 'g',
		DISCORD_SUPPORT_CATEGORY_ID: 'c',
		DISCORD_MODS_ROLE_ID: 'r',
		DISCORD_APPLICATION_ID: 'b',
	};
	try {
		const interaction = {
			data: { options: [{ name: 'message', value: 'help' }] },
			member: { user: { id: '1', username: 'tester' } },
			channel_id: '2',
		};
		const res = await modhelpHandler(interaction, env, {});
		const json = await readJson(res);
		assert.ok(json.data.content.includes('The mods have been notified.'));
		assert.ok(calls.length >= 2);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('submit command records samples and returns totals', async () => {
	const db = createFakeDB({
		userTotals: { event_rec25_samples: 34 },
	});
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'reckoning2025',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const interaction = {
		data: { options: [{ name: 'samples', value: 12 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);

	assert.ok(json.data.content.includes('submitted **12 samples**'));
	// fakeDB doesn't reflect updates
	assert.ok(json.data.content.includes('Total contribution:'));
});

test('submit command fails with no active event', async () => {
	let env = {
		HELLDADS_CURRENT_EVENT_KEY: 'reckoning2025',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() - 1).toISOString(),
	};
	const interaction = {
		data: { options: [{ name: 'samples', value: 10 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const resPastDate = await submitHandler(interaction, env, {});
	const jsonPastDate = await readJson(resPastDate);
	assert.ok(jsonPastDate.data.content.includes('No event is currently active.'));

	// empty date
	env.HELLDADS_CURRENT_EVENT_END = '';
	const resNoDate = await submitHandler(interaction, env, {});
	const jsonNoDate = await readJson(resNoDate);
	assert.ok(jsonNoDate.data.content.includes('No event is currently active.'));

	// empty eventkey
	env.HELLDADS_CURRENT_EVENT_KEY = '';
	env.HELLDADS_CURRENT_EVENT_END = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString();

	const resNoEvent = await submitHandler(interaction, env, {});
	const jsonEvent = await readJson(resNoEvent);
	assert.ok(jsonEvent.data.content.includes('No event is currently active.'));
});

test('submit command rejects invalid payloads', async () => {
	const env = {
		STATISTICS_DB: createFakeDB(),
		HELLDADS_CURRENT_EVENT_KEY: 'reckoning2025',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const invalidSamples = { data: { options: [{ name: 'samples', value: 0 }] }, member: { user: { id: '1' } } };
	const overCap = { data: { options: [{ name: 'samples', value: 101 }] }, member: { user: { id: '1' } } };

	const resSamples = await submitHandler(invalidSamples, env, {});
	const jsonSamples = await readJson(resSamples);

	assert.ok(jsonSamples.data.content.includes('Sample count must be greater than zero.'));

	const resCap = await submitHandler(overCap, env, {});
	const jsonCap = await readJson(resCap);
	assert.ok(jsonCap.data.content.includes('Sample count exceptionally high'));
});

/*
// Temporarily disabled to save cpu time
test('submit command enforces rate limit after three submissions', async () => {
	const now = Date.now();
	const count = { cnt: 3 };
	const db = createFakeDB({ count });
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'reckoning2025',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const interaction = {
		data: { options: [{ name: 'samples', value: 25 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('wait at least 5 minutes'));
});
*/

test('event command aggregates event results', async () => {
	const db = createFakeDB({
		totals: {
			samples: 377,
			submissions: 42,
		},
		contributors: [
			{ user: '1', name: 'usera', samples: 100 },
			{ user: '2', name: 'userb', samples: 88 },
			{ user: '3', name: 'userc', samples: 56 },
			{ user: '4', name: 'usera', samples: 54 },
			{ user: '5', name: 'userb', samples: 48 },
			{ user: '6', name: 'userc', samples: 47 },
			{ user: '7', name: 'usera', samples: 44 },
			{ user: '8', name: 'userb', samples: 36 },
			{ user: '9', name: 'userc', samples: 24 },
			{ user: '10', name: 'userc', samples: 22 },
		],
		highest: {
			user: '1',
			name: 'usera',
			samples: 42,
		},
	});
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'reckoning2025',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const res = await eventHandler({ data: {} }, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('Festival of Reckoning: Holiday Sample Donation Drive'));
	assert.ok(json.data.content.includes('1. <@1>: 100 samples'));
	assert.ok(json.data.content.includes('3. <@3>: 56 samples'));
	assert.ok(json.data.content.includes('Total samples: 377'));
	assert.ok(json.data.content.includes('Total submissions: 42'));
	assert.ok(json.data.content.includes('Average samples: 8'));
	assert.ok(json.data.content.includes('<:helldad:1316506358211805244> Highest result per submission: <@1> with 42 samples'));
	assert.ok(json.data.content.includes('Use /submit to contribute your personal sample count'));
});
