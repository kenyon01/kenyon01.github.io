import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReportMessage } from '../../assets/js/report-embed.mjs';

test('only the matching sandboxed report window can resize its iframe', () => {
  const source = {};
  const frame = {src: `https://www.nlearn.net/robot-media/reports/${'a'.repeat(64)}/index.html`, contentWindow: source, style: {}};
  const event = {source, data: {type: 'robot-report-size', height: 2500.2}};
  assert.equal(applyReportMessage({...event, source: {}}, [frame]), false);
  assert.equal(applyReportMessage(event, [{...frame, src: 'https://example.com/report.html'}]), false);
  assert.equal(applyReportMessage(event, [frame]), true);
  assert.equal(frame.style.height, '2517px');
  for (const height of [-1, 0, Infinity, NaN, 60000, '1000']) {
    assert.equal(applyReportMessage({...event, data: {...event.data, height}}, [frame]), false);
  }
});
