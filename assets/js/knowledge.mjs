const compareText = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });
const chapterNumber = label => {
  const match = label.match(/^第([一二三四五六七八九十百千零〇两\d]+)[章节篇]/);
  if (!match) return undefined;
  if (/^\d+$/.test(match[1])) return Number(match[1]);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let digit = 0;
  for (const character of match[1]) {
    if (Object.hasOwn(units, character)) { total += (digit || 1) * units[character]; digit = 0; }
    else digit = digits[character] || 0;
  }
  return total + digit;
};

export function sortedDirectoryRows(node) {
  return [
    ...[...node.chapters.values()].map(chapter => ({ kind: 'chapter', order: chapter.order, title: chapter.label, chapter })),
    ...node.articles.map(article => ({ kind: 'article', order: article.order, title: article.title, article })),
  ].sort((a, b) => {
    const first = chapterNumber(a.title);
    const second = chapterNumber(b.title);
    return a.order - b.order || (first !== undefined && second !== undefined ? first - second : 0) || compareText(a.title, b.title);
  });
}

/** Build a chapter tree without treating user-provided labels as object properties. */
export function buildChapterTree(records) {
  const root = { chapters: new Map(), articles: [], order: Infinity };
  records.forEach(record => {
    const order = Number.isFinite(Number(record.order)) ? Number(record.order) : 50;
    const labels = Array.isArray(record.path)
      ? record.path.filter(label => typeof label === 'string' && label.trim()).slice(0, 8).map(label => label.trim())
      : [];
    let node = root;
    node.order = Math.min(node.order, order);
    labels.forEach(label => {
      if (!node.chapters.has(label)) node.chapters.set(label, { label, chapters: new Map(), articles: [], order: Infinity });
      node = node.chapters.get(label);
      node.order = Math.min(node.order, order);
    });
    node.articles.push({ ...record, order });
  });
  return root;
}

/** Preserve heading hierarchy even when an article skips a heading level. */
export function buildHeadingTree(headings) {
  const root = { level: 0, children: [] };
  const stack = [root];
  headings.forEach(heading => {
    while (stack.length > 1 && stack.at(-1).level >= heading.level) stack.pop();
    const node = { ...heading, children: [] };
    stack.at(-1).children.push(node);
    stack.push(node);
  });
  return root.children;
}

function initializeReader() {
  const reader = document.querySelector('[data-knowledge-reader]');
  if (!reader) return;
  document.documentElement.classList.add('knowledge-page');
  const header = document.querySelector('[data-header]');
  const setHeaderHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header?.getBoundingClientRect().height || 72}px`);
  setHeaderHeight();
  if ('ResizeObserver' in window && header) new ResizeObserver(setHeaderHeight).observe(header);

  const directory = reader.querySelector('[data-directory]');
  const search = reader.querySelector('[data-directory-search]');
  const status = reader.querySelector('[data-directory-status]');
  const list = directory.querySelector('[data-chapter-list]');
  const empty = directory.querySelector('[data-directory-empty]');
  const records = [...list.querySelectorAll('[data-directory-article]')].map(link => {
    let path = [];
    try { path = JSON.parse(link.dataset.chapters); } catch { /* Legacy articles have no path. */ }
    return { link, title: link.textContent, order: Number(link.dataset.order), path };
  });
  const total = records.length;
  const matches = (record, query) => `${Array.isArray(record.path) ? record.path.join(' ') : ''} ${record.title}`.toLocaleLowerCase().includes(query);
  let chapterOpenState = new Map();
  let searching = false;

  function renderBranch(node, parent, topicKey, path, searchingNow) {
    const rows = sortedDirectoryRows(node);
    rows.forEach(row => {
      if (row.kind === 'article') {
        parent.append(row.article.link);
        return;
      }
      const chapter = row.chapter;
      const nextPath = [...path, chapter.label];
      const key = JSON.stringify([topicKey, ...nextPath]);
      const details = document.createElement('details');
      details.className = 'directory-chapter';
      details.dataset.chapterKey = key;
      const summary = document.createElement('summary');
      const icon = document.createElement('span');
      icon.className = 'directory-folder-icon';
      icon.setAttribute('aria-hidden', 'true');
      summary.append(icon, document.createTextNode(chapter.label));
      const children = document.createElement('div');
      children.className = 'directory-children';
      renderBranch(chapter, children, topicKey, nextPath, searchingNow);
      details.append(summary, children);
      details.open = searchingNow || chapterOpenState.get(key) === true || (chapterOpenState.get(key) === undefined && (path.length === 0 || !!children.querySelector('[aria-current="page"]')));
      parent.append(details);
    });
  }

  function renderDirectory() {
    const query = search.value.trim().toLocaleLowerCase();
    if (query && !searching) {
      chapterOpenState = new Map([...directory.querySelectorAll('[data-chapter-key]')].map(element => [element.dataset.chapterKey, element.open]));
    }
    const shown = query ? records.filter(record => matches(record, query)) : records;
    list.replaceChildren();
    renderBranch(buildChapterTree(shown), list, directory.dataset.topicKey, [], !!query);
    status.textContent = query ? `找到 ${shown.length} / ${total} 篇文章` : `共 ${total} 篇文章`;
    empty.hidden = shown.length > 0;
    empty.textContent = query ? '当前栏目没有匹配的章节或文章' : '当前栏目暂无文章';
    searching = !!query;
  }
  renderDirectory();
  search.addEventListener('input', renderDirectory);

  const content = reader.querySelector('[data-reader-content]');
  const headings = [...content.querySelectorAll('h2, h3, h4, h5, h6')].filter(heading => !heading.closest('[data-robotics-note]'));
  const toc = reader.querySelector('[data-toc]');
  const headingData = headings.map((heading, index) => {
    let id = heading.id || `reader-section-${index + 1}`;
    while (document.getElementById(id) && document.getElementById(id) !== heading) id += '-section';
    heading.id = id;
    return { id, level: Number(heading.tagName.slice(1)), title: heading.textContent };
  });
  const links = new Map();
  function appendHeadingList(nodes, parent) {
    const list = document.createElement('ol');
    nodes.forEach(node => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${encodeURIComponent(node.id)}`;
      link.textContent = node.title;
      links.set(node.id, link);
      item.append(link);
      if (node.children.length) appendHeadingList(node.children, item);
      list.append(item);
    });
    parent.append(list);
  }
  if (headings.length) {
    appendHeadingList(buildHeadingTree(headingData), toc);
    reader.querySelector('[data-outline-title]').textContent = content.querySelector('h1')?.textContent || '';
    reader.querySelector('[data-outline]').hidden = false;
  }
  let scrollScheduled = false;
  function updateHeading() {
    scrollScheduled = false;
    const offset = (header?.getBoundingClientRect().height || 72) + 40;
    let active = headings[0];
    headings.forEach(heading => { if (heading.getBoundingClientRect().top <= offset) active = heading; });
    links.forEach((link, id) => {
      if (id === active?.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  const schedule = () => {
    if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateHeading); }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  content.querySelectorAll('img, video').forEach(media => media.addEventListener('load', schedule));
  updateHeading();

  const small = window.matchMedia('(max-width: 800px)');
  const narrow = window.matchMedia('(max-width: 1000px)');
  const setPanels = () => {
    reader.querySelector('[data-directory-panel]').open = !small.matches;
    reader.querySelector('[data-outline-panel]').open = !narrow.matches;
  };
  small.addEventListener('change', setPanels);
  narrow.addEventListener('change', setPanels);
  setPanels();
}

if (typeof document !== 'undefined') initializeReader();
