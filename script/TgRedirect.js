/**
 * Telegram 链接重定向 · Surge 版
 * 原作者: panda𝕏 (Egern 转换)
 * 通过 $argument 接收客户端参数
 */

const SCHEME = {
  Telegram: "tg",
  Swiftgram: "sg",
  Turrit: "turrit",
  iMe: "ime",
  Nicegram: "ng",
  Lingogram: "lingo",
};

function qval(qs, key) {
  if (!qs) return "";
  const re = new RegExp(
    "(?:^|&)" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^&]*)"
  );
  const m = qs.match(re);
  return m ? decodeURIComponent(m[1]) : "";
}

function deeplink(s, path, qs) {
  const p = path.split("/").filter(Boolean);
  if (!p[0]) return "";

  if (p[0][0] === "+") {
    return `${s}://join?invite=${encodeURIComponent(p[0].slice(1))}`;
  }
  if (p[0] === "joinchat" && p[1]) {
    return `${s}://join?invite=${encodeURIComponent(p[1])}`;
  }
  if (p[0] === "addstickers" && p[1]) {
    return `${s}://addstickers?set=${encodeURIComponent(p[1])}`;
  }
  if (p[0] === "share" && p[1] === "url") {
    return `${s}://msg_url?url=${encodeURIComponent(qval(qs, "url"))}&text=${encodeURIComponent(qval(qs, "text"))}`;
  }
  if (p[1] && /^\d+$/.test(p[1])) {
    return `${s}://resolve?domain=${encodeURIComponent(p[0])}&post=${encodeURIComponent(p[1])}`;
  }
  return `${s}://resolve?domain=${encodeURIComponent(p[0])}`;
}

const url = $request.url;
const m = url.match(/^https?:\/\/t\.me\/(.+)$/i);
if (!m) {
  $done({});
} else {
  const client = ($argument || "Telegram").trim();
  const scheme = SCHEME[client] || "tg";

  let tail = m[1];
  if (tail.startsWith("s/")) tail = tail.slice(2);

  const qi = tail.indexOf("?");
  const path = qi < 0 ? tail : tail.slice(0, qi);
  const qs   = qi < 0 ? ""   : tail.slice(qi + 1);

  const loc = deeplink(scheme, path, qs);
  if (!loc) {
    $done({});
  } else {
    $done({
      response: {
        status: 302,
        headers: {
          Location: loc,
          "Cache-Control": "no-store, no-cache",
        },
        body: "",
      },
    });
  }
}
