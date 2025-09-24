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

// Stub for the statistics database used by highscores and submit
function createFakeDB() {
	return {
		prepare() {
			return {
				bind() {
					return this;
				},
				all: async () => ({ results: [] }),
			};
		},
		batch: async () => {},
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

test('submit command executes with stub DB', async () => {
	const env = { STATISTICS_DB: createFakeDB(), HELLDADS_CURRENT_EVENT_KEY: 'test' };
	const interaction = {
		data: { options: [{ name: 'sporelungs', value: 5 }] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('<@1> destroyed 5 Spore Lungs.'));
});

test('submit command fails with no active event', async () => {
	const env = { HELLDADS_CURRENT_EVENT_KEY: '' };
	const interaction = {
		data: { options: [] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('No event is currently active.'));
});

test('submit command fails with no options', async () => {
	const env = { HELLDADS_CURRENT_EVENT_KEY: 'test' };
	const interaction = {
		data: { options: [] },
		member: { user: { id: '1', username: 'Tester' } },
	};
	const res = await submitHandler(interaction, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('Error: Provide Spore Lungs or Eggs Sites destroyed.'));
});

test('event command aggregates event results', async () => {
	function createEventDB() {
		return {
			prepare(sql) {
				return {
					bind() {
						return this;
					},
					all: async () => {
						if (sql.includes('GROUP BY')) {
							return {
								results: [
									{ user: '1', name: 'Max', lungs: 80, eggs: 20 },
									{ user: '2', lungs: 20, eggs: 30 },
								],
							};
						}
						return { results: [{ lungs: 100, eggs: 50 }] };
					},
				};
			},
		};
	}
	const env = { STATISTICS_DB: createEventDB(), HELLDADS_CURRENT_EVENT_KEY: 'lungpunch' };
	const res = await eventHandler({ data: {} }, env, {});
	const json = await readJson(res);
	assert.ok(json.data.content.includes('OPERATION: LUNGPUNCH'));
	assert.ok(json.data.content.includes('Total Spore Lungs destroyed: 100'));
	assert.ok(json.data.content.includes('Max'));
	assert.ok(json.data.content.includes('<@2>'));
});
