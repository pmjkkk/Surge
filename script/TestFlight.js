/**
 * TestFlight 名额监控 (Surge)
 *
 * argument (query-string 格式):
 *   ids=ID1,ID2&debug=false
 *     ids   : TestFlight ID，多个用英文逗号分隔
 *     debug : true 时每次运行都发汇总通知，用于确认脚本是否在跑（默认 false）
 *
 * 名额通知：仅在「满 → 有名额」状态变化时通知一次，避免重复打扰
 */

const UA_LIST = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
];
const randomUA = () => UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

const STATUS = {
  full:   { re: /版本的测试员已满|This beta is full|此 beta 版已额满/, tag: "🈵", text: "已满", store: "full" },
  closed: { re: /版本目前不接受任何新测试员|This beta isn't accepting any new testers/, tag: "🚫", text: "不接受新成员", store: "closed" },
  open:   { re: /要加入 Beta 版|To join the|开始测试|itms-beta:\/\/|join the beta/, tag: "🎉", text: "有名额", store: "open" }
};

// 解析 query-string
function parseArg(raw) {
  const o = {};
  raw.split("&").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  return o;
}

function checkOne(id, debug, summary, finish) {
  const url = `https://testflight.apple.com/join/${id}`;
  const key = `tf_${id}`;

  $httpClient.get(
    { url, headers: { "User-Agent": randomUA() }, timeout: 10 },
    (err, resp, data) => {
      if (err) {
        summary.push(`⚠️ ${id}: 请求失败`);
        return finish();
      }
      if (resp.status !== 200) {
        const msg = resp.status === 404 ? "链接不存在" : `HTTP ${resp.status}`;
        summary.push(`❓ ${id}: ${msg}`);
        if (resp.status === 404) $persistentStore.write("invalid", key);
        return finish();
      }

      // 匹配三种已知状态
      let matched = null;
      for (const s of Object.values(STATUS)) {
        if (s.re.test(data)) { matched = s; break; }
      }

      if (!matched) {
        summary.push(`❓ ${id}: 状态未知`);
        return finish();
      }

      summary.push(`${matched.tag} ${id}: ${matched.text}`);

      // 仅在「非 open → open」时发名额通知
      if (matched.store === "open" && $persistentStore.read(key) !== "open") {
        $notification.post(
          "🎉 TestFlight 有名额了！",
          `ID: ${id}`,
          "点击立即加入测试",
          { action: "open-url", url, sound: true }
        );
      }
      $persistentStore.write(matched.store, key);
      finish();
    }
  );
}

function main() {
  const raw = (typeof $argument !== "undefined" && $argument) ? $argument.trim() : "";
  if (!raw) { console.log("[TF] 未配置参数"); return $done(); }

  const arg = parseArg(raw);
  const debug = arg.debug === "true";
  const ids = (arg.ids || "").split(/\s*[,，;\n]\s*/).filter(Boolean);

  if (ids.length === 0) { console.log("[TF] 未填写 ID"); return $done(); }
  console.log(`[TF] 检查 ${ids.length} 个: ${ids.join(", ")}`);

  const summary = [];
  let pending = ids.length;
  const finish = () => {
    if (--pending > 0) return;
    console.log(`[TF] 完成:\n${summary.join("\n")}`);
    if (debug) {
      $notification.post(
        "✅ TestFlight 监控运行中",
        `已检查 ${ids.length} 个 · ${new Date().toLocaleTimeString()}`,
        summary.join("\n")
      );
    }
    $done();
  };

  ids.forEach((id) => checkOne(id, debug, summary, finish));
}

main();
