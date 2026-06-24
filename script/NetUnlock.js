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
  // 跟随重定向，解锁时重定向到本地化 URL（如 /jp-en/title/...）
  return fetch({ url: 'https://www.netflix.com/title/70143836', timeout: 6000, headers: { 'User-Agent': UA } })
    .then(function(res) {
      return { ok: !res.error && res.status === 200 };
    });
}

function checkDisney() {
  // 响应头含 physical-location 表示可访问，封锁时返回 403 或无此 header
  return new Promise(function(resolve) {
    $httpClient.get({
      url: 'https://www.disneyplus.com',
      timeout: 6000,
      headers: { 'User-Agent': UA }
    }, function(error, response) {
      if (error) return resolve({ ok: false });
      var loc = response.headers && (response.headers['physical-location'] || response.headers['Physical-Location']);
      resolve({ ok: !error && response.status === 200 && !!loc });
    });
  });
}

function checkChatGPT() {
  // cdn-cgi/trace 返回 loc=XX，封锁地区不包含此字段
  return fetch({ url: 'https://chatgpt.com/cdn-cgi/trace', timeout: 5000 })
    .then(function(res) {
      if (res.error || !res.data) return { ok: false, cc: '' };
      var m = res.data.match(/loc=([A-Z]{2})/);
      return m ? { ok: true, cc: m[1] } : { ok: false, cc: '' };
    });
}

function checkClaude() {
  // robots.txt：可访问返回 200，Cloudflare 地区封锁返回 403
  return fetch({ url: 'https://claude.ai/robots.txt', timeout: 6000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status === 200 }; });
}

function checkGemini() {
  return fetch({ url: 'https://gemini.google.com', timeout: 5000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status === 200 }; });
}

function checkYouTube() {
  return fetch({ url: 'https://www.youtube.com/premium', timeout: 5000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status === 200 }; });
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
  checkDisney(),
  checkChatGPT(),
  checkClaude(),
  checkGemini(),
  checkYouTube()
]).then(function(r) {
  var proxy = r[0], netflix = r[1], disney = r[2];
  var chatgpt = r[3], claude = r[4], gemini = r[5], youtube = r[6];
  var cc = proxy.cc;

  var now = new Date();
  var t = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  var all = [netflix.ok, disney.ok, youtube.ok, chatgpt.ok, claude.ok, gemini.ok];
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

  // 计算字符串视觉宽度（CJK 字符占 2 列）
  function vw(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      w += (c >= 0x1100 && (
        c <= 0x115F ||
        (c >= 0x2E80 && c <= 0xA4CF) ||
        (c >= 0xAC00 && c <= 0xD7A3) ||
        (c >= 0xF900 && c <= 0xFAFF) ||
        (c >= 0xFF01 && c <= 0xFF60) ||
        (c >= 0xFFE0 && c <= 0xFFE6)
      )) ? 2 : 1;
    }
    return w;
  }

  var rowWidth = 28; // 1 + cell(12) + gap(3) + cell(12)
  var left  = ' ◎  ' + (proxy.ok ? proxy.country + '  ' + cc : '未知');
  var right = ok + ' / ' + total + ' 解锁';
  var spaces = Math.max(1, rowWidth - vw(left) - vw(right));
  var firstLine = left + Array(spaces + 1).join(' ') + right;

  var content = [
    firstLine,
    ' ' + cell('Netflix',  netflix.ok,  cc)               + gap + cell('Disney+', disney.ok,  cc),
    ' ' + cell('ChatGPT',  chatgpt.ok,  chatgpt.cc || cc)  + gap + cell('YouTube', youtube.ok, cc),
    ' ' + cell('Claude',   claude.ok,   cc)               + gap + cell('Gemini',  gemini.ok,  cc)
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
