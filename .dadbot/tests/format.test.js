import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatDataTable } from '../src/lib/format.js';

test('formatNumber adds thousand separators', () => {
	assert.equal(formatNumber(1234567), '1,234,567');
});

test('formatDataTable formats data into a table', () => {
	const columns = ['name', 'score'];
	const data = [
		{ name: 'John Helldiver', score: 10 },
		{ name: 'DadBot', score: 20 },
	];
	const table = formatDataTable(columns, data);
	assert.ok(table.startsWith('```text'));
	assert.ok(table.includes('DadBot'));
	assert.ok(table.includes('20'));
	assert.ok(table.endsWith('```'));
});
