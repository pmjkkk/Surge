/**
 * TestFlight 名额监控
 * $argument 格式: ids=ID1,ID2
 * 仅在检测到有名额时发送通知，其余状态只记录日志
 */

function run() {
  var arg = (typeof $argument !== "undefined" && $argument) ? String($argument).trim() : "";

  if (!arg) {
    console.log("[TF] argument 为空，请检查模块配置");
    $done();
    return;
  }

  var idsRaw = (arg.indexOf("ids=") === 0) ? arg.slice(4) : arg;
  var ids = idsRaw.split(",").map(function(s) {
    return s.trim();
  }).filter(function(s) {
    return s.length > 0;
  });

  if (ids.length === 0) {
    console.log("[TF] 未找到有效 ID，请检查模块参数");
    $done();
    return;
  }

  console.log("[TF] 开始检查 " + ids.length + " 个 ID: " + ids.join(", "));

  var total = ids.length;
  var doneCount = 0;
  var results = {};

  function oneDone() {
    doneCount += 1;
    if (doneCount >= total) {
      console.log("[TF] 全部检查完成");
      $done({ results: results });
    }
  }

  ids.forEach(function(id) {
    var url = "https://testflight.apple.com/join/" + id;

    $httpClient.get({
      url: url,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      },
      timeout: 15
    }, function(error, response, data) {
      if (error) {
        console.log("[TF] " + id + " 请求失败: " + error);
        results[id] = "⚠️ 请求失败";
        oneDone();
        return;
      }

      if (response.status !== 200) {
        console.log("[TF] " + id + " HTTP " + response.status);
        results[id] = "⚠️ HTTP " + response.status;
        oneDone();
        return;
      }

      var isFull   = data.indexOf("This beta is full") !== -1
                  || data.indexOf("版本的测试员已满") !== -1
                  || data.indexOf("此 Beta 版本的测试员已满") !== -1
                  || data.indexOf("此 beta 版已额满") !== -1;

      var isClosed = data.indexOf("isn't accepting") !== -1
                  || data.indexOf("版本目前不接受") !== -1;

      // 有名额的唯一可靠标识：beta-status 里有「To join the / 要加入」
      // itms-beta:// 在已满/有名额页面都存在，不可作为判断依据
      var hasSpots = data.indexOf("To join the") !== -1
                  || data.indexOf("要加入 Beta 版") !== -1
                  || data.indexOf("join the beta") !== -1;

      if (hasSpots && !isFull && !isClosed) {
        console.log("[TF] " + id + " 🎉 有名额");
        results[id] = "🎉 有名额";
        $notification.post(
          "🎉 TestFlight 有名额！",
          "ID: " + id,
          "点击立即加入测试",
          { action: "open-url", url: url, sound: true }
        );
      } else if (isFull) {
        console.log("[TF] " + id + " 🈵 已满");
        results[id] = "🈵 已满";
      } else if (isClosed) {
        console.log("[TF] " + id + " 🚫 不接受新成员");
        results[id] = "🚫 不接受新成员";
      } else {
        console.log("[TF] " + id + " ❓ 状态未知");
        results[id] = "❓ 状态未知";
      }

      oneDone();
    });
  });
}

run();
