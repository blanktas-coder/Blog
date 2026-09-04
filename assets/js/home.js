/**
 * 首页逻辑：文章列表、标签/分类筛选、实时搜索
 */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var esc = window.App.esc;
  var state = { tag: null, cat: null, q: '' };

  function filteredPosts() {
    var q = (state.q || '').trim().toLowerCase();
    return window.App.sortedPosts().filter(function (p) {
      if (state.tag && (p.tags || []).indexOf(state.tag) === -1) return false;
      if (state.cat && p.category !== state.cat) return false;
      if (q) {
        var hay = (p.title + ' ' + (p.excerpt || '') + ' ' + (p.content || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function postCard(p) {
    var tags = (p.tags || []).map(function (t) {
      return '<a class="chip" href="?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
    }).join('');
    var cat = p.category
      ? '<a class="chip chip-cat" href="?cat=' + encodeURIComponent(p.category) + '">' + esc(p.category) + '</a>'
      : '';
    var time = window.App.readingTime(p.content);

    return (
      '<article class="post-card">' +
        '<header class="post-card-head">' +
          '<h2 class="post-card-title"><a href="article.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.title) + '</a></h2>' +
          '<div class="post-card-meta">' +
            '<time datetime="' + esc(p.date) + '">' + esc(window.App.formatDate(p.date)) + '</time>' +
            '<span class="dot">·</span>' +
            '<span>' + time + ' 分钟阅读</span>' +
          '</div>' +
        '</header>' +
        '<p class="post-card-excerpt">' + esc(p.excerpt || '') + '</p>' +
        '<footer class="post-card-tags">' + cat + tags + '</footer>' +
      '</article>'
    );
  }

  function renderList() {
    var list = document.getElementById('post-list');
    if (!list) return;
    var posts = filteredPosts();

    // 更新计数
    var countEl = document.getElementById('result-count');
    if (countEl) {
      var label = (state.tag ? '标签「' + state.tag + '」' : '') + (state.cat ? '分类「' + state.cat + '」' : '') + (state.q ? '搜索「' + state.q + '」' : '');
      countEl.textContent = label ? '「' + label + '」共 ' + posts.length + ' 篇' : '共 ' + posts.length + ' 篇文章';
    }

    if (!posts.length) {
      list.innerHTML = '<div class="empty">没有找到相关文章，换个关键词试试吧。😊</div>';
      return;
    }
    list.innerHTML = posts.map(postCard).join('');
  }

  function renderSidebar() {
    var tags = window.App.getAllTags();
    var cats = window.App.getAllCategories();

    var tagWrap = document.getElementById('tag-list');
    if (tagWrap) {
      tagWrap.innerHTML = tags.map(function (t) {
        var isActive = state.tag === t;
        var cls = isActive ? ' active' : '';
        var x = isActive ? '<span class="chip-x" aria-hidden="true">×</span>' : '';
        return '<a class="chip' + cls + '" href="?tag=' + encodeURIComponent(t) + '">' + esc(t) + x + '</a>';
      }).join('') || '<span class="muted">暂无标签</span>';
    }

    var catWrap = document.getElementById('category-list');
    if (catWrap) {
      catWrap.innerHTML = cats.map(function (c) {
        var isActive = state.cat === c;
        var cls = isActive ? ' active' : '';
        var x = isActive ? '<span class="chip-x" aria-hidden="true">×</span>' : '';
        return '<a class="chip chip-cat' + cls + '" href="?cat=' + encodeURIComponent(c) + '">' + esc(c) + x + '</a>';
      }).join('') || '<span class="muted">暂无分类</span>';
    }
  }

  function renderHero() {
    var name = document.getElementById('hero-name');
    var slogan = document.getElementById('hero-slogan');
    var desc = document.getElementById('hero-desc');
    if (name) name.textContent = SITE.name || '博客';
    if (slogan) slogan.textContent = SITE.slogan || '';
    if (desc) desc.textContent = SITE.description || '';
  }

  function render() {
    renderHero();
    renderList();
    renderSidebar();
  }

  function readStateFromURL() {
    var params = new URLSearchParams(window.location.search);
    state.tag = params.get('tag');
    state.cat = params.get('cat');
    state.q = params.get('q') || '';
  }

  function syncURL() {
    var params = new URLSearchParams();
    if (state.tag) params.set('tag', state.tag);
    if (state.cat) params.set('cat', state.cat);
    if (state.q) params.set('q', state.q);
    var qs = params.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '');
    try { history.replaceState(null, '', url); } catch (e) { /* file:// 下可能受限，忽略 */ }
  }

  function filter(query) {
    state.q = query || '';
    syncURL();
    renderList();
    // 搜索时若封面仍展开，滑走封面以显示结果
    if (state.q && hideCover) hideCover();
  }

  // 拦截标签/分类点击，避免整页刷新；再点一次已激活的标签/分类则取消筛选
  function bindDelegation() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="?tag="], a[href^="?cat="]');
      if (!a) return;
      e.preventDefault();
      var params = new URLSearchParams(a.getAttribute('href').slice(1));
      var tag = params.get('tag');
      var cat = params.get('cat');

      // 点击的是当前已激活的标签/分类 → 取消（清除筛选）
      if (tag && state.tag === tag) tag = null;
      else if (cat && state.cat === cat) cat = null;

      state.tag = tag;
      state.cat = cat;
      state.q = '';
      syncURL();
      renderList();
      renderSidebar();
      // 不滚动回封面，原地更新列表
    });
  }

  // ---------- 封面转场：滚轮滚到阈值后整屏向上滑走 / 向下滑回（背景图不随滚动移动） ----------
  var hideCover = null;

  function initCover() {
    if (typeof document.querySelector !== 'function') return;
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var open = true;          // 封面是否展开
    var animating = false;    // 转场动画进行中
    var TRANSITION_MS = 650;  // 与 CSS transition 时长保持一致
    var THRESHOLD = 100;      // 滚轮累计阈值（px）

    function lockScroll(locked) {
      document.documentElement.classList.toggle('cover-locked', locked);
    }

    function setOpen(next) {
      open = next;
      hero.classList.toggle('cover-hidden', !next);
      lockScroll(next);          // 封面展开时锁定页面滚动
      if (next) window.scrollTo(0, 0);
    }

    // 封面向上滑走，露出文章
    function hide() {
      if (!open || animating) return;
      animating = true;
      setOpen(false);
      setTimeout(function () { animating = false; }, TRANSITION_MS);
    }

    // 封面向下滑回，回到封面
    function show() {
      if (open || animating) return;
      animating = true;
      setOpen(true);
      setTimeout(function () { animating = false; }, TRANSITION_MS);
    }

    hideCover = hide;

    // 点击「下滑」箭头 → 滑走封面
    var indicator = hero.querySelector('.scroll-down');
    if (indicator) {
      indicator.addEventListener('click', function (e) {
        e.preventDefault();
        hide();
      });
    }

    // 滚轮
    var acc = 0;
    var last = 0;
    window.addEventListener('wheel', function (e) {
      var now = Date.now();
      if (now - last > 350) acc = 0;
      last = now;

      if (open && e.deltaY > 0) {
        acc += e.deltaY;
        if (acc > THRESHOLD) { acc = 0; e.preventDefault(); hide(); }
      } else if (!open && e.deltaY < 0 && (window.scrollY || 0) <= 0) {
        acc += -e.deltaY;
        if (acc > THRESHOLD) { acc = 0; e.preventDefault(); show(); }
      }
    }, { passive: false });

    // 触屏滑动（手机/触控板）
    var touchY = 0;
    window.addEventListener('touchstart', function (e) {
      touchY = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
    }, { passive: true });
    window.addEventListener('touchend', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dy = t.clientY - touchY;
      if (open && dy < -40) hide();
      else if (!open && dy > 40 && (window.scrollY || 0) <= 0) show();
    }, { passive: true });

    // 初始状态：URL 带筛选条件（tag/cat/q）时直接展示文章，否则展示封面
    setOpen(!(state.tag || state.cat || state.q));
    window.scrollTo(0, 0);
  }

  async function init() {
    readStateFromURL();
    await window.App.loadPosts();  // 从后端加载文章（失败则用静态）
    render();
    bindDelegation();
    initCover();
  }

  window.Home = { filter: filter, init: init };
})();
