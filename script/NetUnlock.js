/**
 * NetUnlock - AI解锁检测
 * Surge Panel 极简版
 */

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function fetch(options) {
  return new Promise(function(resolve) {
    $httpClient.get(options, function(error, response, data) {
      if (error) resolve({ error: error });
      else resolve({ status: response.status, data: data });
    });
  });
}

// Claude 和 ChatGPT 封锁地区列表
var AI_BLOCKED = { CN:1, HK:1, RU:1, BY:1, IR:1, KP:1, SY:1, CU:1 };

function fetchProxy() {
  return fetch({
    url: 'http://ip-api.com/json/?lang=zh-CN&fields=status,countryCode,country',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    if (res.error) return { ok: false, cc: '--', country: '--' };
    try {
      var d = JSON.parse(res.data);
      return { ok: d.status === 'success', cc: d.countryCode || '--', country: d.country || '--' };
    } catch(e) { return { ok: false, cc: '--', country: '--' }; }
  });
}

function checkNetflix() {
  // 跟随重定向，解锁时页面包含 playerModel 或重定向到本地化路径
  return fetch({ url: 'https://www.netflix.com/title/70143836', timeout: 8000, headers: { 'User-Agent': UA } })
    .then(function(res) {
      if (res.error || res.status !== 200) return { ok: false };
      return { ok: res.data.indexOf('playerModel') !== -1 || res.data.indexOf('jawSummary') !== -1 };
    });
}

function checkTikTok() {
  // 主域名返回 200 = 可访问
  return fetch({ url: 'https://www.tiktok.com', timeout: 5000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status === 200 }; });
}

function checkYouTube() {
  // /premium 页面有价格信息 = 该地区支持 YouTube Premium
  return fetch({ url: 'https://www.youtube.com/premium', timeout: 6000, headers: { 'User-Agent': UA } })
    .then(function(res) {
      if (res.error || res.status !== 200) return { ok: false };
      // 封锁/不支持地区页面不含价格，正常地区含月付/价格信息
      return { ok: res.data.indexOf('month') !== -1 || res.data.indexOf('/mo') !== -1 || res.data.indexOf('per month') !== -1 };
    });
}

function checkChatGPT() {
  // cdn-cgi/trace 提取 loc，黑名单判断
  return fetch({ url: 'https://chatgpt.com/cdn-cgi/trace', timeout: 5000 })
    .then(function(res) {
      if (res.error || !res.data) return { ok: false, cc: '' };
      var m = res.data.match(/loc=([A-Z]{2})/);
      if (!m) return { ok: false, cc: '' };
      var cc = m[1];
      return { ok: !AI_BLOCKED[cc], cc: cc };
    });
}

function checkClaude() {
  // cdn-cgi/trace 提取 loc，黑名单判断（HK 封锁）
  return fetch({ url: 'https://claude.ai/cdn-cgi/trace', timeout: 6000 })
    .then(function(res) {
      if (res.error || !res.data) return { ok: false, cc: '' };
      var m = res.data.match(/loc=([A-Z]{2})/);
      if (!m) return { ok: false, cc: '' };
      var cc = m[1];
      return { ok: !AI_BLOCKED[cc], cc: cc };
    });
}

function checkGemini() {
  // /app 正常页面约 700KB，封锁/异常页面极小
  return fetch({ url: 'https://gemini.google.com/app', timeout: 6000, headers: { 'User-Agent': UA } })
    .then(function(res) {
      if (res.error || res.status !== 200) return { ok: false };
      // 正常页面 > 100KB，封锁时返回极小的错误页
      return { ok: res.data && res.data.length > 100000 };
    });
}

// 固定宽度行：名称左对齐 + 地区 + 状态
function line(name, ok, cc) {
  var pad = (name + '          ').slice(0, 10);
  var region = (ok && cc) ? cc : '  ';
  var mark = ok ? '✓' : '✗';
  return pad + region + '  ' + mark;
}

Promise.all([
  fetchProxy(),
  checkNetflix(),
  checkTikTok(),
  checkYouTube(),
  checkChatGPT(),
  checkClaude(),
  checkGemini()
]).then(function(r) {
  var proxy = r[0], netflix = r[1], tiktok = r[2], youtube = r[3];
  var chatgpt = r[4], claude = r[5], gemini = r[6];
  var cc = proxy.cc;

  var now = new Date();
  var t = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  var all = [netflix.ok, tiktok.ok, youtube.ok, chatgpt.ok, claude.ok, gemini.ok];
  var ok = all.filter(Boolean).length;
  var total = all.length;

  var sep = ' ─────────────────────── ';

  function cell(name, ok, cc) {
    var mark = ok ? '● ' : '○ ';
    var tag  = (ok && cc) ? cc : '--';
    var pad  = (name + '       ').slice(0, 7);
    return mark + pad + ' ' + tag;
  }

  var gap = '   ';

  // 计算字符串视觉宽度（CJK + 几何符号占 2 列）
  function vw(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      w += (c >= 0x1100 && (
        c <= 0x115F ||
        (c >= 0x2500 && c <= 0x25FF) ||
        (c >= 0x2E80 && c <= 0xA4CF) ||
        (c >= 0xAC00 && c <= 0xD7A3) ||
        (c >= 0xF900 && c <= 0xFAFF) ||
        (c >= 0xFF01 && c <= 0xFF60) ||
        (c >= 0xFFE0 && c <= 0xFFE6)
      )) ? 2 : 1;
    }
    return w;
  }

  var rowWidth = 30; // 1(indent) + cell(13) + gap(3) + cell(13)
  var left  = ' ◎  ' + (proxy.ok ? proxy.country + '  ' + cc : '未知');
  var right = ok + ' / ' + total + ' 解锁';
  var spaces = Math.max(1, rowWidth - vw(left) - vw(right));
  var firstLine = left + Array(spaces + 1).join(' ') + right;

  var content = [
    firstLine,
    ' ' + cell('Netflix',  netflix.ok,  cc)               + gap + cell('ChatGPT', chatgpt.ok, chatgpt.cc || cc),
    ' ' + cell('TikTok',   tiktok.ok,   cc)               + gap + cell('Claude',  claude.ok,  claude.cc  || cc),
    ' ' + cell('YouTube',  youtube.ok,  cc)               + gap + cell('Gemini',  gemini.ok,  cc)
  ].join('\n');

  $done({
    title: 'AI解锁检测',
    content: content,
    style: ok === total ? 'good' : ok === 0 ? 'error' : 'info',
    icon: 'antenna.radiowaves.left.and.right',
    'icon-color': ok === total ? '#2F9E58' : ok === 0 ? '#D64545' : '#7446D8'
  });

}).catch(function(e) {
  $done({ title: 'AI解锁检测', content: '检测出错\n' + e, style: 'error' });
});
