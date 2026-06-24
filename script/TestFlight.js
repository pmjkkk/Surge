/**
 * TestFlight 名额监控 (Surge)
 *
 * 检测到有名额时立即通知
 * 每次运行都检查所有 ID，有名额就发通知
 *
 * argument: ids=ID1,ID2
 *   在脚本编辑器中直接运行时，argument 为空，
 *   脚本会发一条提示通知告知需要通过模块配置参数
 */

const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
];
const randomUA = () => UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

const RE_OPEN   = /要加入 Beta 版|To join the|开始测试|itms-beta:\/\/|join the beta/;
const RE_FULL   = /版本的测试员已满|This beta is full|此 beta 版已额满/;
const RE_CLOSED = /版本目前不接受任何新测试员|This beta isn't accepting any new testers/;

function notify(title, subtitle, body, url) {
  const opts = url
    ? { action: "open-url", url, sound: true }
    : { sound: false };
  $notification.post(title, subtitle, body, opts);
}

function checkOne(id, finish) {
  const url = `https://testflight.apple.com/join/${id}`;

  $httpClient.get(
    { url, headers: { "User-Agent": randomUA() }, timeout: 10 },
    (err, resp, data) => {
      if (err) {
        console.log(`[TF] ⚠️ ${id}: 请求失败 ${err}`);
        notify("⚠️ TestFlight 监控", `ID: ${id}`, `请求失败: ${err}`);
        return finish();
      }

      if (resp.status === 404) {
        console.log(`[TF] ❓ ${id}: 链接不存在`);
        notify("⚠️ TestFlight 监控", `ID: ${id}`, "链接不存在，请检查 ID 是否正确");
        return finish();
      }

      if (resp.status !== 200) {
        console.log(`[TF] ❓ ${id}: HTTP ${resp.status}`);
        notify("⚠️ TestFlight 监控", `ID: ${id}`, `HTTP ${resp.status}`);
        return finish();
      }

      if (RE_OPEN.test(data)) {
        console.log(`[TF] 🎉 ${id}: 有名额`);
        notify("🎉 TestFlight 有名额！", `ID: ${id}`, "点击立即加入", url);
      } else if (RE_FULL.test(data)) {
        console.log(`[TF] 🈵 ${id}: 已满`);
      } else if (RE_CLOSED.test(data)) {
        console.log(`[TF] 🚫 ${id}: 不接受新成员`);
      } else {
        console.log(`[TF] ❓ ${id}: 状态未知`);
        notify("⚠️ TestFlight 监控", `ID: ${id}`, "状态未知，请检查脚本正则是否需要更新");
      }

      finish();
    }
  );
}

function main() {
  const raw = (typeof $argument !== "undefined" && $argument) ? $argument.trim() : "";

  // argument 为空：在脚本编辑器中直接运行，发通知提示
  if (!raw) {
    notify(
      "⚠️ TestFlight 监控",
      "未检测到参数",
      "请通过模块安装并在参数中填写 TestFlight ID，不要直接在编辑器运行"
    );
    console.log("[TF] argument 为空，请通过模块配置参数后运行");
    return $done();
  }

  // 解析 ids=xxx 或直接传 ID 列表两种格式
  const idsRaw = raw.startsWith("ids=") ? raw.slice(4) : raw;
  const ids = idsRaw.split(/\s*[,，;\n]\s*/).filter(Boolean);

  if (ids.length === 0) {
    notify("⚠️ TestFlight 监控", "未填写有效 ID", "请在模块参数中填写 TestFlight ID");
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
