/**
 * TestFlight 名额监控
 * $argument 格式: ids=ID1,ID2&log=false
 * 仅在检测到有名额时发送通知，其余状态只记录日志
 */

var UA_LIST = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
];

function randomUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

function isValidId(id) {
  return /^[A-Za-z0-9]{8}$/.test(id);
}

function parseArg(raw) {
  var result = {};
  raw.split("&").forEach(function(kv) {
    var i = kv.indexOf("=");
    if (i > 0) {
      result[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    }
  });
  return result;
}

function run() {
  var raw = (typeof $argument !== "undefined" && $argument) ? String($argument).trim() : "";

  if (!raw) {
    console.log("[TF] argument 为空，请检查模块配置");
    $done();
    return;
  }

  var arg = parseArg(raw);
  var enableLog = (arg.log === "true");

  function log(msg) {
    if (enableLog) console.log(msg);
  }

  var idsRaw = arg.ids || raw;
  var allIds = idsRaw.split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });

  var ids = allIds.filter(isValidId);
  var invalid = allIds.filter(function(s) { return !isValidId(s); });

  if (invalid.length > 0) {
    log("[TF] 跳过非法 ID: " + invalid.join(", "));
  }

  if (ids.length === 0) {
    console.log("[TF] 无有效 ID，请在模块参数中填写 8 位 TestFlight ID");
    $notification.post("TestFlight 监控", "未配置有效 ID", "请在模块参数中填写 8 位 TestFlight ID");
    $done();
    return;
  }

  log("[TF] 开始检查 " + ids.length + " 个: " + ids.join(", "));

  var total = ids.length;
  var doneCount = 0;
  var results = {};

  function oneDone() {
    doneCount += 1;
    if (doneCount >= total) {
      log("[TF] 全部检查完成");
      $done({ results: results });
    }
  }

  ids.forEach(function(id) {
    var url = "https://testflight.apple.com/join/" + id;

    $httpClient.get({
      url: url,
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      },
      timeout: 10
    }, function(error, response, data) {
      if (error) {
        log("[TF] " + id + " 请求失败: " + error);
        results[id] = "⚠️ 请求失败";
        oneDone();
        return;
      }

      if (response.status !== 200) {
        log("[TF] " + id + " HTTP " + response.status);
        results[id] = "⚠️ HTTP " + response.status;
        oneDone();
        return;
      }

      var isFull = data.indexOf("This beta is full") !== -1
                || data.indexOf("版本的测试员已满") !== -1
                || data.indexOf("此 Beta 版本的测试员已满") !== -1
                || data.indexOf("此 beta 版已额满") !== -1;

      var isClosed = data.indexOf("isn't accepting") !== -1
                  || data.indexOf("版本目前不接受") !== -1;

      var hasSpots = data.indexOf("To join the") !== -1
                  || data.indexOf("要加入 Beta 版") !== -1
                  || data.indexOf("join the beta") !== -1;

      if (isFull) {
        log("[TF] " + id + " 🈵 已满");
        results[id] = "🈵 已满";
      } else if (isClosed) {
        log("[TF] " + id + " 🚫 不接受新成员");
        results[id] = "🚫 不接受新成员";
      } else if (hasSpots) {
        log("[TF] " + id + " 🎉 有名额");
        results[id] = "🎉 有名额";
        $notification.post(
          "🎉 TestFlight 有名额！",
          "ID: " + id,
          "点击立即加入测试",
          { action: "open-url", url: url, sound: true }
        );
      } else {
        log("[TF] " + id + " ❓ 状态未知");
        results[id] = "❓ 状态未知";
      }

      oneDone();
    });
  });
}

run();
