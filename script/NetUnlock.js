/**
 * NetUnlock - 解锁检测
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
  return fetch({ url: 'https://www.netflix.com/title/70143836', timeout: 5000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status === 200 }; });
}

function checkDisney() {
  return fetch({ url: 'https://www.disneyplus.com', timeout: 5000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status !== 403 }; });
}

function checkChatGPT() {
  return fetch({ url: 'https://chatgpt.com/cdn-cgi/trace', timeout: 5000 })
    .then(function(res) {
      if (res.error || !res.data) return { ok: false, cc: '' };
      var m = res.data.match(/loc=([A-Z]{2})/);
      return m ? { ok: true, cc: m[1] } : { ok: false, cc: '' };
    });
}

function checkClaude() {
  return fetch({ url: 'https://claude.ai/login', timeout: 6000, headers: { 'User-Agent': UA } })
    .then(function(res) { return { ok: !res.error && res.status === 200 }; });
}

function checkGemini() {
  return fetch({ url: 'https://gemini.google.com/app', timeout: 5000, headers: { 'User-Agent': UA } })
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
  checkGemini()
]).then(function(r) {
  var proxy = r[0], netflix = r[1], disney = r[2];
  var chatgpt = r[3], claude = r[4], gemini = r[5];
  var cc = proxy.cc;

  var now = new Date();
  var t = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  var all = [proxy.ok, netflix.ok, disney.ok, chatgpt.ok, claude.ok, gemini.ok];
  var ok = all.filter(Boolean).length;
  var total = all.length;

  var content = [
    cc + '  ' + proxy.country,
    '',
    line('Netflix',  netflix.ok,  cc),
    line('Disney+',  disney.ok,   cc),
    line('YouTube',  proxy.ok,    cc),
    line('ChatGPT',  chatgpt.ok,  chatgpt.cc || cc),
    line('Claude',   claude.ok,   cc),
    line('Gemini',   gemini.ok,   cc),
    '',
    ok + ' / ' + total + '   ' + t
  ].join('\n');

  $done({
    title: '解锁检测',
    content: content,
    style: ok === total ? 'good' : ok === 0 ? 'error' : 'info',
    icon: 'antenna.radiowaves.left.and.right',
    'icon-color': ok === total ? '#2F9E58' : ok === 0 ? '#D64545' : '#7446D8'
  });

}).catch(function(e) {
  $done({ title: '解锁检测', content: '检测出错\n' + e, style: 'error' });
});
