/**
 * TestFlight 名额监控 (Surge 优化版)
 * - 名额通知：仅在「满 → 有名额」时通知一次，避免重复轰炸
 * - 运行通知：开启 notify 后，每次运行结束发一条汇总，用于确认脚本是否在跑
 *
 * argument 采用 query-string 格式：
 *   notify=true&ids=hmC52rdF#示例APP,b6X29Sva
 *     notify : 是否每次运行都发汇总通知（true/false），用于调试确认
 *     ids    : 要监控的 TestFlight ID，多个用英文逗号分隔，可用「ID#备注」格式
 */

const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
];
const randomUA = () => UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

const RE_FULL = /版本的测试员已满|This beta is full|此 beta 版已额满/;
const RE_CLOSED = /版本目前不接受任何新测试员|This beta isn't accepting any new testers/;
const RE_OPEN = /要加入 Beta 版|To join the|开始测试|itms-beta:\/\/|join the beta/;

// 解析 argument（query-string 格式）
function parseArg(raw) {
  const out = {};
  raw.split("&").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > 0) out[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  return out;
}

function main() {
  const raw = (typeof $argument !== "undefined" && $argument) ? $argument.trim() : "";
  if (!raw) {
    console.log("[TF] 未配置参数");
    return $done();
  }

  // 兼容两种写法：纯 ID 列表 / query-string
  let notifyEach = false, idsRaw = raw;
  if (raw.includes("ids=") || raw.includes("notify=")) {
    const p = parseArg(raw);
    notifyEach = p.notify === "true";
    idsRaw = p.ids || "";
  }

  const ids = idsRaw.split(/\s*[,，;\n]\s*/).filter(Boolean);
  if (ids.length === 0) {
    console.log("[TF] 未填写要监控的 ID");
    return $done();
  }

  console.log(`[TF] 开始检查 ${ids.length} 个: ${ids.join(", ")}`);

  const summary = [];   // 汇总每个 ID 的结果
  let pending = ids.length;

  const finish = () => {
    if (--pending > 0) return;
    // 全部检查完成，按需发送汇总通知
    if (notifyEach) {
      $notification.post(
        "✅ TestFlight 监控运行中",
        `已检查 ${ids.length} 个 · ${new Date().toLocaleTimeString()}`,
        summary.join("\n")
      );
    }
    $done();
  };

  ids.forEach((info) => {
    let id = info, name = "";
    if (info.includes("#")) {
      const parts = info.split("#");
      id = parts[0].trim();
      name = parts[1].trim();
    }
    const label = name || id;
    const url = `https://testflight.apple.com/join/${id}`;
    const key = `tf_state_${id}`;

    $httpClient.get(
      { url, headers: { "User-Agent": randomUA() }, timeout: 10 },
      (err, resp, data) => {
        if (err) {
          console.log(`[!] ${info} → 请求失败: ${err}`);
          summary.push(`⚠️ ${label}: 请求失败`);
          return finish();
        }
        if (resp.status === 404) {
          console.log(`[D] ${info} → 链接不存在`);
          summary.push(`❓ ${label}: 链接不存在`);
          $persistentStore.write("invalid", key);
          return finish();
        }
        if (resp.status !== 200) {
          console.log(`[?] ${info} → HTTP ${resp.status}`);
          summary.push(`❓ ${label}: HTTP ${resp.status}`);
          return finish();
        }

        const last = $persistentStore.read(key);

        if (RE_FULL.test(data)) {
          console.log(`[F] ${info} → 已满`);
          summary.push(`🈵 ${label}: 已满`);
          $persistentStore.write("full", key);
        } else if (RE_CLOSED.test(data)) {
          console.log(`[N] ${info} → 暂不接受新成员`);
          summary.push(`🚫 ${label}: 不接受新成员`);
          $persistentStore.write("closed", key);
        } else if (RE_OPEN.test(data)) {
          summary.push(`🎉 ${label}: 有名额`);
          if (last !== "open") {
            console.log(`[Y] ${info} → 可加入 ✅ 通知`);
            $notification.post(
              "🎉 TestFlight 有名额了！",
              name ? `${name} (${id})` : `ID: ${id}`,
              "点击立即加入测试",
              { action: "open-url", url: url, sound: true }
            );
          } else {
            console.log(`[Y] ${info} → 仍有名额（已通知过，跳过）`);
          }
          $persistentStore.write("open", key);
        } else {
          console.log(`[?] ${info} → 状态未知`);
          summary.push(`❓ ${label}: 状态未知`);
        }
        finish();
      }
    );
  });
}

main();
