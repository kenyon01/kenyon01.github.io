(() => {
  const tools = document.querySelector('[data-robotics-tools]');
  if (!tools) return;
  const search = document.querySelector('[data-robotics-search]');
  const cards = [...document.querySelectorAll('[data-robotics-note]')];
  const buttons = [...document.querySelectorAll('[data-topic]')];
  const topics = { interfaces: '感知与接口', control: '策略与控制', physics: '仿真与接触', method: '实验方法' };
  const index = cards.map(card => ({ card, text: card.textContent.toLocaleLowerCase(), tags: card.dataset.tags.split(' ') }));
  let selected = 'all';
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    index.forEach(({ card, text, tags }) => {
      const matches = (selected === 'all' || tags.includes(topics[selected])) && text.includes(query);
      card.hidden = !matches;
      if (matches) count += 1;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === selected)));
    document.querySelector('[data-robotics-count]').textContent = '显示 ' + count + ' / ' + cards.length + ' 篇笔记';
    document.querySelector('[data-robotics-empty]').hidden = count > 0;
  };
  const readHash = () => {
    const key = location.hash.replace(/^#topic-/, '');
    if (Object.hasOwn(topics, key)) {
      selected = key;
      search.value = '';
      filter();
      document.getElementById('notebook').scrollIntoView();
    }
  };
  buttons.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.topic;
    history.replaceState(null, '', selected === 'all' ? '#notebook' : '#topic-' + selected);
    filter();
  }));
  search.addEventListener('input', filter);
  window.addEventListener('hashchange', readHash);
  tools.hidden = false;
  filter();
  readHash();
})();
