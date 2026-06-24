/**
 * NetUnlock - 流媒体与 AI 解锁检测
 * Surge Panel 版
 * 检测 Netflix / Disney+ / YouTube / ChatGPT / Claude / Gemini
 */

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// 封装 $httpClient.get 为 Promise 风格
function fetch(options) {
  return new Promise(function(resolve) {
    $httpClient.get(options, function(error, response, data) {
      if (error) resolve({ error: error });
      else resolve({ status: response.status, data: data });
    });
  });
}

// 获取代理 IP 归属地
function fetchProxy() {
  return fetch({
    url: 'http://ip-api.com/json/?lang=zh-CN&fields=status,countryCode,country',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    if (res.error) return { ok: false, cc: 'XX', country: '' };
    try {
      var d = JSON.parse(res.data);
      return { ok: d.status === 'success', cc: d.countryCode || 'XX', country: d.country || '' };
    } catch (e) {
      return { ok: false, cc: 'XX', country: '' };
    }
  });
}

// Netflix
function checkNetflix() {
  return fetch({
    url: 'https://www.netflix.com/title/70143836',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status === 200 };
  });
}

// Disney+
function checkDisney() {
  return fetch({
    url: 'https://www.disneyplus.com',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status !== 403 };
  });
}

// ChatGPT（返回解锁地区）
function checkChatGPT() {
  return fetch({
    url: 'https://chatgpt.com/cdn-cgi/trace',
    timeout: 5000
  }).then(function(res) {
    if (res.error || !res.data) return { ok: false, cc: '' };
    var m = res.data.match(/loc=([A-Z]{2})/);
    return m ? { ok: true, cc: m[1] } : { ok: false, cc: '' };
  });
}

// Claude
function checkClaude() {
  return fetch({
    url: 'https://claude.ai/login',
    timeout: 6000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status === 200 };
  });
}

// Gemini
function checkGemini() {
  return fetch({
    url: 'https://gemini.google.com/app',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status === 200 };
  });
}

// 格式化一行结果
function row(icon, name, ok, extra) {
  var status = ok ? '✅' : '❌';
  var line = status + ' ' + name;
  if (ok && extra) line += '  [' + extra + ']';
  return line;
}

// 主流程
Promise.all([
  fetchProxy(),
  checkNetflix(),
  checkDisney(),
  checkChatGPT(),
  checkClaude(),
  checkGemini()
]).then(function(results) {
  var proxy   = results[0];
  var netflix = results[1];
  var disney  = results[2];
  var chatgpt = results[3];
  var claude  = results[4];
  var gemini  = results[5];

  var cc = proxy.cc;
  var proxyLine = '📍 节点地区：' + (proxy.ok ? proxy.country + '  ' + cc : '获取失败');

  var streamLines = [
    row('', 'YouTube',  proxy.ok,   cc),
    row('', 'Netflix',  netflix.ok, cc),
    row('', 'Disney+',  disney.ok,  cc)
  ];

  var aiLines = [
    row('', 'ChatGPT',  chatgpt.ok, chatgpt.cc || cc),
    row('', 'Claude',   claude.ok,  cc),
    row('', 'Gemini',   gemini.ok,  cc)
  ];

  var allOk = [netflix.ok, disney.ok, proxy.ok, chatgpt.ok, claude.ok, gemini.ok];
  var okCount = allOk.filter(Boolean).length;
  var total = allOk.length;

  var now = new Date();
  var timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  var content = [
    proxyLine,
    '',
    '── 流媒体 ──────────────',
    streamLines.join('\n'),
    '',
    '── AI 服务 ─────────────',
    aiLines.join('\n'),
    '',
    '🕐 ' + timeStr + '  解锁 ' + okCount + '/' + total
  ].join('\n');

  var style = okCount === total ? 'good' : okCount === 0 ? 'error' : 'info';

  $done({
    title: '解锁检测  ' + okCount + '/' + total,
    content: content,
    style: style,
    icon: 'antenna.radiowaves.left.and.right',
    'icon-color': okCount === total ? '#2F9E58' : okCount === 0 ? '#D64545' : '#7446D8'
  });
}).catch(function(e) {
  $done({
    title: '解锁检测',
    content: '检测失败: ' + e,
    style: 'error'
  });
});
