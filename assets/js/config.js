/**
 * 站点全局配置
 * 修改这里的站点名称、作者、网址等信息即可。
 */
window.SITE = {
  name: '空白ark的博客',
  slogan: '记录思考，分享热爱',
  author: 'Blank_Tasftu',
  // 管理员账户名（仅用于前端显示「管理员」徽标判断）。
  // 管理员账号与密码由后端管理（后端环境变量 ADMIN_ACCOUNT / ADMIN_PASSWORD），
  // 两者需保持一致，前端才知道谁是管理员。
  admin: {
    account: 'admin'
  },
  description: '一个半静态的个人博客：Markdown 写作、标签分类、全文搜索、深色模式、评论与 RSS 订阅。',
  // 公告列表（按 date 排序，最新一条显示在页头气泡；公告页展示全部）
  announcements: [
    { date: '2025-01-01', text: '📢 欢迎来到我的博客，新文章已上线，记得订阅 RSS 哦～' }
  ],
  // 站点网址（用于生成 RSS、评论等，上线后请替换成真实域名）
  url: 'https://blankbk.313001.xyz',
  // 后端 API 地址（真实多用户登录 + 共享评论 + 审核）。本地测试填 http://localhost:3000，
  // 部署到 VPS 后填 https://你的域名.com
  apiUrl: 'https://blankbk.313001.xyz',
  // 备案号 / 版权信息（可留空）
  icp: '',
  // 版权起始年份
  copyrightYear: '2025',
  // 首页每页文章数（此处为静态渲染，全部展示）
  nav: [
    { label: '首页', href: 'index.html' },
    { label: '公告', href: 'announcement.html' },
    { label: '关于', href: 'about.html' }
  ]
};
