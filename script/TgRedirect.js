const SCHEME = { Telegram: "tg", Swiftgram: "sg", Turrit: "turrit" };

function deeplink(s, path, qs) {
  const p = path.split("/").filter(Boolean);
  if (!p[0]) return "";
  const qval = (k) => {
    const m = qs && qs.match(new RegExp("(?:^|&)" + k + "=([^&]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  };
  if (p[0][0] === "+")            return `${s}://join?invite=${encodeURIComponent(p[0].slice(1))}`;
  if (p[0] === "joinchat" && p[1]) return `${s}://join?invite=${encodeURIComponent(p[1])}`;
  if (p[0] === "addstickers" && p[1]) return `${s}://addstickers?set=${encodeURIComponent(p[1])}`;
  if (p[0] === "share" && p[1] === "url")
    return `${s}://msg_url?url=${encodeURIComponent(qval("url"))}&text=${encodeURIComponent(qval("text"))}`;
  if (p[1] && /^\d+$/.test(p[1]))
    return `${s}://resolve?domain=${encodeURIComponent(p[0])}&post=${encodeURIComponent(p[1])}`;
  return `${s}://resolve?domain=${encodeURIComponent(p[0])}`;
}

const m = $request.url.match(/^https?:\/\/t\.me\/(.+)$/i);
if (!m) { $done({}); } else {
  const scheme = SCHEME[$argument] || "tg";
  let tail = m[1].replace(/^s\//, "");
  const qi = tail.indexOf("?");
  const loc = deeplink(scheme, qi < 0 ? tail : tail.slice(0, qi), qi < 0 ? "" : tail.slice(qi + 1));
  loc ? $done({ response: { status: 302, headers: { Location: loc, "Cache-Control": "no-store" }, body: "" } })
      : $done({});
}
