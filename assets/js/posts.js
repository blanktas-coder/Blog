/**
 * 文章数据文件
 *
 * 每一篇文章是一个对象：
 *   id       唯一标识（用于 URL 和评论存储，请使用英文短横线，如 my-first-post）
 *   title    标题
 *   date     发布日期（YYYY-MM-DD）
 *   tags     标签数组
 *   category 分类
 *   excerpt  摘要（显示在首页卡片上）
 *   content  Markdown 正文（用模板字符串书写）
 *
 * 添加新文章：复制一个对象，修改字段，插入 POSTS 数组即可。
 * 注意：正文里的反引号 ` 需要写成 \`，美元符 + 大括号 ${ 需要写成 \${。
 * 代码块建议用 ~~~ 围栏（与 ``` 等价），避免与模板字符串反引号冲突。
 */
window.POSTS = [
  {
    id: 'hello-world',
    title: '你好，世界 —— 欢迎来到我的博客',
    date: '2025-01-01',
    tags: ['随笔'],
    category: '随笔',
    excerpt: '这是一篇开站文章，介绍这个博客的由来、技术选型和功能特性。',
    content: `
欢迎来到我的博客！这是一个**纯静态、零依赖**的个人博客，打开即用，无需服务器。

## 为什么做这个博客

写博客是我整理思绪、沉淀知识的方式。这个站点满足我几个朴素的愿望：

- **快**：纯静态页面，秒开；
- **简单**：用 Markdown 写作，专注内容本身；
- **可控**：代码完全自己掌控，数据就放在本地；
- **好看**：支持浅色 / 深色主题，阅读体验舒适。

## 这个博客有什么

- Markdown 文章渲染与代码高亮
- 标签 / 分类浏览
- 站内全文搜索
- 深色模式（自动跟随系统 + 手动切换）
- 评论区（本地存储，开箱即用）
- RSS 订阅（rss.xml）
- 文章内嵌视频 / 音频

## 从这里开始

- 阅读 [Markdown 写作指南](#/article.html?id=markdown-guide) 了解支持的语法；
- 看看 [视频与音频嵌入演示](#/article.html?id=media-demo)；
- 在右上角切换深色模式试试。

> 写作是一件需要坚持的小事，愿我们都能持续记录、持续成长。

如果你喜欢这个博客，欢迎把它推荐给朋友，或者直接拿去二次开发。
`
  },
  {
    id: 'markdown-guide',
    title: 'Markdown 写作指南：本站支持的语法',
    date: '2025-01-05',
    tags: ['教程', 'Markdown'],
    category: '教程',
    excerpt: '一篇完整的 Markdown 语法速查，覆盖标题、列表、表格、代码块、引用、链接、图片等本站支持的写法。',
    content: `
这篇文章演示本博客支持的 **Markdown 语法**，可作为写作时的速查手册。

## 标题

从一级到六级标题，用 \`#\` 表示：

~~~
# 一级标题
## 二级标题
### 三级标题
#### 四级标题
##### 五级标题
###### 六级标题
~~~

## 强调

- **粗体**：\`**粗体**\` 或 \`__粗体__\`
- *斜体*：\`*斜体*\`
- ~~删除线~~：\`~~删除线~~\`
- \`行内代码\`：用一对反引号包裹

## 列表

无序列表：

- 苹果
- 香蕉
- 橙子

有序列表：

1. 第一步
2. 第二步
3. 第三步

## 引用

> 学而不思则罔，思而不学则殆。
>
> ——《论语》

## 分隔线

用三个或以上的 \`---\` 表示：

---

## 链接与图片

链接：\`[本站首页](index.html)\` → [本站首页](index.html)

图片：\`![替代文字](https://picsum.photos/seed/blog/800/400)\`

![示例图片](https://picsum.photos/seed/blog/800/400)

## 表格

| 功能 | 说明 | 状态 |
| --- | --- | --- |
| 深色模式 | 自动跟随系统，可手动切换 | ✅ |
| 全文搜索 | 按标题、摘要、正文检索 | ✅ |
| RSS 订阅 | rss.xml 输出 | ✅ |

## 代码块

用 \`~~~\` 或 \`\`\` 围栏包裹，可指定语言：

~~~javascript
function greet(name) {
  const message = \`你好，\${name}！\`;
  console.log(message); // 输出问候
  return message;
}

greet('世界');
~~~

行内代码用单个反引号：\`const x = 1\`。

## 视频与音频

本站在标准语法之外增加了媒体扩展，详见 [视频与音频嵌入演示](article.html?id=media-demo)
`
  },
  {
    id: 'media-demo',
    title: '视频与音频嵌入演示',
    date: '2025-01-10',
    tags: ['演示', '多媒体'],
    category: '演示',
    excerpt: '演示如何在文章里嵌入视频和音频：使用 @[video](url) / @[audio](url) 快捷语法，或直接写原生 HTML 标签。',
    content: `
本站支持在文章中嵌入**视频**和**音频**，有两种写法。

## 快捷语法

使用 \`@[video](地址)\` 或 \`@[audio](地址)\`：

@[video](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)

@[audio](https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3)

## 原生 HTML 写法

也可以直接写 \`<video>\` / \`<audio>\` 标签，获得更多控制（如封面、尺寸、自动播放等）：

<video controls width="100%" poster="https://picsum.photos/seed/poster/800/450" preload="metadata" src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"></video>

<audio controls src="https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3"></audio>

## 嵌入第三方视频

任何 iframe 都能透传，例如把视频网站的"分享 → 嵌入"代码直接粘贴进来即可：

<iframe width="100%" height="400" src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="示例视频" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

> 提示：示例媒体文件来自 MDN 官方示例，需要联网才能加载。替换成你自己的视频 / 音频地址即可。
`
  },
  {
    id: 'build-markdown-parser',
    title: '从零写一个轻量 Markdown 解析器',
    date: '2025-01-18',
    tags: ['技术', 'JavaScript'],
    category: '技术',
    excerpt: '不依赖任何库，用 JavaScript 手写一个够用的 Markdown 解析器：从围栏代码块提取到行内语法，思路与代码全记录。',
    content: `
这个博客的 Markdown 渲染**不依赖任何第三方库**，解析器是手写的，只有几百行。本文记录一下核心思路。

## 整体思路

解析分为两个阶段：

1. **块级解析**：把正文切成"标题、段落、列表、引用、代码块、表格"等块；
2. **行内解析**：在每个块内部处理"粗体、斜体、链接、行内代码"等。

## 第一步：提取代码块

代码块里的内容要原样保留、不能被行内规则破坏，所以**最先**用占位符把它们抽出来：

~~~javascript
function extractCodeBlocks(md) {
  const blocks = [];
  md = md.replace(/^\`\`\`([^\\n\`]*)\\n([\\s\\S]*?)^\`\`\`/gm, (m, lang, code) => {
    const idx = blocks.length;
    blocks.push({ lang: lang.trim(), code });
    return '\\u0000CODE' + idx + '\\u0000';
  });
  return { md, blocks };
}
~~~

这样后续处理就不会碰到代码块里的特殊字符了。

## 第二步：逐行切块

~~~javascript
const lines = md.split('\\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^#{1,6}\\s+/.test(line)) { /* 标题 */ }
  else if (/^\\s*[-*+]\\s+/.test(line)) { /* 无序列表 */ }
  else if (/^\\s*>\\s?/.test(line)) { /* 引用 */ }
  else if (/^\\s*\\|.*\\|\\s*$/.test(line)) { /* 表格 */ }
  else { /* 段落，一直读到空行或下一个块 */ }
}
~~~

## 第三步：行内语法

行内处理的关键是**占位符 + 依次替换**，先处理"优先级最高"的行内代码，再处理图片、链接、强调：

~~~javascript
function inline(text) {
  const tokens = [];
  // 行内代码：\`code\` → 占位符
  text = text.replace(/\`([^\`\\n]+)\`/g, m => stash(tokens, '<code>' + escape(m) + '</code>'));
  // 图片、链接……
  // 粗体、斜体、删除线……
  return restore(text, tokens); // 还原占位符
}
~~~

## 小结

手写解析器不必追求覆盖所有 Markdown 规范，**够用、可控、零依赖**就是最大的价值。完整实现见本站 \`assets/js/markdown.js\`。
`
  },
  {
    id: 'reading-list-2025',
    title: '2025 年度书单：那些值得反复读的书',
    date: '2025-02-02',
    tags: ['阅读', '生活'],
    category: '生活',
    excerpt: '整理过去一年读过的书，挑出几本真正改变我思维方式的作品，附一句话推荐理由。',
    content: `
过去一年读了几十本书，真正想反复读的不多。挑五本记录如下，权当给自己留个书签。

## 1. 《置身事内》

> 读懂中国经济，必须读懂中国政府。

讲清了"土地财政""地方政府竞争"这些宏大概念的来龙去脉。读完之后，新闻里的很多名词突然变得清晰了。

## 2. 《思考，快与慢》

关于人类认知偏差的经典。**系统 1 和系统 2** 的框架几乎是理解一切决策行为的钥匙。

- 锚定效应
- 损失厌恶
- 可得性启发

## 3. 《你当像鸟飞往你的山》

一本关于**教育与自我重建**的回忆录，文字极其动人。

## 4. 《代码整洁之道》

技术书也要常读常新。命名、函数、注释这些"小事"，决定了代码的长期可维护性。

## 5. 《被讨厌的勇气》

阿德勒心理学的通俗读物，核心观点值得记住：

1. 课题分离；
2. 接纳自我；
3. 活在当下。

---

> 读书不是为了记住，而是为了在某一个瞬间，突然理解了自己和生活。

新的一年，继续读下去。
`
  }
];
