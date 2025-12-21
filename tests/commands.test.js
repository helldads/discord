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
import { buildChannelName, buildConfirmationMessage, handler as lfgHandler, isValidSlug } from '../src/commands/lfg.js';
import { getTimestampFromSnowflake } from '../src/lib/snowflake.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DISCORD_EPOCH = 1420070400000n;

const buildSnowflake = (dateMs) => ((BigInt(dateMs) - DISCORD_EPOCH) << 22n).toString();

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
		submissions: [],
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
					if (sql.includes('SUM(event_diaper_count') && sql.includes('WHERE event_key = ? AND user = ?')) {
						return { results: [data.userTotals] };
					}
					if (sql.includes('SUM(event_diaper_count') && sql.includes('COUNT(*) AS submissions')) {
						return { results: [data.totals] };
					}
					if (sql.includes('UNION ALL') && sql.includes('ORDER BY submissions DESC LIMIT 1')) {
						return { results: data.highest ? [data.highest] : [] };
					}
					if (
						sql.includes('event_baldzerkers_count') &&
						sql.includes('event_crayon_count') &&
						sql.includes('FROM submissions WHERE event_key = ? AND user = ?')
					) {
						return { results: data.submissions };
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

test('lfg command creates a squad voice channel', async () => {
	const calls = [];
	const originalFetch = globalThis.fetch;
	const snowflake = buildSnowflake(Date.now());
	globalThis.fetch = async (url, options) => {
		calls.push({ url, options });
		return new Response(JSON.stringify({ id: snowflake }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	};
	const env = {
		DISCORD_TOKEN: 't',
		DISCORD_GUILD_ID: 'g',
		DISCORD_LFG_CATEGORY_ID: 'cat',
		DISCORD_LFG_ROLE_ID: '0',
	};
	try {
		const interaction = {
			data: {
				options: [
					{ name: 'activity', value: 'fun' },
					{ name: 'difficulty', value: 'high' },
					{ name: 'slug', value: 'tst' },
				],
			},
			member: { user: { id: '1', username: 'Tester' } },
			channel_id: '2',
		};
		const res = await lfgHandler(interaction, env, {});
		const json = await readJson(res);
		assert.ok(json.data.content.includes(`<#${snowflake}>`));
		assert.ok(json.data.content.includes('<@1>'));
		assert.equal(calls.length, 2);

		const createPayload = JSON.parse(calls[0].options.body);
		assert.equal(createPayload.name.startsWith('tst-3h'), true);

		const welcomePayload = JSON.parse(calls[1].options.body);
		assert.ok(welcomePayload.content.includes('Any'));
		assert.ok(welcomePayload.content.includes('Fun'));
		assert.ok(welcomePayload.content.includes('High'));
		assert.ok(welcomePayload.content.includes('Unlimited'));
		assert.deepEqual(welcomePayload.allowed_mentions.users, ['1']);

		const expectedDeletion = Math.floor((getTimestampFromSnowflake(snowflake) + 3 * 60 * 60 * 1000) / 1000);

		assert.ok(json.data.content.includes('**Expires in:** 3 hours'));
		assert.ok(json.data.content.includes(`<t:${expectedDeletion}:R>`));
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('lfg command supports no-ping mode', async () => {
	const calls = [];
	const originalFetch = globalThis.fetch;
	const snowflake = buildSnowflake(Date.now());
	globalThis.fetch = async (url, options) => {
		calls.push({ url, options });
		return new Response(JSON.stringify({ id: snowflake }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	};
	const env = {
		DISCORD_TOKEN: 't',
		DISCORD_GUILD_ID: 'g',
		DISCORD_LFG_CATEGORY_ID: 'cat',
	};
	try {
		const interaction = {
			data: { options: [{ name: 'ping', value: false }] },
			member: { user: { id: '1', username: 'Tester' } },
			channel_id: '2',
		};
		const res = await lfgHandler(interaction, env, {});
		const json = await readJson(res);
		assert.equal(json.data.flags, 64);
		assert.ok(json.data.content.includes('Your channel has been created'));
		assert.equal(calls.length, 2);
		const confirmationPayload = JSON.parse(calls[1].options.body);
		assert.ok(confirmationPayload.content.includes('Unlimited'));
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('lfg command supports unlimited expiry and naming rules', async () => {
	const calls = [];
	const originalFetch = globalThis.fetch;
	const snowflake = buildSnowflake(Date.now());
	globalThis.fetch = async (url, options) => {
		calls.push({ url, options });
		return new Response(JSON.stringify({ id: snowflake }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	};
	const env = {
		DISCORD_TOKEN: 't',
		DISCORD_GUILD_ID: 'g',
		DISCORD_LFG_CATEGORY_ID: 'cat',
		DISCORD_LFG_ROLE_ID: '0',
	};
	try {
		const interaction = {
			data: { options: [{ name: 'expiry', value: 0 }] },
			member: { user: { id: '1', username: 'Tester' } },
			channel_id: '2',
		};
		const res = await lfgHandler(interaction, env, {});
		const json = await readJson(res);

		assert.ok(json.data.content.includes('**Expires in:** never'));

		const createPayload = JSON.parse(calls[0].options.body);
		assert.equal(createPayload.name.startsWith('lfg-'), true);
		assert.equal(createPayload.name.includes('-0h-'), false);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('lfg command validates slug', async () => {
	assert.equal(isValidSlug('lfg'), true);
	assert.equal(isValidSlug('sex'), false);
	assert.equal(isValidSlug('lf'), false);

	const env = { DISCORD_TOKEN: 't', DISCORD_GUILD_ID: 'g' };
	const interaction = { data: { options: [{ name: 'slug', value: 'sex' }] }, member: { user: { id: '1' } } };
	const res = await lfgHandler(interaction, env, {});
	const json = await readJson(res);
	assert.equal(json.data.flags, 64);
	assert.ok(json.data.content.includes('Invalid channel slug'));
});

test('lfg helper builders construct expected values', () => {
	const name = buildChannelName({ slug: 'lfg', difficulty: 'high', faction: 'any', activity: 'fun', username: 'squad' });
	assert.ok(name.startsWith('lfg-high'));
	assert.ok(name.endsWith('squad'));

	const message = buildConfirmationMessage('0', '1', '123', 'Summary');

	assert.ok(message.includes('<@&0>'));
	assert.ok(message.includes('<@1>'));
	assert.ok(message.includes('<#123>'));
	assert.ok(message.includes('Summary'));
});

test('lfg command rejects invalid friend code', async () => {
	const env = { DISCORD_TOKEN: 't', DISCORD_GUILD_ID: 'g' };
	const interaction = { data: { options: [{ name: 'friendcode', value: '#1234-12' }] }, member: { user: { id: '1' } } };
	const res = await lfgHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('Invalid friend code format'));
	assert.equal(json.data.flags, 64);
});

test('submit command records stratagems and returns totals', async () => {
	const db = createFakeDB({
		userTotals: { event_science_count: 3460 },
	});
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'hpp25',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const interaction = {
		data: { options: [{ name: 'science', value: 50 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('reported **50 stratagems used** for **Science Team**'));
	assert.ok(json.data.content.includes('Total contribution: 3,460'));
});

test('submit command fails with no active event', async () => {
	let env = { HELLDADS_CURRENT_EVENT_KEY: 'hpp25', HELLDADS_CURRENT_EVENT_END: new Date(Date.now() - 1).toISOString() };
	const interaction = {
		data: { options: [{ name: 'science', value: 100 }] },
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
		HELLDADS_CURRENT_EVENT_KEY: 'hpp25',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const multipleDivisions = {
		data: {
			options: [
				{ name: 'science', value: 100 },
				{ name: 'baldzerkers', value: 100 },
			],
		},
		member: { user: { id: '1' } },
	};
	const invalidDivision = {
		data: { options: [{ name: 'unknown', value: 100 }] },
		member: { user: { id: '1' } },
	};
	//const invalidCount = { data: { options: [{ name: 'science', value: 0 }] }, member: { user: { id: '1' } } };
	const overCap = { data: { options: [{ name: 'science', value: 3000 }] }, member: { user: { id: '1' } } };

	const resMulti = await submitHandler(multipleDivisions, env, {});
	const jsonMulti = await readJson(resMulti);
	assert.ok(jsonMulti.data.content.includes('Only one division can be submitted at a time.'));

	const resDivision = await submitHandler(invalidDivision, env, {});
	const jsonDivision = await readJson(resDivision);
	assert.ok(jsonDivision.data.content.includes('Unknown division'));

	/*
	// Prevalidated by discord
	const resKills = await submitHandler(invalidKills, env, {});
	const jsonKills = await readJson(resKills);
	assert.ok(jsonKills.data.content.includes('greater than zero'));
	*/
	const resCap = await submitHandler(overCap, env, {});
	const jsonCap = await readJson(resCap);
	assert.ok(jsonCap.data.content.includes('Submission count exceptionally high'));
});

test('submit command lists submissions when no options are provided', async () => {
	const env = {
		STATISTICS_DB: createFakeDB({
			submissions: [
				{ date: '2025-01-01T00:00:00.000Z', event_science_count: 100 },
				{ date: '2025-01-02T00:00:00.000Z', event_diaper_count: 50 },
			],
		}),
		HELLDADS_CURRENT_EVENT_KEY: 'hpp25',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};

	const interaction = { data: { options: [] }, member: { user: { id: '1', username: 'Tester' } } };
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);

	assert.equal(json.data.flags, 64);
	console.log(json.data.content);
	assert.ok(json.data.content.includes('Science Team'));
	assert.ok(json.data.content.includes('Diaper Division'));
	assert.ok(json.data.content.includes('Totals'));
	assert.ok(json.data.content.includes('Overall'));
	assert.ok(json.data.content.includes(`<t:${Math.floor(new Date('2025-01-01T00:00:00.000Z').getTime() / 1000)}:d>`));
});

/*
test('submit command enforces rate limit after three submissions', async () => {
	const now = Date.now();
	const count = { cnt: 3 };
	const db = createFakeDB({ count });
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'kotks2',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const interaction = {
		data: { options: [{ name: 'science', value: 100 }] },
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
			baldzerkers: 28500,
			crayon: 21500,
			diaper: 25100,
			science: 30000,
			snack: 15300,
			submissions: 240,
		},
		highest: {
			user: '99',
			name: 'xnShiLong',
			division: 'Science Team',
			submissions: 1200,
		},
	});
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'hpp25',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	const res = await eventHandler({ data: {} }, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('Holiday Payload Program 2025'));
	assert.ok(json.data.content.includes(':first_place: — <:st_logo:1345027109944299562> **Science Team**: 30,000 stratagems'));
	assert.ok(
		json.data.content.includes(
			'<:helldads_baby:1316435213559136316> — <:sd_logo:1395099109203116083> **S.N.A.C.K. Division**: 15,300 stratagems',
		),
	);
	assert.ok(json.data.content.includes('Total: 120,400'));
	assert.ok(json.data.content.includes('Total submissions: 240'));
	assert.ok(json.data.content.includes('Average per submissions: 501'));
	assert.ok(json.data.content.includes('<:xdad:1419602524545093692> Highest result per submission: <@99> with 1,200'));
	assert.ok(json.data.content.includes('**Time left**:'));
	assert.ok(json.data.content.includes('Use `/submit` to report the number of stratagems used by your division after each mission!'));
});
