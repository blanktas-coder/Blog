/**
 * 文章页逻辑：渲染正文、代码高亮已由解析器处理、评论（本地存储）、前后篇导航、阅读进度
 */
(function () {
  'use strict';

  var esc = window.App.esc;

  function getPostId() {
    var id = window.App.urlParam('id');
    if (!id) {
      // 兼容 hash 路由：#/article.html?id=xxx
      var m = window.location.hash.match(/id=([^&#]+)/);
      if (m) id = decodeURIComponent(m[1]);
    }
    return id;
  }

  function renderHeader(post) {
    var el = document.getElementById('article-header');
    if (!el) return;
    var tags = (post.tags || []).map(function (t) {
      return '<a class="chip" href="index.html?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
    }).join('');
    var cat = post.category
      ? '<a class="chip chip-cat" href="index.html?cat=' + encodeURIComponent(post.category) + '">' + esc(post.category) + '</a>'
      : '';
    var time = window.App.readingTime(post.content);

    el.innerHTML =
      '<div class="article-meta-top">' + cat + tags + '</div>' +
      '<h1 class="article-title">' + esc(post.title) + '</h1>' +
      '<div class="article-meta">' +
        '<time datetime="' + esc(post.date) + '">' + esc(window.App.formatDate(post.date)) + '</time>' +
        '<span class="dot">·</span>' +
        '<span>' + time + ' 分钟阅读</span>' +
        '<span class="dot">·</span>' +
        '<span>' + esc(window.SITE.author || window.SITE.name || '') + '</span>' +
      '</div>';

    document.title = (post.title || '文章') + ' · ' + (window.SITE.name || '博客');
  }

  function renderContent(post) {
    var el = document.getElementById('article-content');
    if (!el) return;
    var html = window.Markdown.parse(post.content || '');
    el.innerHTML = html;

    // 给所有标题生成锚点 id，方便跳转
    el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (h, i) {
      if (!h.id) h.id = 'heading-' + (i + 1);
    });

    // 给代码块加语言标签
    el.querySelectorAll('pre code').forEach(function (code) {
      var pre = code.parentElement;
      var langClass = code.className.match(/lang-(\S+)/);
      if (langClass) {
        var label = document.createElement('span');
        label.className = 'code-lang';
        label.textContent = langClass[1];
        pre.appendChild(label);
      }
    });

    // 外链新窗口打开
    el.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function renderNav(post) {
    var el = document.getElementById('article-nav');
    if (!el) return;
    var posts = window.App.sortedPosts();
    var idx = posts.findIndex(function (p) { return p.id === post.id; });
    if (idx === -1) { el.innerHTML = ''; return; }

    var prev = posts[idx + 1]; // 更旧的
    var next = posts[idx - 1]; // 更新的
    var parts = [];
    if (next) {
      parts.push('<a class="nav-item" href="article.html?id=' + encodeURIComponent(next.id) + '"><span class="nav-label">← 上一篇</span><span class="nav-title">' + esc(next.title) + '</span></a>');
    }
    if (prev) {
      parts.push('<a class="nav-item nav-next" href="article.html?id=' + encodeURIComponent(prev.id) + '"><span class="nav-label">下一篇 →</span><span class="nav-title">' + esc(prev.title) + '</span></a>');
    }
    el.innerHTML = parts.join('');
  }

  // ---------- 阅读进度条 ----------
  function initProgress() {
    var bar = document.getElementById('reading-progress');
    if (!bar) return;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      bar.style.width = pct + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ---------- 评论（后端 API + 审核后发布） ----------
  async function loadComments(id) {
    try {
      var res = await window.Api.request('GET', '/api/comments?post=' + encodeURIComponent(id));
      return res.comments || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  function fmtTime(t) {
    if (!t) return '';
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  async function renderComments(id) {
    var listEl = document.getElementById('comment-list');
    var countEl = document.getElementById('comment-count');
    if (!listEl) return;
    var comments = await loadComments(id);
    if (countEl) countEl.textContent = comments.length;

    if (!comments.length) {
      listEl.innerHTML = '<p class="muted">还没有评论，来说点什么吧。💬</p>';
      return;
    }
    var me = window.Auth.currentUser();
    var isAdminMe = me && window.Auth.isAdmin(me);

    listEl.innerHTML = comments.map(function (c) {
      var authorAccount = c.author || c.user;
      var canDelete = me && (authorAccount === me.account || isAdminMe);
      var del = canDelete
        ? '<button class="comment-delete" type="button" data-comment-id="' + esc(c.id) + '" title="删除评论">删除</button>'
        : '';
      var isAuthorAdmin = window.Auth.isAdmin ? window.Auth.isAdmin({ account: authorAccount }) : false;
      var adminBadge = isAuthorAdmin ? ' <span class="admin-badge">管理员</span>' : '';

      var replies = (c.replies || []).map(function (r) {
        var rAdmin = window.Auth.isAdmin ? window.Auth.isAdmin({ account: r.author || r.user }) : false;
        return '<div class="comment-reply">' +
          '<span class="reply-name">👤 ' + esc(r.user || r.name || '匿名') + (rAdmin ? ' <span class="admin-badge">管理员</span>' : '') + '</span>' +
          '<span class="reply-content">' + esc(r.content || '') + '</span>' +
          '<time class="reply-time">' + fmtTime(r.time) + '</time>' +
        '</div>';
      }).join('');

      var replyBtn = me
        ? '<button class="reply-btn" type="button" data-comment-id="' + esc(c.id) + '">回复</button>'
        : '';
      var replyBox = me
        ? '<div class="reply-box" data-reply-for="' + esc(c.id) + '" hidden>' +
            '<textarea class="reply-input" placeholder="回复 @' + esc(c.user || '') + '…"></textarea>' +
            '<button class="reply-submit" type="button" data-comment-id="' + esc(c.id) + '">发送</button>' +
          '</div>'
        : '';

      return (
        '<div class="comment">' +
          '<div class="comment-head">' +
            '<span class="comment-name">👤 ' + esc(c.user || c.name || '匿名') + adminBadge + '</span>' +
            '<time class="comment-time">' + fmtTime(c.time) + '</time>' +
            del +
          '</div>' +
          '<div class="comment-body">' + esc(c.content || '') + '</div>' +
          (replies ? '<div class="comment-replies">' + replies + '</div>' : '') +
          '<div class="comment-actions">' + replyBtn + '</div>' +
          replyBox +
        '</div>'
      );
    }).join('');

    // 删除评论（自己或管理员）
    listEl.querySelectorAll('.comment-delete').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var cid = btn.getAttribute('data-comment-id');
        try {
          await window.Api.request('DELETE', '/api/comments/' + encodeURIComponent(cid));
          renderComments(id);
        } catch (e) { alert(e.message); }
      });
    });

    // 展开/收起回复框
    listEl.querySelectorAll('.reply-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cid = btn.getAttribute('data-comment-id');
        var box = listEl.querySelector('.reply-box[data-reply-for="' + cid + '"]');
        if (!box) return;
        box.hidden = !box.hidden;
        if (!box.hidden) box.querySelector('.reply-input').focus();
      });
    });

    // 提交回复（审核后显示）
    listEl.querySelectorAll('.reply-submit').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var cid = btn.getAttribute('data-comment-id');
        var box = listEl.querySelector('.reply-box[data-reply-for="' + cid + '"]');
        var input = box ? box.querySelector('.reply-input') : null;
        var text = input ? input.value.trim() : '';
        if (!text) { alert('请输入回复内容'); return; }
        if (!window.Auth.currentUser()) { window.App.openAuth(); return; }
        try {
          await window.Api.request('POST', '/api/comments', { post: id, content: text, parent: cid });
          alert('回复已提交，审核通过后显示');
          renderComments(id);
        } catch (e) { alert(e.message); }
      });
    });
  }

  async function renderCommentState(id) {
    var gate = document.getElementById('comment-login-gate');
    var form = document.getElementById('comment-form');
    var identity = document.getElementById('comment-identity');
    var user = window.Auth.currentUser();

    if (user) {
      if (gate) gate.style.display = 'none';
      if (form) form.style.display = '';
      var admin = window.Auth.isAdmin ? window.Auth.isAdmin(user) : false;
      if (identity) {
        identity.innerHTML = esc(user.nickname) + (admin ? ' <span class="admin-badge">管理员</span>' : '');
      }
    } else {
      if (gate) gate.style.display = '';
      if (form) form.style.display = 'none';
    }
    await renderComments(id);
  }

  function initComments(id) {
    var form = document.getElementById('comment-form');
    if (!form) return;

    // 登录门禁按钮
    var gateBtn = document.getElementById('comment-login-btn');
    if (gateBtn) {
      gateBtn.addEventListener('click', function () { window.App.openAuth(); });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var user = window.Auth.currentUser();
      if (!user) { window.App.openAuth(); return; }
      var content = (form.querySelector('#comment-content') || {}).value || '';
      if (!content.trim()) { alert('请输入评论内容'); return; }
      try {
        await window.Api.request('POST', '/api/comments', { post: id, content: content.trim() });
        alert('评论已提交，审核通过后显示');
        form.reset();
        renderComments(id);
      } catch (err) { alert(err.message); }
    });

    // 登录/登出状态变化时刷新评论区
    document.addEventListener('auth:changed', function () { renderCommentState(id); });

    renderCommentState(id);
  }

  function renderNotFound() {
    document.title = '文章未找到 · ' + (window.SITE.name || '博客');
    var content = document.getElementById('article-content');
    if (content) content.innerHTML = '<div class="empty">抱歉，没有找到这篇文章。<br><a href="index.html">返回首页</a></div>';
    var header = document.getElementById('article-header');
    if (header) header.innerHTML = '<h1 class="article-title">文章未找到</h1>';
    var nav = document.getElementById('article-nav');
    if (nav) nav.innerHTML = '';
    var comments = document.getElementById('comments');
    if (comments) comments.style.display = 'none';
  }

  async function init() {
    var id = getPostId();
    await window.App.loadPosts();  // 从后端加载文章（失败则用静态）
    var post = id ? window.App.getPostById(id) : null;
    if (!post) { renderNotFound(); return; }
    renderHeader(post);
    renderContent(post);
    renderNav(post);
    initProgress();
    initComments(post.id);
  }

  window.Article = { init: init };
})();
