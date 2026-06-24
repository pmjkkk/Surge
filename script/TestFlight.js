/**
 * TestFlight 名额监控 (Surge)
 *
 * 检测到有名额时立即通知，每次运行都检查，有名额就通知
 * 无防抖设计：TestFlight 名额稀缺，宁可多通知也不漏通知
 *
 * argument (query-string 格式):
 *   ids=ID1,ID2
 *   ids: 要监控的 TestFlight ID，多个用英文逗号分隔（必填）
 */

const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
];
const randomUA = () => UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

const RE_FULL   = /版本的测试员已满|This beta is full|此 beta 版已额满/;
const RE_CLOSED = /版本目前不接受任何新测试员|This beta isn't accepting any new testers/;
const RE_OPEN   = /要加入 Beta 版|To join the|开始测试|itms-beta:\/\/|join the beta/;

function checkOne(id, finish) {
  const url = `https://testflight.apple.com/join/${id}`;

  $httpClient.get(
    { url, headers: { "User-Agent": randomUA() }, timeout: 10 },
    (err, resp, data) => {
      if (err) {
        console.log(`[TF] ⚠️ ${id} 请求失败: ${err}`);
        return finish();
      }

      if (resp.status === 404) {
        console.log(`[TF] ❓ ${id} 链接不存在`);
        return finish();
      }

      if (resp.status !== 200) {
        console.log(`[TF] ❓ ${id} HTTP ${resp.status}`);
        return finish();
      }

      if (RE_OPEN.test(data)) {
        console.log(`[TF] 🎉 ${id} 有名额`);
        $notification.post(
          "🎉 TestFlight 有名额！",
          `ID: ${id}`,
          "点击立即加入",
          { action: "open-url", url, sound: true }
        );
      } else if (RE_FULL.test(data)) {
        console.log(`[TF] 🈵 ${id} 已满`);
      } else if (RE_CLOSED.test(data)) {
        console.log(`[TF] 🚫 ${id} 不接受新成员`);
      } else {
        console.log(`[TF] ❓ ${id} 状态未知`);
      }

      finish();
    }
  );
}

function main() {
  const raw = (typeof $argument !== "undefined" && $argument) ? $argument.trim() : "";

  if (!raw) {
    console.log("[TF] 未配置 argument，请在模块参数中填入 TestFlight ID");
    return $done();
  }

  // 解析 ids=xxx 格式，兼容直接传 ID 列表的情况
  let idsRaw = raw;
  if (raw.indexOf("ids=") === 0) {
    idsRaw = raw.slice(4);
  }

  const ids = idsRaw.split(/\s*[,，;\n]\s*/).filter(Boolean);
  if (ids.length === 0) {
    console.log("[TF] 未填写有效 ID");
    return $done();
  }

  console.log(`[TF] 开始检查 ${ids.length} 个: ${ids.join(", ")}`);

  let pending = ids.length;
  const finish = () => {
    if (--pending === 0) {
      console.log("[TF] 检查完成");
      $done();
    }
  };

  ids.forEach((id) => checkOne(id, finish));
}

main();
