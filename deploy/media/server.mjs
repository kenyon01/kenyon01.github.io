import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rename, unlink, stat, statfs, chmod } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
export const PUBLIC_BASE = 'https://www.nlearn.net/robot-media/videos/';
const fail = (status, message) => Object.assign(new Error(message), { status });

export async function authorize(token) {
  if (!/^[A-Za-z0-9_]{20,256}$/.test(token)) throw fail(401, '请先登录写作后台。');
  let response;
  try {
    response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Qingyan-video-upload', Accept: 'application/vnd.github+json' },
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
  } catch { throw fail(503, '暂时无法验证登录，请稍后重试。'); }
  if (response.status === 401) throw fail(401, '登录已过期，请重新登录。');
  if (!response.ok) throw fail(503, '暂时无法验证登录，请稍后重试。');
  if ((await response.json()).id !== 49362778) throw fail(403, '只有站主可以上传视频。');
}

export async function probe(file) {
  let output;
  try {
    output = await exec('/usr/bin/ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_streams', '-show_format', '-of', 'json', file], { timeout: 20000, maxBuffer: 1024 * 1024 });
  } catch { throw fail(415, '无法读取视频，请使用 H.264 编码的 MP4 文件。'); }
  const media = JSON.parse(output.stdout);
  const video = media.streams?.find(s => s.codec_type === 'video');
  if (!media.format?.format_name?.includes('mp4') || video?.codec_name !== 'h264' || !['yuv420p', 'yuvj420p'].includes(video?.pix_fmt) || media.streams.some(s => s.codec_type === 'audio' && s.codec_name !== 'aac')) {
    throw fail(415, '请使用 H.264（8 位）视频、AAC 音频的 MP4 文件，以兼容网页播放。');
  }
}

export async function createMediaServer({ root, authenticate = authorize, inspect = probe, maxFile = 200 * 1024 ** 2, maxTotal = 8 * 1024 ** 3, minFree = 5 * 1024 ** 3 } = {}) {
  const videos = path.join(root, 'videos');
  const temp = path.join(root, 'tmp');
  const metadata = path.join(root, 'metadata');
  for (const directory of [videos, temp, metadata]) await mkdir(directory, { recursive: true, mode: 0o750 });
  // Only this service owns this directory. Remove interrupted, unpublished uploads on startup.
  for (const name of await readdir(temp)) if (/^[a-f0-9-]+\.part$/.test(name)) await unlink(path.join(temp, name));
  let uploading = false;
  let authenticating = 0;
  const server = http.createServer(async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Connection: 'close' });
      res.end(JSON.stringify(data));
    };
    const origin = req.headers.origin;
    if (origin === 'https://kenyon01.github.io') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (origin) return reply(403, { error: '不允许从这个网站上传。' });
    if (req.url !== '/robot-media/api/videos') return reply(404, { error: 'Not found' });
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name');
      res.setHeader('Access-Control-Max-Age', '600');
      return reply(204, null);
    }
    if (!['GET', 'POST'].includes(req.method)) return reply(405, { error: 'Method not allowed' });
    let temporary;
    let ownsLock = false;
    try {
      if (authenticating >= 4) throw fail(429, '请求较多，请稍后重试。');
      authenticating++;
      try { await authenticate((req.headers.authorization || '').replace(/^Bearer /, '')); }
      finally { authenticating--; }
      if (req.method === 'GET') {
        const records = [];
        for (const name of await readdir(metadata)) {
          if (/^[a-f0-9]{64}\.json$/.test(name)) records.push(JSON.parse(await readFile(path.join(metadata, name), 'utf8')));
        }
        return reply(200, { videos: records.sort((a, b) => b.created.localeCompare(a.created)) });
      }
      if (uploading) throw fail(409, '另一个视频正在上传，请完成后再试。');
      uploading = ownsLock = true;
      if (req.headers['content-type'] !== 'video/mp4') throw fail(415, '仅支持 MP4 视频。');
      const size = Number(req.headers['content-length']);
      if (!Number.isSafeInteger(size) || size <= 0) throw fail(411, '缺少视频大小。');
      if (size > maxFile) throw fail(413, '单个视频最多 200MB。');
      const names = (await readdir(videos)).filter(n => /^[a-f0-9]{64}\.mp4$/.test(n));
      const used = (await Promise.all(names.map(n => stat(path.join(videos, n))))).reduce((sum, s) => sum + s.size, 0);
      const disk = await statfs(root);
      if (used + size > maxTotal || disk.bavail * disk.bsize - size < minFree) throw fail(507, '视频空间不足，请联系站主整理文件。');
      let originalName;
      try { originalName = decodeURIComponent(req.headers['x-file-name'] || 'video.mp4').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160); }
      catch { throw fail(400, '文件名无效。'); }
      const hash = createHash('sha256');
      let received = 0;
      temporary = path.join(temp, `${randomUUID()}.part`);
      const meter = new Transform({ transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > size || received > maxFile) return callback(fail(413, '视频超出大小限制。'));
        hash.update(chunk); callback(null, chunk);
      } });
      await pipeline(req, meter, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
      if (received !== size) throw fail(400, '上传不完整，请重试。');
      await inspect(temporary);
      const id = hash.digest('hex');
      const record = { url: `${PUBLIC_BASE}${id}.mp4`, name: originalName, size, created: new Date().toISOString() };
      await chmod(temporary, 0o640);
      await rename(temporary, path.join(videos, `${id}.mp4`));
      temporary = undefined;
      const metadataTemp = path.join(temp, `${randomUUID()}.part`);
      try {
        await writeFile(metadataTemp, JSON.stringify(record), { mode: 0o600 });
        await rename(metadataTemp, path.join(metadata, `${id}.json`));
      } finally { await unlink(metadataTemp).catch(() => {}); }
      reply(201, record);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) reply(error.status || 500, { error: error.status ? error.message : '上传服务暂时不可用，请重试。' });
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
      if (ownsLock) uploading = false;
    }
  });
  server.requestTimeout = 15 * 60 * 1000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createMediaServer({ root: process.env.MEDIA_ROOT || '/opt/robot-learning/media' });
  server.listen(8098, '127.0.0.1');
}
