/**
 * TestFlight 名额监控
 * 检测到有名额时立即发送通知
 *
 * 参数（通过模块 argument 传入）：
 *   $argument = "tLcYLZJV,b6X29Sva"  逗号分隔多个 ID
 */

var UA_LIST = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
];

function randomUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

var ids = [];

// 从 $argument 中解析 ID 列表
if (typeof $argument !== "undefined" && $argument && $argument.trim() !== "") {
  ids = $argument.trim().split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

if (ids.length === 0) {
  $notification.post("TestFlight 监控", "未配置 ID", "请在模块参数中填写 TestFlight ID");
  $done();
  return;
}

var total = ids.length;
var done_count = 0;

function checkDone() {
  done_count++;
  if (done_count >= total) {
    $done();
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
    timeout: 15
  }, function(error, response, data) {
    if (error) {
      $notification.post("TestFlight 监控", "请求失败", "ID: " + id + "\n" + error);
      return checkDone();
    }

    if (response.status === 200) {
      if (data.indexOf("itms-beta://") !== -1 || data.indexOf("join the beta") !== -1 || data.indexOf("要加入 Beta 版") !== -1) {
        $notification.post(
          "🎉 TestFlight 有名额！",
          "ID: " + id,
          "点击立即加入测试",
          { action: "open-url", url: url, sound: true }
        );
      } else if (data.indexOf("This beta is full") !== -1 || data.indexOf("版本的测试员已满") !== -1) {
        console.log("[TF] " + id + " 已满");
      } else if (data.indexOf("This beta isn") !== -1 || data.indexOf("版本目前不接受") !== -1) {
        console.log("[TF] " + id + " 不接受新成员");
      } else {
        console.log("[TF] " + id + " 状态未知");
        $notification.post("TestFlight 监控", "状态未知", "ID: " + id);
      }
    } else {
      $notification.post("TestFlight 监控", "HTTP " + response.status, "ID: " + id);
    }

    checkDone();
  });
});
