const reportURL = /^https:\/\/www\.nlearn\.net\/robot-media\/reports\/[a-f0-9]{64}\/index\.html$/;

/** Only the sandboxed report's own window can change its displayed height. */
export function applyReportMessage(event, frames) {
  if (event.data?.type !== 'robot-report-size' || !Number.isFinite(event.data.height) || event.data.height < 100 || event.data.height > 50000) return false;
  const frame = [...frames].find(item => item.contentWindow === event.source && reportURL.test(item.src));
  if (!frame) return false;
  frame.style.height = `${Math.ceil(event.data.height) + 16}px`;
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', event => applyReportMessage(event, document.querySelectorAll('[data-html-report]')));
}
