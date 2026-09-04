/**
 * 公共逻辑：主题切换、页头/页脚渲染、工具函数
 * 依赖：config.js、posts.js、markdown.js（按此顺序加载）
 */
(function () {
  'use strict';

  var SITE = window.SITE || {};
  var esc = window.Markdown ? window.Markdown.escapeHtml : function (s) { return s; };

  // ---------- 主题 ----------
  var THEME_KEY = 'blog-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeBall(theme);
  }

  function updateThemeBall(theme) {
    var ball = document.getElementById('theme-ball');
    if (!ball) return;
    ball.textContent = theme === 'dark' ? '☀️' : '🌙';
    ball.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
  }

  function currentTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // 主题切换做成页面右侧的悬浮球（独立于页头渲染，避免时序问题）
  function renderThemeBall() {
    if (document.getElementById('theme-ball')) return;
    var ball = document.createElement('button');
    ball.id = 'theme-ball';
    ball.className = 'theme-ball';
    ball.type = 'button';
    document.body.appendChild(ball);
    updateThemeBall(currentTheme());
    ball.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  function initTheme() {
    // 初始主题已在 head 内联脚本中设置，这里补齐悬浮球并绑定
    var theme = currentTheme();
    document.documentElement.setAttribute('data-theme', theme);
    renderThemeBall();
  }

  // ---------- 工具 ----------
  function urlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + ' 年 ' + m + ' 月 ' + day + ' 日';
  }

  function getPostById(id) {
    return (window.POSTS || []).find(function (p) { return p.id === id; }) || null;
  }

  function sortedPosts() {
    return (window.POSTS || []).slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
  }

  // 从后端加载文章（失败则回退到 posts.js 静态内容）
  async function loadPosts() {
    try {
      var res = await window.Api.request('GET', '/api/posts');
      if (res && Array.isArray(res.posts)) {
        window.POSTS = res.posts.map(function (p) {
          var tags = p.tags;
          if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch (e) { tags = String(tags).split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
          }
          return {
            id: p.id,
            title: p.title,
            date: p.date,
            category: p.category || '',
            tags: Array.isArray(tags) ? tags : [],
            excerpt: p.excerpt || '',
            content: p.content || ''
          };
        });
      }
    } catch (e) {
      console.warn('后端文章加载失败，使用本地静态文章：' + e.message);
    }
    return window.POSTS || [];
  }

  function readingTime(markdown) {
    if (!markdown) return 1;
    // 中文按字数，英文按单词，粗略估计 400 字/分钟
    var text = markdown.replace(/[#*`>\[\]()~\-|]/g, '');
    var chars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round((chars + words * 2) / 400));
  }

  function getAllTags() {
    var map = {};
    (window.POSTS || []).forEach(function (p) {
      (p.tags || []).forEach(function (t) { map[t] = (map[t] || 0) + 1; });
    });
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
  }

  function getAllCategories() {
    var map = {};
    (window.POSTS || []).forEach(function (p) {
      if (p.category) map[p.category] = (map[p.category] || 0) + 1;
    });
    return Object.keys(map).sort();
  }

  // ---------- 公告 ----------
  function latestAnnouncement() {
    var anns = (SITE.announcements || []).slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
    return anns[0] || null;
  }

  // 从后端加载公告（失败则回退到 config.js 静态公告）
  async function loadAnnouncements() {
    try {
      var res = await window.Api.request('GET', '/api/announcements');
      if (res && Array.isArray(res.announcements)) {
        SITE.announcements = res.announcements;
      }
    } catch (e) {
      console.warn('后端公告加载失败，使用 config.js 静态公告：' + e.message);
    }
    return SITE.announcements || [];
  }

  // 把最新公告渲染成浮在封面上的气泡（可关闭；关闭按「日期+内容」记忆，
  // 内容一旦改动，即使日期不变也会重新显示）
  async function renderAnnouncement(container) {
    if (!container) return;
    await loadAnnouncements();
    var ann = latestAnnouncement();
    if (!ann) { container.innerHTML = ''; return; }
    var id = (ann.date || '') + '::' + (ann.text || '');
    var closedId = null;
    try { closedId = localStorage.getItem('blog-announcement-closed'); } catch (e) {}
    if (closedId === id) { container.innerHTML = ''; return; }

    container.innerHTML =
      '<div class="announcement-bubble" id="announcement-bubble">' +
        '<span class="announcement-text" title="' + esc(ann.text) + '">' + esc(ann.text) + '</span>' +
        '<button class="announcement-close" id="announcement-close" type="button" aria-label="关闭公告">×</button>' +
      '</div>';

    var btn = container.querySelector('#announcement-close');
    if (btn) {
      btn.addEventListener('click', function () {
        container.innerHTML = '';
        try { localStorage.setItem('blog-announcement-closed', id); } catch (e) {}
      });
    }
  }

  // ---------- 页头高度同步 ----------
  var headerResizeBound = false;
  function syncHeaderHeight(el) {
    var h = el ? el.offsetHeight : 0;
    if (h > 0) {
      document.documentElement.style.setProperty('--header-h', h + 'px');
    }
    if (!headerResizeBound) {
      headerResizeBound = true;
      window.addEventListener('resize', function () {
        var wrap = document.getElementById('site-header');
        if (wrap) syncHeaderHeight(wrap);
      });
    }
  }

  // ---------- 页头 ----------
  function renderHeader(active) {
    var el = document.getElementById('site-header');
    if (!el) return;

    var navHtml = (SITE.nav || []).map(function (item) {
      var cls = (active && item.href === active) ? ' class="active"' : '';
      return '<a href="' + esc(item.href) + '"' + cls + '>' + esc(item.label) + '</a>';
    }).join('');

    el.innerHTML =
      '<header class="site-header">' +
        '<div class="header-inner">' +
          '<a class="brand" href="index.html">' + esc(SITE.name || '博客') + '</a>' +
          '<nav class="nav">' + navHtml + '</nav>' +
          '<div class="header-actions">' +
            '<form class="search" role="search" action="index.html">' +
              '<input type="search" name="q" id="global-search" placeholder="搜索文章…" aria-label="搜索">' +
            '</form>' +
            '<div class="account-area" id="account-area"></div>' +
          '</div>' +
        '</div>' +
      '</header>';

    // 同步页头实际高度到 CSS 变量（供封面定位等使用）
    syncHeaderHeight(el);

    // 搜索框行为：首页实时过滤；其他页面提交跳转到首页
    var input = el.querySelector('#global-search');
    if (!input) return;
    var q = urlParam('q');
    if (q) input.value = q;

    input.addEventListener('input', function () {
      if (window.Home && typeof window.Home.filter === 'function') {
        window.Home.filter(input.value);
      }
    });

    // 首页：实时过滤，阻止回车整页刷新；其他页面：提交跳转到首页搜索结果
    var form = el.querySelector('.search');
    if (form && window.Home && typeof window.Home.filter === 'function') {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        window.Home.filter(input.value);
      });
    }

    renderAccount();
  }

  // ---------- 账户区（头像 + 昵称 + 悬停菜单） ----------
  function avatarInitial(name) {
    var s = (name || '?').trim();
    return s.charAt(0).toUpperCase();
  }

  function renderAccount() {
    var el = document.getElementById('account-area');
    if (!el) return;
    var user = window.Auth && window.Auth.currentUser();
    if (user) {
      var admin = window.Auth.isAdmin ? window.Auth.isAdmin(user) : false;
      var badge = admin ? ' <span class="admin-badge">管理员</span>' : '';
      el.innerHTML =
        '<span class="user-name">' + esc(user.nickname) + badge + '</span>' +
        '<div class="avatar-wrap">' +
          '<button class="avatar" id="avatar-btn" type="button" aria-label="用户菜单">' + esc(avatarInitial(user.nickname)) + '</button>' +
          '<div class="account-menu" role="menu">' +
            '<div class="menu-head">' +
              '<div class="menu-nick">' + esc(user.nickname) + (admin ? ' <span class="admin-badge">管理员</span>' : '') + '</div>' +
              '<div class="menu-account">@' + esc(user.account) + '</div>' +
            '</div>' +
            '<button class="menu-item" id="menu-chnick" type="button">更改用户名（昵称）</button>' +
            '<button class="menu-item" id="menu-chpw" type="button">更改密码</button>' +
            '<button class="menu-item menu-logout" id="menu-logout" type="button">退出登录</button>' +
          '</div>' +
        '</div>';
      var av = document.getElementById('avatar-btn');
      if (av) av.addEventListener('click', function () { window.location.href = 'user.html'; });
      var mn = document.getElementById('menu-chnick');
      if (mn) mn.addEventListener('click', openChangeNickname);
      var mp = document.getElementById('menu-chpw');
      if (mp) mp.addEventListener('click', openChangePassword);
      var ml = document.getElementById('menu-logout');
      if (ml) ml.addEventListener('click', function () { window.Auth.logout(); });
    } else {
      el.innerHTML =
        '<div class="avatar-wrap">' +
          '<button class="avatar" id="avatar-btn" type="button" aria-label="用户">👤</button>' +
          '<div class="account-menu" role="menu">' +
            '<div class="menu-head">' +
              '<div class="menu-nick">未登录</div>' +
              '<div class="menu-account">登录后即可评论、使用个人中心</div>' +
            '</div>' +
            '<button class="menu-item menu-login" id="menu-login" type="button">登录 / 注册</button>' +
          '</div>' +
        '</div>';
      var av = document.getElementById('avatar-btn');
      if (av) av.addEventListener('click', openAuth);
      var mlogin = document.getElementById('menu-login');
      if (mlogin) mlogin.addEventListener('click', openAuth);
    }
  }

  // ---------- 登录 / 注册 / 修改弹窗 ----------
  function renderAuthModal() {
    if (document.getElementById('auth-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true" aria-label="登录或注册">' +
        '<button class="modal-close" id="auth-close" type="button" aria-label="关闭">×</button>' +
        '<div class="modal-tabs" id="auth-tabs">' +
          '<button class="tab active" data-tab="login" type="button">登录</button>' +
          '<button class="tab" data-tab="register" type="button">注册</button>' +
        '</div>' +
        '<div class="modal-title" id="password-title" hidden>修改密码</div>' +
        '<div class="modal-title" id="nickname-title" hidden>修改用户名（昵称）</div>' +
        '<form class="auth-form" id="auth-form-login">' +
          '<label>账户名<input name="account" autocomplete="username" maxlength="20" required></label>' +
          '<label>密码<input name="password" type="password" autocomplete="current-password" required></label>' +
          '<p class="form-error" id="login-error"></p>' +
          '<button class="btn btn-block" type="submit">登录</button>' +
        '</form>' +
        '<form class="auth-form" id="auth-form-register" hidden>' +
          '<label>账户名（用于登录）<input name="account" autocomplete="username" maxlength="20" required></label>' +
          '<label>用户名 / 昵称（显示用，可选）<input name="nickname" maxlength="20"></label>' +
          '<label>密码（至少 6 位）<input name="password" type="password" autocomplete="new-password" required></label>' +
          '<label>确认密码<input name="password2" type="password" autocomplete="new-password" required></label>' +
          '<p class="form-error" id="register-error"></p>' +
          '<button class="btn btn-block" type="submit">注册并登录</button>' +
        '</form>' +
        '<form class="auth-form" id="auth-form-password" hidden>' +
          '<label>原密码<input name="old" type="password" autocomplete="current-password" required></label>' +
          '<label>新密码（至少 6 位）<input name="new" type="password" autocomplete="new-password" required></label>' +
          '<label>确认新密码<input name="new2" type="password" autocomplete="new-password" required></label>' +
          '<p class="form-error" id="password-error"></p>' +
          '<button class="btn btn-block" type="submit">确认修改</button>' +
        '</form>' +
        '<form class="auth-form" id="auth-form-nickname" hidden>' +
          '<label>新用户名（昵称）<input name="nickname" maxlength="20" required></label>' +
          '<p class="form-error" id="nickname-error"></p>' +
          '<button class="btn btn-block" type="submit">确认修改</button>' +
        '</form>' +
        '<p class="modal-hint">账号仅保存在当前浏览器本地，不会上传到服务器。</p>' +
      '</div>';
    document.body.appendChild(modal);

    // 切换 tab
    modal.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchAuthTab(tab.getAttribute('data-tab')); });
    });

    function setError(id, msg) { modal.querySelector(id).textContent = msg || ''; }

    var loginForm = modal.querySelector('#auth-form-login');
    var registerForm = modal.querySelector('#auth-form-register');
    var passwordForm = modal.querySelector('#auth-form-password');
    var nicknameForm = modal.querySelector('#auth-form-nickname');

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var account = loginForm.querySelector('[name=account]').value;
      var pw = loginForm.querySelector('[name=password]').value;
      setError('#login-error', '');
      window.Auth.login(account, pw).then(function (res) {
        if (res.ok) { closeAuth(); loginForm.reset(); }
        else setError('#login-error', res.error || '登录失败');
      });
    });

    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var account = registerForm.querySelector('[name=account]').value;
      var nickname = registerForm.querySelector('[name=nickname]').value;
      var pw = registerForm.querySelector('[name=password]').value;
      var pw2 = registerForm.querySelector('[name=password2]').value;
      setError('#register-error', '');
      if (pw !== pw2) { setError('#register-error', '两次输入的密码不一致'); return; }
      window.Auth.register(account, pw, nickname).then(function (res) {
        if (res.ok) { closeAuth(); registerForm.reset(); }
        else setError('#register-error', res.error || '注册失败');
      });
    });

    passwordForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = window.Auth.currentUser();
      if (!user) { closeAuth(); return; }
      var oldPw = passwordForm.querySelector('[name=old]').value;
      var newPw = passwordForm.querySelector('[name=new]').value;
      var newPw2 = passwordForm.querySelector('[name=new2]').value;
      setError('#password-error', '');
      if (newPw !== newPw2) { setError('#password-error', '两次输入的新密码不一致'); return; }
      window.Auth.changePassword(user.account, oldPw, newPw).then(function (res) {
        if (res.ok) { closeAuth(); passwordForm.reset(); alert('密码已修改'); }
        else setError('#password-error', res.error || '修改失败');
      });
    });

    nicknameForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = window.Auth.currentUser();
      if (!user) { closeAuth(); return; }
      var nickname = nicknameForm.querySelector('[name=nickname]').value;
      setError('#nickname-error', '');
      window.Auth.changeNickname(user.account, nickname).then(function (res) {
        if (res.ok) { closeAuth(); nicknameForm.reset(); }
        else setError('#nickname-error', res.error || '修改失败');
      });
    });

    // 关闭
    modal.querySelector('#auth-close').addEventListener('click', closeAuth);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeAuth(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAuth();
    });
  }

  function switchAuthTab(which) {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;
    var user = window.Auth && window.Auth.currentUser();
    if ((which === 'password' || which === 'nickname') && !user) which = 'login';

    var isAuth = which === 'login' || which === 'register';
    var tabsWrap = modal.querySelector('#auth-tabs');
    var passwordTitle = modal.querySelector('#password-title');
    var nicknameTitle = modal.querySelector('#nickname-title');
    var loginForm = modal.querySelector('#auth-form-login');
    var registerForm = modal.querySelector('#auth-form-register');
    var passwordForm = modal.querySelector('#auth-form-password');
    var nicknameForm = modal.querySelector('#auth-form-nickname');

    if (tabsWrap) tabsWrap.style.display = isAuth ? '' : 'none';
    if (passwordTitle) passwordTitle.hidden = which !== 'password';
    if (nicknameTitle) nicknameTitle.hidden = which !== 'nickname';

    modal.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === which);
    });
    loginForm.hidden = which !== 'login';
    registerForm.hidden = which !== 'register';
    passwordForm.hidden = which !== 'password';
    nicknameForm.hidden = which !== 'nickname';
    modal.querySelector('#login-error').textContent = '';
    modal.querySelector('#register-error').textContent = '';
    modal.querySelector('#password-error').textContent = '';
    modal.querySelector('#nickname-error').textContent = '';
  }

  function openAuth() {
    var m = document.getElementById('auth-modal');
    if (!m) return;
    switchAuthTab('login');
    m.classList.add('open');
  }
  function openChangePassword() {
    var m = document.getElementById('auth-modal');
    if (!m) return;
    switchAuthTab('password');
    m.classList.add('open');
  }
  function openChangeNickname() {
    var m = document.getElementById('auth-modal');
    if (!m) return;
    switchAuthTab('nickname');
    m.classList.add('open');
  }
  function closeAuth() {
    var m = document.getElementById('auth-modal');
    if (m) m.classList.remove('open');
  }

  function initAuth() {
    renderAuthModal();
    document.addEventListener('auth:changed', renderAccount);
    // 页面加载时向后端校验本地登录态是否仍有效
    if (window.Auth && window.Auth.init) window.Auth.init();
  }

  // ---------- 页脚 ----------
  function renderFooter() {
    var el = document.getElementById('site-footer');
    if (!el) return;
    var year = new Date().getFullYear();
    var start = SITE.copyrightYear || year;
    var range = start === String(year) ? year : start + ' - ' + year;
    var icp = SITE.icp ? '<span class="icp">' + esc(SITE.icp) + '</span>' : '';

    el.innerHTML =
      '<footer class="site-footer">' +
        '<div class="footer-inner">' +
          '<p>© ' + esc(range) + ' ' + esc(SITE.author || SITE.name || '') + ' · ' + esc(SITE.name || '') + '</p>' +
          '<p class="footer-links">' +
            '<a href="rss.xml">RSS 订阅</a>' +
            '<span class="dot">·</span>' +
            '<a href="index.html">文章</a>' +
            '<span class="dot">·</span>' +
            '<a href="about.html">关于</a>' +
          '</p>' +
          icp +
          '<p class="footer-credit">本网站由 DeepSeek-HARNESS 生成编写</p>' +
        '</div>' +
      '</footer>';
  }

  // ---------- 暴露 ----------
  window.App = {
    esc: esc,
    urlParam: urlParam,
    formatDate: formatDate,
    getPostById: getPostById,
    sortedPosts: sortedPosts,
    loadPosts: loadPosts,
    loadAnnouncements: loadAnnouncements,
    readingTime: readingTime,
    getAllTags: getAllTags,
    getAllCategories: getAllCategories,
    renderHeader: renderHeader,
    renderFooter: renderFooter,
    renderAccount: renderAccount,
    renderAnnouncement: renderAnnouncement,
    initTheme: initTheme,
    initAuth: initAuth,
    openAuth: openAuth,
    openChangePassword: openChangePassword,
    openChangeNickname: openChangeNickname,
    closeAuth: closeAuth
  };
})();
