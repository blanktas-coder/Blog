/**
 * 自包含的轻量 Markdown 解析器 + 通用代码高亮器
 * 零依赖，支持 file:// 协议离线运行。
 *
 * 支持的语法：
 *   - 标题 # ~ ######
 *   - 粗体 **text** / __text__、斜体 *text*、删除线 ~~text~~
 *   - 行内代码 `code`、围栏代码块 ```lang
 *   - 链接 [text](url)、图片 ![alt](url)
 *   - 无序列表 - * +、有序列表 1.
 *   - 引用 >、分隔线 ---、表格
 *   - 媒体扩展：@[video](url) / @[audio](url)（也可直接写原生 <video>/<audio> 标签）
 *   - 原生 HTML 透传（用于嵌入 iframe、video、audio 等）
 */
(function (global) {
  'use strict';

  // ---------- 工具 ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  // ---------- 通用代码高亮 ----------
  var KEYWORDS = [
    // JS / TS / 通用
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends',
    'super', 'this', 'import', 'export', 'from', 'default', 'try', 'catch',
    'finally', 'throw', 'async', 'await', 'typeof', 'instanceof', 'in', 'of',
    'void', 'delete', 'yield', 'get', 'set', 'static', 'interface', 'type',
    'enum', 'implements', 'package', 'public', 'private', 'protected', 'readonly',
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    // Python
    'def', 'print', 'lambda', 'self', 'None', 'True', 'False', 'and', 'or',
    'not', 'elif', 'pass', 'with', 'as', 'global', 'nonlocal', 'raise',
    'except', 'assert', 'is',
    // Rust / Go
    'fn', 'mut', 'struct', 'impl', 'pub', 'use', 'match', 'trait', 'where',
    'loop', 'go', 'func', 'chan', 'defer', 'range', 'select',
    // C / C++
    'int', 'float', 'double', 'char', 'bool', 'long', 'short', 'unsigned',
    'signed', 'include', 'define', 'namespace', 'using', 'std', 'cout', 'cin',
    'string', 'vector', 'auto',
    // SQL
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'JOIN', 'GROUP', 'BY',
    'ORDER', 'LIMIT', 'AND', 'OR', 'NOT', 'NULL'
  ];
  var KEYWORD_SET = {};
  KEYWORDS.forEach(function (k) { KEYWORD_SET[k] = true; });

  function highlight(code) {
    // 注释 | 字符串 | 数字 | 标识符/关键字
    var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|^[ \t]*#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|([A-Za-z_$][\w$]*)/gm;
    var out = '';
    var last = 0;
    var m;
    while ((m = re.exec(code)) !== null) {
      out += escapeHtml(code.slice(last, m.index));
      if (m[1]) {
        out += '<span class="tok-com">' + escapeHtml(m[1]) + '</span>';
      } else if (m[2]) {
        out += '<span class="tok-str">' + escapeHtml(m[2]) + '</span>';
      } else if (m[3]) {
        out += '<span class="tok-num">' + escapeHtml(m[3]) + '</span>';
      } else if (m[4] && KEYWORD_SET[m[4]]) {
        out += '<span class="tok-kw">' + escapeHtml(m[4]) + '</span>';
      } else if (m[4]) {
        out += '<span class="tok-fn">' + escapeHtml(m[4]) + '</span>';
      }
      last = re.lastIndex;
    }
    out += escapeHtml(code.slice(last));
    return out;
  }

  // ---------- 行内解析 ----------
  function inline(text) {
    var s = String(text);
    var tokens = [];

    function stash(re, fn) {
      s = s.replace(re, function (m) {
        var idx = tokens.length;
        var args = Array.prototype.slice.call(arguments);
        tokens.push(fn ? fn.apply(null, args) : m);
        return '\u0000' + idx + '\u0000';
      });
    }

    // 1. 行内代码
    stash(/`([^`\n]+)`/g, function (m, code) {
      return '<code>' + escapeHtml(code) + '</code>';
    });

    // 2. 图片
    stash(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, alt, url, title) {
      var t = title ? ' title="' + escapeAttr(title) + '"' : '';
      return '<img src="' + escapeAttr(url) + '" alt="' + escapeAttr(alt) + '"' + t + ' loading="lazy">';
    });

    // 3. 媒体扩展 @[video](url) / @[audio](url)
    stash(/@\[(video|audio)\]\(([^)\s]+)\)/g, function (m, type, url) {
      if (type === 'video') {
        return '<div class="media"><video controls preload="metadata" src="' + escapeAttr(url) + '"></video></div>';
      }
      return '<div class="media"><audio controls preload="metadata" src="' + escapeAttr(url) + '"></audio></div>';
    });

    // 4. 链接
    stash(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (m, label, url, title) {
      var t = title ? ' title="' + escapeAttr(title) + '"' : '';
      return '<a href="' + escapeAttr(url) + '"' + t + '>' + inline(label) + '</a>';
    });

    // 5. 粗体
    s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');

    // 6. 斜体（单星号；下划线用词边界避免误伤 snake_case）
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    s = s.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');

    // 7. 删除线
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

    // 8. 还原占位符
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, idx) { return tokens[+idx]; });

    return s;
  }

  // ---------- 表格辅助 ----------
  function splitRow(line) {
    return line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map(function (c) { return c.trim(); });
  }

  function buildTable(header, rows) {
    var thead = '<thead><tr>' + header.map(function (c) {
      return '<th>' + inline(c) + '</th>';
    }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (c) {
        return '<td>' + inline(c) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    return '<table>' + thead + tbody + '</table>';
  }

  function isBlockStart(line, lines, i) {
    if (/^(#{1,6})\s+/.test(line)) return true;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return true;
    if (/^\s*>\s?/.test(line)) return true;
    if (/^\s*[-*+]\s+/.test(line)) return true;
    if (/^\s*\d+\.\s+/.test(line)) return true;
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) return true;
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length &&
        /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1) return true;
    if (/^\u0000CODE\d+\u0000$/.test(line.trim())) return true;
    return false;
  }

  // ---------- 主解析 ----------
  function parse(markdown) {
    var md = String(markdown || '').replace(/\r\n?/g, '\n');
    var codeBlocks = [];

    // 提取围栏代码块
    md = md.replace(/^[ \t]*```([^\n`]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm, function (m, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push({ lang: lang.trim(), code: code.replace(/\n$/, '') });
      return '\u0000CODE' + idx + '\u0000';
    });
    md = md.replace(/^[ \t]*~~~([^\n~]*)\n([\s\S]*?)^[ \t]*~~~[ \t]*$/gm, function (m, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push({ lang: lang.trim(), code: code.replace(/\n$/, '') });
      return '\u0000CODE' + idx + '\u0000';
    });

    var lines = md.split('\n');
    var html = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // 代码块占位符
      var codeMatch = line.trim().match(/^\u0000CODE(\d+)\u0000$/);
      if (codeMatch) {
        var cb = codeBlocks[+codeMatch[1]];
        var langClass = cb.lang ? ' class="lang-' + escapeHtml(cb.lang.toLowerCase()) + '"' : '';
        html.push('<pre><code' + langClass + '>' + highlight(cb.code) + '</code></pre>');
        i++;
        continue;
      }

      // 标题
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        var level = h[1].length;
        html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      // 分隔线
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        html.push('<hr>');
        i++;
        continue;
      }

      // 引用
      if (/^\s*>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html.push('<blockquote>' + parse(quoteLines.join('\n')) + '</blockquote>');
        continue;
      }

      // 无序列表
      if (/^\s*[-*+]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
          i++;
        }
        html.push('<ul>' + items.map(function (it) { return '<li>' + parse(it) + '</li>'; }).join('') + '</ul>');
        continue;
      }

      // 有序列表
      if (/^\s*\d+\.\s+/.test(line)) {
        var items2 = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items2.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i++;
        }
        html.push('<ol>' + items2.map(function (it) { return '<li>' + parse(it) + '</li>'; }).join('') + '</ol>');
        continue;
      }

      // 表格
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1) {
        var header = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        html.push(buildTable(header, rows));
        continue;
      }

      // 空行
      if (/^\s*$/.test(line)) { i++; continue; }

      // 段落
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i], lines, i)) {
        para.push(lines[i].trim());
        i++;
      }
      if (para.length) {
        html.push('<p>' + inline(para.join(' ')) + '</p>');
      } else {
        i++;
      }
    }

    return html.join('\n');
  }

  global.Markdown = { parse: parse, highlight: highlight, escapeHtml: escapeHtml };
})(typeof window !== 'undefined' ? window : this);
