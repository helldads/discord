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
				async all() {
					if (sql.includes('ORDER BY date DESC LIMIT 3')) {
						return { results: data.recent };
					}
					if (sql.includes('SUM(event_kotk_diaper_kills') && sql.includes('WHERE event_key = ? AND user = ?')) {
						return { results: [data.userTotals] };
					}
					if (sql.includes('SUM(event_kotk_diaper_kills') && sql.includes('COUNT(*) AS submissions')) {
						return { results: [data.totals] };
					}
					if (sql.includes('UNION ALL') && sql.includes('ORDER BY kills DESC LIMIT 1')) {
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

test('submit command records kills and returns totals', async () => {
	const db = createFakeDB({
		userTotals: { science: 3460, baldzerkers: 450 },
	});
	const env = { STATISTICS_DB: db, HELLDADS_CURRENT_EVENT_KEY: 'kotks2' };
	const interaction = {
		data: { options: [{ name: 'science', value: 750 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('submitted 750 kills to Science Team'));
	assert.ok(json.data.content.includes('Total contribution:'));
	assert.ok(json.data.content.includes('Science Team: 3,460'));
	assert.ok(json.data.content.includes('Baldzerkers: 450'));
});

test('submit command fails with no active event', async () => {
	const env = { HELLDADS_CURRENT_EVENT_KEY: '', HELLDADS_CURRENT_EVENT_END: new Date(Date.now() - 1).toISOString() };
	const interaction = {
		data: { options: [{ name: 'science', value: 100 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('No event is currently active.'));
});

test('submit command rejects invalid payloads', async () => {
	const env = { STATISTICS_DB: createFakeDB(), HELLDADS_CURRENT_EVENT_KEY: 'kotks2' };
	const noDivision = { data: { options: [] }, member: { user: { id: '1' } } };
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
	const invalidKills = { data: { options: [{ name: 'science', value: 0 }] }, member: { user: { id: '1' } } };
	const overCap = { data: { options: [{ name: 'science', value: 3000 }] }, member: { user: { id: '1' } } };

	const resNoDivision = await submitHandler(noDivision, env, {});
	const jsonNoDivision = await readJson(resNoDivision);
	assert.ok(jsonNoDivision.data.content.includes('exactly one division'));

	const resMulti = await submitHandler(multipleDivisions, env, {});
	const jsonMulti = await readJson(resMulti);
	assert.ok(jsonMulti.data.content.includes('Only one division'));

	const resDivision = await submitHandler(invalidDivision, env, {});
	const jsonDivision = await readJson(resDivision);
	assert.ok(jsonDivision.data.content.includes('Unknown division'));

	const resKills = await submitHandler(invalidKills, env, {});
	const jsonKills = await readJson(resKills);
	assert.ok(jsonKills.data.content.includes('greater than zero'));

	const resCap = await submitHandler(overCap, env, {});
	const jsonCap = await readJson(resCap);
	assert.ok(jsonCap.data.content.includes('Kill count exceptionally high, congratulations!'));
});

test('submit command enforces rate limit after three submissions', async () => {
	const now = Date.now();
	const recent = [
		{ user: '1', date: new Date(now - 60 * 1000).toISOString() },
		{ user: '1', date: new Date(now - 2 * 60 * 1000).toISOString() },
		{ user: '1', date: new Date(now - 3 * 60 * 1000).toISOString() },
	];
	const db = createFakeDB({ recent });
	const env = { STATISTICS_DB: db, HELLDADS_CURRENT_EVENT_KEY: 'kotks2' };
	const interaction = {
		data: { options: [{ name: 'science', value: 100 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	console.log(json.data.content);
	assert.ok(json.data.content.includes('wait at least 5 minutes'));
});

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
			kills: 1200,
		},
	});
	const env = {
		STATISTICS_DB: db,
		HELLDADS_CURRENT_EVENT_KEY: 'kotks2',
		HELLDADS_CURRENT_EVENT_END: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
	};
	console.log('END:', env.HELLDADS_CURRENT_EVENT_END);
	const res = await eventHandler({ data: {} }, env, {});
	const json = await readJson(res);
	console.log(json.data.content);
	assert.ok(json.data.content.includes('King of the Kill - Season 2'));
	assert.ok(json.data.content.includes(':first_place: — <:st_logo:1345027109944299562> **Science Team**: 30,000 kills'));
	assert.ok(
		json.data.content.includes(
			'<:helldads_baby:1316435213559136316> — <:sd_logo:1395099109203116083> **S.N.A.C.K. Division**: 15,300 kills',
		),
	);
	assert.ok(json.data.content.includes('Total kills: 120,400'));
	assert.ok(json.data.content.includes('Total submissions: 240'));
	assert.ok(json.data.content.includes('Average kills: 501'));
	assert.ok(json.data.content.includes('<:xdad:1419602524545093692> Highest result per mission: <@99> with 1,200 kills'));
	assert.ok(json.data.content.includes('**Time left**:'));
	assert.ok(json.data.content.includes('Use `/submit` to contribute your kill count'));
});
