import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMediaServer } from './server.mjs';

test('authenticated uploads, public URLs, quotas and failure cleanup', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'robot-media-test-'));
  const server = await createMediaServer({
    root, maxFile: 100, maxTotal: 150, minFree: 0,
    authenticate: async token => { if (token !== 'test-owner') throw Object.assign(new Error('unauthorized'), { status: 401 }); },
    inspect: async file => { if ((await readFile(file)).toString().startsWith('bad')) throw Object.assign(new Error('invalid video'), { status: 415 }); },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/robot-media/api/videos`;
  const headers = { Authorization: 'Bearer test-owner', 'Content-Type': 'video/mp4', Origin: 'https://kenyon01.github.io', 'X-File-Name': encodeURIComponent('实验.mp4') };
  try {
    assert.equal((await fetch(endpoint)).status, 401);
    assert.equal((await fetch(endpoint, { headers: { ...headers, Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: 'anonymous' })).status, 401);
    const preflight = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: headers.Origin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), headers.Origin);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/html' }, body: 'x' })).status, 415);
    assert.equal((await fetch(endpoint, { method: 'POST', headers, body: 'x'.repeat(101) })).status, 413);
    assert.equal((await fetch(endpoint, { method: 'POST', headers, body: 'bad file' })).status, 415);
    assert.deepEqual(await readdir(path.join(root, 'tmp')), []);
    assert.deepEqual(await readdir(path.join(root, 'videos')), []);
    const response = await fetch(endpoint, { method: 'POST', headers, body: 'x'.repeat(90) });
    assert.equal(response.status, 201);
    const record = await response.json();
    assert.match(record.url, /^https:\/\/www\.nlearn\.net\/robot-media\/videos\/[a-f0-9]{64}\.mp4$/);
    assert.equal(record.name, '实验.mp4');
    const listing = await fetch(endpoint, { headers });
    assert.equal((await listing.json()).videos.length, 1);
    assert.equal((await fetch(endpoint, { method: 'POST', headers, body: 'y'.repeat(80) })).status, 507);
    assert.deepEqual(await readdir(path.join(root, 'tmp')), []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
