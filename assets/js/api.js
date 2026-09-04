/**
 * 后端 API 封装（配合 server/server.js 使用）
 */
window.Api = {
  token: function () {
    try { return localStorage.getItem('blog-token') || ''; } catch (e) { return ''; }
  },
  base: function () {
    return (window.SITE && window.SITE.apiUrl) || '';
  },
  request: async function (method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = this.token();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res;
    try {
      res = await fetch(this.base() + path, {
        method: method,
        headers: headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error('无法连接服务器，请检查网络或后端是否已启动');
    }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error((data && data.error) || ('请求失败 ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }
};
