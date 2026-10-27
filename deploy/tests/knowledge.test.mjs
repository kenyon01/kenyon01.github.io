import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChapterTree, buildHeadingTree, sortedDirectoryRows } from '../../assets/js/knowledge.mjs';

test('chapters group arbitrary nesting, preserve duplicates across branches and use article order', () => {
  const tree = buildChapterTree([
    { title: 'B', path: ['第二章', '概念'], order: 20 },
    { title: 'A', path: ['第一章', '概念'], order: 10 },
    { title: 'C', path: ['第一章', '概念'], order: 12 },
    { title: 'Direct', path: null, order: 5 },
  ]);
  assert.equal(tree.articles[0].title, 'Direct');
  assert.equal(tree.chapters.get('第一章').order, 10);
  assert.equal(tree.chapters.get('第一章').chapters.get('概念').articles.length, 2);
  assert.equal(tree.chapters.get('第二章').chapters.get('概念').articles.length, 1);
});
test('user labels cannot affect prototypes and malformed legacy paths remain readable', () => {
  const tree = buildChapterTree([
    { title: 'Special', path: ['__proto__', 'constructor'], order: 1 },
    { title: 'Legacy', path: 'not-an-array' },
    { title: 'Deep', path: Array.from({ length: 20 }, (_, index) => String(index)) },
  ]);
  assert.equal(tree.chapters.get('__proto__').chapters.get('constructor').articles[0].title, 'Special');
  assert.equal(tree.articles[0].title, 'Legacy');
  let node = tree.chapters.get('0');
  for (let depth = 1; depth < 8; depth++) node = node.chapters.get(String(depth));
  assert.equal(node.articles[0].title, 'Deep');
  assert.equal(node.chapters.size, 0);
});
test('right outline nests skipped heading levels and returns to the correct parent', () => {
  const tree = buildHeadingTree([
    { id: 'a', title: 'A', level: 2 }, { id: 'b', title: 'B', level: 4 },
    { id: 'c', title: 'C', level: 3 }, { id: 'd', title: 'D', level: 2 },
    { id: 'e', title: 'E', level: 6 },
  ]);
  assert.deepEqual(tree.map(item => item.id), ['a', 'd']);
  assert.deepEqual(tree[0].children.map(item => item.id), ['b', 'c']);
  assert.equal(tree[1].children[0].id, 'e');
  assert.deepEqual(buildHeadingTree([]), []);
});
test('Chinese chapter numbers sort naturally while explicit order takes priority', () => {
  const tree = buildChapterTree(['第十章', '第二章', '第一章', '第十一章'].map(title => ({ title, path: [title], order: 50 })));
  assert.deepEqual(sortedDirectoryRows(tree).map(row => row.title), ['第一章', '第二章', '第十章', '第十一章']);
  const ordered = buildChapterTree([{ title: 'A', path: ['第二章'], order: 1 }, { title: 'B', path: ['第一章'], order: 5 }]);
  assert.equal(sortedDirectoryRows(ordered)[0].title, '第二章');
});
