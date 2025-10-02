import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchJsonWithTimeout } from '../src/lib/fetch.js';

test('fetchJsonWithTimeout resolves before timeout', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  }).listen(0);
  const url = `http://localhost:${server.address().port}`;
  try {
    const data = await fetchJsonWithTimeout(url, 1000);
    assert.deepEqual(data, { ok: true });
  } finally {
    server.close();
  }
});

test('fetchJsonWithTimeout rejects on timeout', async () => {
  const server = http.createServer((req, res) => {
    setTimeout(() => {
      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    }, 200);
  }).listen(0);
  const url = `http://localhost:${server.address().port}`;
  try {
    await assert.rejects(
      fetchJsonWithTimeout(url, 50),
      err => err.name === 'AbortError'
    );
  } finally {
    server.close();
  }
});
