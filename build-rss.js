/**
 * 生成 RSS 订阅源：node build-rss.js
 * 优先从后端 /api/posts 拉取文章（若 config.js 的 apiUrl 已配置且后端可达）；
 * 否则回退到 assets/js/posts.js 静态内容。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;

const configSrc = fs.readFileSync(path.join(root, 'assets', 'js', 'config.js'), 'utf8');
const postsSrc = fs.readFileSync(path.join(root, 'assets', 'js', 'posts.js'), 'utf8');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(configSrc, sandbox);
vm.runInContext(postsSrc, sandbox);

const SITE = sandbox.window.SITE || {};
const STATIC_POSTS = sandbox.window.POSTS || [];

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rssDate(dateStr) {
  const parts = (dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [y, m, d] = parts;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dt = new Date(y, m - 1, d);
  return `${days[dt.getDay()]}, ${String(d).padStart(2, '0')} ${months[m - 1]} ${y} 00:00:00 +0800`;
}

function build(POSTS) {
  const baseUrl = (SITE.url || 'https://example.com').replace(/\/+$/, '');
  const items = POSTS.map((p) => {
    const link = `${baseUrl}/article.html?id=${encodeURIComponent(p.id)}`;
    const tags = (p.tags || []).map((t) => `<category>${escapeXml(t)}</category>`).join('');
    return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${rssDate(p.date)}</pubDate>
      <description>${escapeXml(p.excerpt || '')}</description>
${tags}
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name || '博客')}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(SITE.description || '')}</description>
    <language>zh-CN</language>
    <lastBuildDate>${rssDate(new Date().toISOString().slice(0, 10))}</lastBuildDate>
    <atom:link href="${escapeXml(baseUrl + '/rss.xml')}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

(async function main() {
  let POSTS = STATIC_POSTS;
  let source = 'posts.js';
  const apiUrl = (SITE.apiUrl || '').replace(/\/+$/, '');
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl + '/api/posts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.posts)) {
          POSTS = data.posts;
          source = '后端 /api/posts';
        }
      }
    } catch (e) {
      // 后端不可达，回退静态
    }
  }
  POSTS = POSTS.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  fs.writeFileSync(path.join(root, 'rss.xml'), build(POSTS), 'utf8');
  console.log(`✅ 已生成 rss.xml，共 ${POSTS.length} 篇文章（来源：${source}）。`);
})();
