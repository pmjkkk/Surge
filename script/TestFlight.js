/**
 * TestFlight 名额监控
 * $argument 格式: ids=ID1,ID2
 */

function run() {
  var arg = (typeof $argument !== "undefined" && $argument) ? String($argument).trim() : "";

  // 启动通知：确认脚本已运行，并显示收到的参数（用于调试）
  $notification.post(
    "TestFlight 监控已启动",
    "收到参数: " + (arg ? arg : "（空）"),
    "正在检查..."
  );

  if (!arg) {
    $done();
    return;
  }

  // 解析 ids=xxx 格式
  var idsRaw = (arg.indexOf("ids=") === 0) ? arg.slice(4) : arg;
  var ids = idsRaw.split(",").map(function(s) {
    return s.trim();
  }).filter(function(s) {
    return s.length > 0;
  });

  if (ids.length === 0) {
    $notification.post("TestFlight 监控", "配置错误", "未找到有效的 TestFlight ID，请检查模块参数");
    $done();
    return;
  }

  var total = ids.length;
  var doneCount = 0;

  function checkDone() {
    doneCount += 1;
    if (doneCount >= total) {
      $done();
    }
  }

  function checkId(id) {
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
        $notification.post("TestFlight 监控", "请求失败", "ID: " + id + "\n错误: " + error);
        checkDone();
        return;
      }

      if (response.status !== 200) {
        $notification.post("TestFlight 监控", "HTTP " + response.status, "ID: " + id);
        checkDone();
        return;
      }

      var hasSpots  = data.indexOf("itms-beta://") !== -1 || data.indexOf("join the beta") !== -1 || data.indexOf("要加入 Beta 版") !== -1;
      var isFull    = data.indexOf("This beta is full") !== -1 || data.indexOf("版本的测试员已满") !== -1 || data.indexOf("此 beta 版已额满") !== -1;
      var isClosed  = data.indexOf("isn't accepting") !== -1 || data.indexOf("版本目前不接受") !== -1;

      if (hasSpots) {
        $notification.post("🎉 TestFlight 有名额！", "ID: " + id, "点击查看: " + url);
      } else if (isFull) {
        $notification.post("TestFlight 监控", "ID: " + id, "🈵 已满");
      } else if (isClosed) {
        $notification.post("TestFlight 监控", "ID: " + id, "🚫 不接受新成员");
      } else {
        $notification.post("TestFlight 监控", "ID: " + id, "❓ 状态未知，可能需要更新正则");
      }

      checkDone();
    });
  }

  for (var i = 0; i < ids.length; i++) {
    checkId(ids[i]);
  }
}

run();
