/**
 * NetUnlock - 流媒体与 AI 解锁检测
 * Surge Panel 版
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
    if (res.error) return { ok: false, cc: 'XX', country: '' };
    try {
      var d = JSON.parse(res.data);
      return { ok: d.status === 'success', cc: d.countryCode || 'XX', country: d.country || '' };
    } catch(e) {
      return { ok: false, cc: 'XX', country: '' };
    }
  });
}

function checkNetflix() {
  return fetch({
    url: 'https://www.netflix.com/title/70143836',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status === 200 };
  });
}

function checkDisney() {
  return fetch({
    url: 'https://www.disneyplus.com',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status !== 403 };
  });
}

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

function checkClaude() {
  return fetch({
    url: 'https://claude.ai/login',
    timeout: 6000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status === 200 };
  });
}

function checkGemini() {
  return fetch({
    url: 'https://gemini.google.com/app',
    timeout: 5000,
    headers: { 'User-Agent': UA }
  }).then(function(res) {
    return { ok: !res.error && res.status === 200 };
  });
}

// 格式化一行：对齐名称，右侧显示状态和地区
function row(name, ok, cc) {
  var tag = ok ? '○' : '×';
  var label = (name + '          ').slice(0, 10);
  var region = (ok && cc) ? cc : '---';
  return tag + '  ' + label + region;
}

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

  var now = new Date();
  var timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  var allOk = [proxy.ok, netflix.ok, disney.ok, chatgpt.ok, claude.ok, gemini.ok];
  var okCount = allOk.filter(Boolean).length;
  var total = allOk.length;

  var content = [
    '地区  ' + (proxy.ok ? proxy.country + ' · ' + cc : '获取失败'),
    '',
    'STREAMING',
    row('YouTube',  proxy.ok,   cc),
    row('Netflix',  netflix.ok, cc),
    row('Disney+',  disney.ok,  cc),
    '',
    'AI',
    row('ChatGPT',  chatgpt.ok, chatgpt.cc || cc),
    row('Claude',   claude.ok,  cc),
    row('Gemini',   gemini.ok,  cc),
    '',
    timeStr + '   ' + okCount + ' / ' + total + ' 已解锁'
  ].join('\n');

  var style = okCount === total ? 'good' : okCount === 0 ? 'error' : 'info';

  $done({
    title: '解锁检测',
    content: content,
    style: style,
    icon: 'antenna.radiowaves.left.and.right',
    'icon-color': okCount === total ? '#2F9E58' : okCount === 0 ? '#D64545' : '#7446D8'
  });

}).catch(function(e) {
  $done({
    title: '解锁检测',
    content: '检测出错\n' + e,
    style: 'error'
  });
});
