/**
 * 用户系统前端：调用后端 API（server/server.js），本地缓存登录态供同步读取。
 *
 * - 账户（account）用于登录；昵称（nickname）仅用于显示；
 * - 登录后 token + 用户信息缓存在 localStorage，currentUser() 可同步读取；
 * - 页面加载时用 Auth.init() 向后端校验 token 是否仍有效（后台刷新）。
 */
(function () {
  'use strict';

  var TOKEN_KEY = 'blog-token';
  var USER_KEY = 'blog-user';

  function emit() {
    try { document.dispatchEvent(new CustomEvent('auth:changed')); } catch (e) {}
  }

  function cacheUser(user) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch (e) {}
  }
  function readUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function clearAuth() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
  }
  function storeToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }

  function currentUser() {
    return readUser();
  }

  function isAdmin(user) {
    var acc = (window.SITE && window.SITE.admin && window.SITE.admin.account) || null;
    return !!(acc && user && user.account === acc);
  }

  function applySession(token, u) {
    if (token) storeToken(token);
    var user = {
      account: u && u.account,
      nickname: (u && u.nickname) || (u && u.account),
      createdAt: u && u.createdAt
    };
    user.isAdmin = isAdmin(user);
    cacheUser(user);
    emit();
    return { ok: true };
  }

  function login(account, password) {
    return window.Api.request('POST', '/api/login', { account: account, password: password })
      .then(function (res) { return applySession(res.token, res.user); })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  function register(account, password, nickname) {
    return window.Api.request('POST', '/api/register', { account: account, password: password, nickname: nickname })
      .then(function (res) { return applySession(res.token, res.user); })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  function logout() {
    clearAuth();
    emit();
  }

  function changePassword(account, oldPassword, newPassword) {
    return window.Api.request('POST', '/api/change-password', { oldPassword: oldPassword, newPassword: newPassword })
      .then(function () { return { ok: true }; })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  function changeNickname(account, nickname) {
    return window.Api.request('POST', '/api/change-nickname', { nickname: nickname })
      .then(function (res) {
        var u = readUser();
        if (u) { u.nickname = res.nickname || nickname; cacheUser(u); }
        emit();
        return { ok: true };
      })
      .catch(function (e) { return { ok: false, error: e.message }; });
  }

  // 页面加载时校验本地 token 是否仍有效
  function init() {
    if (!window.Api.token()) return Promise.resolve(null);
    return window.Api.request('GET', '/api/me')
      .then(function (res) {
        var u = res.user;
        if (u) {
          u.isAdmin = isAdmin(u);
          cacheUser(u);
          emit();
          return u;
        }
        return null;
      })
      .catch(function (e) {
        if (e.status === 401) clearAuth();
        return null;
      });
  }

  window.Auth = {
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser,
    isAdmin: isAdmin,
    changePassword: changePassword,
    changeNickname: changeNickname,
    init: init
  };
})();
