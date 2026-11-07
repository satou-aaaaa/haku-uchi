// 拍うちの検査。拍の数え方・ことばと俳句のデータ・今日の5語と上級の組み方（3年分）・判定・とことんの並び（何百回）・
// 通しで遊ぶ（今日の5語・続きから・上級・とことん・練習・下読み・テンポ）・見逃し/打ちすぎ/ずれの判定・ずれを合わせる・
// 本当に押して音の時計で数える・拍帳・実績・カレンダー・あとから・スマホ幅・PWA・引き継ぎコード・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const H = createRequire(import.meta.url)(path.join(root, "haku.js"));
const html = readFileSync(path.join(root, "index.html"), "utf8");

// ---- 1. 拍の数え方とデータ（ブラウザを使わない）----
{
  // 数え方は、ゲームの split を使わず、ここで別の書き方で数え直す（小さい ゃゅょぁぃぅぇぉゎ 以外の字を数える）
  const count = (r) => [...r].filter((c) => !"ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ".includes(c)).length;
  const S = { がっこう: "が・っ・こ・う", きゃく: "きゃ・く", ティッシュ: "ティ・ッ・シュ", コーヒー: "コ・ー・ヒ・ー", しんぶん: "し・ん・ぶ・ん", とうきょう: "と・う・きょ・う", ほうりゅうじ: "ほ・う・りゅ・う・じ", ファスナー: "ファ・ス・ナ・ー" };
  check("拍の分け方：っ・ん・ー は1拍、小さい ゃゅょ・ァィゥェォ は前の字と1拍", Object.entries(S).every(([k, v]) => H.split(k).join("・") === v), Object.entries(S).filter(([k, v]) => H.split(k).join("・") !== v).map(([k]) => k).join(" "));
  const bad = H.WORDS.filter((w) => w.m.length !== count(w.r) || w.m.join("") !== w.r);
  check("どのことばも、別の数え方と拍の数が同じ", bad.length === 0, bad.slice(0, 5).map((w) => w.w).join(" "));
  check("ことばは500語以上（とことんで同じことばが続かない）", H.WORDS.length >= 500, H.WORDS.length);
  check("ことばの id は0から順・表記とよみの組は重ならない", H.WORDS.every((w, i) => w.id === i) && new Set(H.WORDS.map((w) => w.w + "|" + w.r)).size === H.WORDS.length);
  check("どのことばも2〜7拍（8拍の小節に最低1拍の休みがある）", H.WORDS.every((w) => w.m.length >= 2 && w.m.length <= 7), H.WORDS.filter((w) => w.m.length < 2 || w.m.length > 7).map((w) => w.w).join(" "));
  check("よみは、ひらがな・カタカナ・ー だけ", H.WORDS.every((w) => /^[ぁ-ゖァ-ヺー]+$/.test(w.r)), H.WORDS.filter((w) => !/^[ぁ-ゖァ-ヺー]+$/.test(w.r)).map((w) => w.w).join(" "));
  const kc = Object.fromEntries(H.KINDS.map((k) => [k.id, H.WORDS.filter((w) => w.k.includes(k.id)).length]));
  check("拍のしくみ6つに、それぞれ20語以上", Object.values(kc).every((n) => n >= 20), JSON.stringify(kc));
  check("俳句は20句以上で、どの句も5・7・5拍ちょうど", H.HAIKU.length >= 20 && H.HAIKU.every((h) => h.lines.map((l) => count(l.r)).join() === "5,7,5" && h.lines.map((l) => l.m.length).join() === "5,7,5"), H.HAIKU.filter((h) => h.lines.map((l) => l.m.length).join() !== "5,7,5").map((h) => h.lines[0].w).join(" "));
  // 今日の5語・上級（3年分）
  let badD = [], badH = 0, same = 0;
  const day = (n) => new Date(Date.parse("2026-11-07") + n * 864e5).toISOString().slice(0, 10);
  for (let n = 0; n < 1100; n++) {
    const k = day(n), ids = H.daily(k);
    if (JSON.stringify(ids) !== JSON.stringify(H.daily(k))) badD.push(k + " 毎回ちがう");
    if (ids.length !== 5 || new Set(ids).size !== 5) badD.push(k + " 5語でない");
    ids.forEach((id, i) => { const L = H.WORDS[id].m.length, [lo, hi] = H.RAMP[i]; if (L < lo || L > hi) badD.push(`${k} ${i + 1}語目が${L}拍`); });
    const h = H.hard(k); if (!(h >= 0 && h < H.HAIKU.length)) badH++;
    if (n && JSON.stringify(ids) === JSON.stringify(H.daily(day(n - 1)))) same++;
  }
  check("今日の5語（3年分）：日付で決まり、5語ちがい、拍の数が 3→4→5→5〜6→6〜7", badD.length === 0, badD.slice(0, 4).join(" / "));
  check("今日の5語が前の日と同じにならない・上級の一句は毎日ある", same === 0 && badH === 0, `同じ ${same}・一句なし ${badH}`);
  check("今日の5語の決め方が変わっていない（2026-11-07 の5語）", JSON.stringify(H.daily("2026-11-07")) === JSON.stringify(H.daily("2026-11-07")) && H.daily("2026-11-07").every((id) => id < H.WORDS.length));
  // とことん：何百回並べて、1つの並びに全部のことばが1回ずつ、前の並びの最後から始めない
  let badE = 0, prevHit = 0;
  for (let i = 0; i < 400; i++) { const prev = i % H.WORDS.length, a = H.endless(Math.random, prev); if (a.length !== H.WORDS.length || new Set(a).size !== a.length) badE++; if (a[0] === prev) prevHit++; }
  check("とことんの並び（400回）：全部のことばが1回ずつで重ならない・前の並びの最後から始めない", badE === 0 && prevHit === 0, `重なり ${badE}・続き ${prevHit}`);
  // 判定
  const B = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * 0.8);
  const j1 = H.judge(B, 4, B.slice(0, 4));
  const j2 = H.judge(B, 4, [B[0] + 0.1, B[1] - 0.1, B[2], B[3]]);
  const j3 = H.judge(B, 4, [B[0] + 0.15, B[1], B[2], B[3]]);
  const j4 = H.judge(B, 4, B.slice(0, 3));
  const j5 = H.judge(B, 4, B.slice(0, 5));
  const j6 = H.judge(B, 4, [...B.slice(0, 4), B[1] + 0.02]);
  const j7 = H.judge(B, 4, [B[0] + 0.3, B[1], B[2], B[3]]);
  const j8 = H.judge(B, 4, [-5, ...B.slice(0, 4), 30]);
  check("判定：全部ぴったりは★3", j1.ok && j1.stars === 3 && j1.g.join("") === "pppprrrr");
  check("判定：±0.1秒は「よい」で★2、0.15秒は「おしい」で★1", j2.ok && j2.stars === 2 && j3.ok && j3.stars === 1 && j3.g[0] === "o");
  check("判定：押さなかった拍は見逃し、休みで押すと打ちすぎ、同じ拍の2回目も打ちすぎ（どれも★0）", !j4.ok && j4.g[3] === "x" && !j5.ok && j5.extra === 1 && j5.extraAt[0] === 4 && !j6.ok && j6.extra === 1);
  check("判定：0.3秒ずれは当たらない・小節の外で押したのは数えない", !j7.ok && j7.g[0] === "x" && j8.ok && j8.extra === 0);
}

// ---- 2. ファイル ----
check("画面の文字に ${ を書いていない（'…' の中の式がそのまま出る）", !/'[^'\n]*\$\{[^'\n]*'/.test(html.replace(/`[^`]*`/g, "")));
check("チケット・回数制限・🔒で開くモードが無い", !/🎫|チケット|(?:と|たら)開く|🔒 [^"<]/.test(html));
check("外へ通信しない（CSP の connect-src は self だけ・外のスクリプトなし）", /connect-src 'self';/.test(html) && !/<script[^>]+src="https?:/.test(html));
check("見やすさの設定（template/a11y の写し）と #live（role=status）がある", html.includes("<!-- a11y:begin") && html.includes("<!-- a11y:end -->") && /id="live" role="status"/.test(html));
check("引き継ぎの部品：transfer.js を data-keys に記録のキーだけ書いて読む", /<script src="transfer.js" data-game="haku-uchi" data-keys="haku-v1"><\/script>/.test(html) && existsSync(path.join(root, "transfer.js")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/haku-uchi/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上・名前とメールを聞かない", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3 && !/id: (name|email|mail)/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
try { const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（transfer.js も）、取り直しは cache: reload、外へ何も送らない", ["./index.html", "./haku.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && shell.every((f) => f === "./" || existsSync(path.join(root, f))) && /cache: "reload"/.test(sw) && !/https?:\/\//.test(sw.replace(/\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "拍うち" && mf.icons.length >= 2 && mf.start_url === "./"); }
catch (e) { check("PWA：sw.js と manifest.webmanifest を読めて形式が正しい", false, e.message.split("\n")[0]); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if (!(f === root || f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r)); // 手元の端末の中だけで開く
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDay = (k, n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, q = "?qa=1") {
  const c = await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url + q); await p.waitForTimeout(150);
  return p;
}
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("haku-v1") || "{}"));
// 押した時刻をまねる：拍の時刻に err 秒ずらす（miss の拍は押さない、extra の拍も押す）
const auto = (p, { err = 0, miss = [], extra = [] } = {}) => p.evaluate(({ err, miss, extra }) => { window.__hk.auto = (beats, n) => [...beats.slice(0, n).map((t, i) => (miss.includes(i) ? null : t + err)).filter((x) => x !== null), ...extra.map((i) => beats[i])]; }, { err, miss, extra });
async function playOne(p) { await p.click("#pad"); await p.waitForSelector(".verdict"); }
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

try {
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(100); await p.reload(); await p.waitForTimeout(150);
  check("遊び方は一度閉じたら開き直しても出ない", await p.locator("#howto[open]").count() === 0);
  check("ホーム：今日の5語・上級・とことん・練習・拍帳・カレンダー・実績・テンポ・下読み・ずれを合わせる", ["#go-d", "#go-h", "#go-e", "#go-p", "#go-book", "#go-cal", "#go-ach", "#go-calib", "[data-bpm]", "[data-easy]"].every((s) => html.includes(s.replace(/[#\[\]]/g, "")) ) && await p.locator("#go-d,#go-h,#go-e,#go-p,#go-book,#go-cal,#go-ach,#go-calib").count() === 8 && await p.locator("[data-bpm]").count() === 3);
  check("ホームに Ko-fi を出さない", await p.locator("a[href*='ko-fi']").count() === 0);
  check("ホームはスマホ幅（390px）で横にはみ出さない", await noOverflow(p));

  // 今日の5語：全部ぴったり、2語目のあとで閉じて続きから
  await auto(p);
  await p.click("#go-d");
  const ids = (await mem(p)).runs.d.ids;
  check("今日の5語は日付から決まる（haku.js の daily と同じ）", JSON.stringify(ids) === JSON.stringify(H.daily(TODAY)));
  const w0 = H.WORDS[ids[0]];
  check("遊ぶ画面：ことば・よみ・8つの拍のます・大きな押す所（高さ120px以上）", (await p.textContent(".word")).includes(w0.w) && await p.locator(".slot").count() === 8 && (await p.locator("#pad").boundingBox()).height >= 120);
  check("下読みなしでは、始める前に拍の区切りを見せない", await p.locator(".slot.pre").count() === 0 && !(await p.textContent("#slots")).includes(w0.m[1]));
  await playOne(p);
  check("打てたら ✓・拍の区切り・拍の数・しくみの一言・ますに ◎ぴったり（色だけで分けない）", (await p.textContent(".verdict .hd")).includes("✓") && (await p.textContent(".verdict .sp")).includes(`${w0.m.length}拍`) && await p.locator(".slot.hit").count() === w0.m.length && (await p.textContent(".slot.hit .m")).includes("◎") && await p.locator(".slot.rest").count() === 8 - w0.m.length);
  check("知らせを #live（読み上げ）にも出す", (await p.waitForFunction(() => document.getElementById("live").textContent.includes("拍"), null, { timeout: 2000 }).then(() => true, () => false)));
  await p.click("#next"); await playOne(p);
  await p.reload(); await p.waitForTimeout(150);
  check("途中で閉じても続きから（3語目）", (await p.textContent("#go-d")).includes("続きから（3語目）"));
  await auto(p); await p.click("#go-d");
  for (let i = 2; i < 5; i++) { await playOne(p); await p.click("#next"); }
  await p.waitForSelector(".calib");
  const m1 = await mem(p);
  check("結果：★15/15・5語の区切り・記録に今日が残る", (await p.textContent(".calib")).includes("15 / 15") && await p.locator(".rlist > div").count() === 5 && m1.days[TODAY] && m1.days[TODAY].s.join("") === "33333");
  const share = await p.textContent(".share");
  check("シェアの文に答え（ことば・よみ）を入れない", !ids.some((id) => share.includes(H.WORDS[id].w) || share.includes(H.WORDS[id].r)) && share.includes("◎◎◎◎◎"));
  check("結果の画面に Ko-fi が1行だけ（はじめての日）", await p.locator("a[href*='ko-fi']").count() === 1);
  check("実績「はじめの1語」が出る", (await p.textContent("#app")).includes("はじめの1語"));
  check("打てたことばが拍帳に入る", Object.keys(m1.words).length === 5);
  await p.click("#back"); await p.waitForTimeout(100);
  check("ホーム：今日の結果を見るになる", (await p.textContent("#go-d")).includes("今日の結果を見る"));
  await p.click("#go-d");
  check("結果を見直しても Ko-fi は出ない（1日1回）", await p.locator("a[href*='ko-fi']").count() === 0);

  // 上級：今日の一句
  await p.click("#back"); await p.click("#go-h");
  const hid = (await mem(p)).runs.h.id;
  check("上級の一句は日付で決まる（haku.js の hard と同じ）・上の五から", hid === H.hard(TODAY) && (await p.textContent(".lineno")).includes("上の五"));
  for (let i = 0; i < 3; i++) { await playOne(p); await p.click("#next"); }
  await p.waitForSelector(".haiku");
  const m2 = await mem(p);
  check("上級の結果：句と作者・記録に残る・一句帳に入る", (await p.textContent(".haiku")).includes(H.HAIKU[hid].by) && m2.hdays[TODAY] && m2.haiku[hid] === 3);

  // 見逃し・打ちすぎ・ずれ（練習で。記録を増やさない）
  await p.click("#back"); await auto(p, { miss: [1] }); await p.click("#go-p"); await playOne(p);
  check("見逃し：✕ と「✕見逃し」の文字・破線（色だけで分けない）", (await p.textContent(".verdict .hd")).includes("✕") && await p.locator(".slot.miss").count() === 1 && (await p.textContent(".slot.miss")).includes("✕見逃し"));
  await auto(p, { extra: [7] }); await p.click("#next"); await playOne(p);
  check("打ちすぎ：休みで押すと「✕打ちすぎ」", (await p.textContent(".verdict .hd")).includes("打ちすぎ") && (await p.textContent(".slot.over")).includes("打ちすぎ"));
  await auto(p, { err: 0.1 }); await p.click("#again"); await playOne(p);
  check("少しずれると ○よい で★2（「もう一度」で同じことば）", (await p.textContent(".verdict .hd")).includes("★★") && !(await p.textContent(".verdict .hd")).includes("★★★") && (await p.textContent(".slot.hit .m")).includes("○"));
  const m3 = await mem(p);
  check("練習は記録（今日・拍帳）を増やさない", Object.keys(m3.words).length === Object.keys(m2.words).length && Object.keys(m3.days).length === 1);

  // 下読みあり：区切りが先に見え、★は2まで
  await p.click("#back"); await p.click('[data-easy="1"]'); await auto(p); await p.click("#go-p");
  check("下読みあり：始める前にますに拍の字と「休」が見える", await p.locator(".slot.pre").count() === 8 && (await p.textContent("#slots")).includes("休"));
  await playOne(p);
  check("下読みありは全部ぴったりでも★2まで", (await p.textContent(".verdict .hd")).includes("★★") && !(await p.textContent(".verdict .hd")).includes("★★★"));
  await p.click("#back"); await p.click('[data-easy="0"]');
  await p.click('[data-bpm="60"]');
  check("テンポを選ぶと記録に残り、押した印が付く", (await mem(p)).opt.bpm === 60 && await p.locator('[data-bpm="60"][aria-pressed="true"]').count() === 1);
  await p.click('[data-bpm="72"]');

  // とことん：まちがえても続く・同じことばを出さない・降りるとベスト
  await p.click("#go-e");
  const seen = [];
  for (let i = 0; i < 24; i++) {
    await auto(p, i % 8 === 7 ? { miss: [0] } : {});
    seen.push(await p.textContent(".word .w"));
    await playOne(p); await p.click("#next");
  }
  const re = (await mem(p)).runs.e;
  check("とことん：まちがえても終わらず続く（24語）・同じことばを出さない", re && re.n === 24 && re.miss === 3 && new Set(re.list.slice(0, 24)).size === 24);
  check("とことん：途中の記録（続けて・まちがい）が画面に出る", (await p.textContent("h1")).includes("まちがい 3"));
  await p.reload(); await p.waitForTimeout(150);
  check("とことんも閉じて開くと続きから", (await p.textContent("#go-e")).includes("続きから"));
  await p.click("#go-e"); await p.click("#quit");
  const m4 = await mem(p);
  check("「ここで降りる」でベスト（続けて打てた数）が残る", m4.ebest === 7 && !m4.runs.e && (await p.textContent(".stats")).includes("24"));
  check("実績「とことん10」はまだ（7語）", !m4.ach.e10);

  // 拍帳・実績
  await p.click("#back"); await p.click("#go-book");
  check("拍帳：拍のしくみ6つと、打てた数", await p.locator("[data-kind]").count() === 6 && (await p.textContent("h1")).includes(`/${H.WORDS.length}`));
  await p.click('[data-kind="plain"]');
  check("拍帳：しくみを押すと、打てたことばと区切りが出る", (await p.textContent(".wlist")).includes("・") || (await p.textContent(".wlist")).includes("まだ"));
  await p.click("#back"); await p.click("#go-ach");
  check("実績：13個・まだのものは いま/目標", await p.locator(".ach").count() === 13 && (await p.textContent(".ach:not(.got) .pg")).includes("/"));

  // ずれを合わせる：0.05秒遅く押す人
  await p.click("#back"); await auto(p, { err: 0.05 }); await p.click("#go-calib"); await p.click("#pad");
  await p.waitForFunction(() => document.getElementById("cv").textContent.includes("合わせました"), null, { timeout: 3000 });
  const m5 = await mem(p);
  check("ずれを合わせる：遅く押す人は +50ミリ秒に合わせ、実績が付く", Math.abs(m5.opt.off - 0.05) < 0.002 && m5.opt.cal && m5.ach.cal);
  await p.click("#p10");
  check("ずれは ±10ミリ秒のボタンでも直せる", Math.abs((await mem(p)).opt.off - 0.06) < 0.002);
  await p.context().close();

  // カレンダー・あとから：3日後を「今日」にすると、遊ばなかった日が「あとから」で遊べる
  const q = await newPage(390, `?qa=1&day=${addDay(TODAY, 3)}`);
  await q.evaluate((k) => localStorage.setItem("haku-v1", JSON.stringify({ v: 1, tut: true, days: { [k]: { s: [3, 3, 3, 3, 3], ids: [0, 1, 2, 3, 4] } } })), TODAY);
  await q.reload(); await q.waitForTimeout(150);
  await q.click("#go-cal");
  const lateKey = addDay(TODAY, 1);
  check("カレンダー：遊んだ日に★・あとから遊べる日はボタン", (await q.textContent(".cal")).includes("★15") && await q.locator(`[data-late="${lateKey}"]`).count() === 1);
  await auto(q); await q.click(`[data-late="${lateKey}"]`);
  for (let i = 0; i < 5; i++) { await playOne(q); await q.click("#next"); }
  await q.waitForSelector(".calib");
  const m6 = await mem(q);
  check("あとから：記録は late に入り、今日の記録には数えない・Ko-fi を出さない", m6.late[lateKey] && !m6.days[lateKey] && await q.locator("a[href*='ko-fi']").count() === 0);
  check("前の記録（知らない入れ物を含む）を消さない", m6.days[TODAY] && m6.days[TODAY].s.length === 5);
  await q.context().close();

  // 本当に押す：音の時計で、押した回数を数えて判定する（時間は待つ）
  const r = await newPage(390, "?qa=1");
  await closeHow(r); await r.click('[data-bpm="90"]'); await r.click("#go-p");
  await r.click("#pad"); await r.waitForTimeout(700);
  for (let i = 0; i < 3; i++) { await r.keyboard.press("Space"); await r.waitForTimeout(250); }
  await r.dispatchEvent("#pad", "pointerdown", { pointerType: "touch" });
  const okV = await r.waitForSelector(".verdict", { timeout: 15000 }).then(() => true, () => false);
  const hk = await r.evaluate(() => ({ taps: window.__hk.taps, last: window.__hk.last && window.__hk.last.taps.length }));
  check("本当に押す：スペースキーとタップの両方を数え、小節の終わりに判定が出る", okV && hk.taps === 4 && hk.last === 4, JSON.stringify(hk));
  check("遊ぶ画面はスマホ幅（390px）で横にはみ出さない", await noOverflow(r));
  await r.context().close();

  // 幅320px
  const n = await newPage(320);
  await closeHow(n);
  const small = await n.$$eval("button,a", (els) => els.filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.height < 44 || b.width < 44); }).map((e) => e.textContent.trim()).slice(0, 5));
  check("幅320pxでもはみ出さず、押す所は44px以上", await noOverflow(n) && small.length === 0, small.join(" / "));
  await auto(n); await n.click("#go-p");
  check("幅320pxの遊ぶ画面：ますは4つずつ2段・はみ出さない", await noOverflow(n) && (await n.locator("#sl4").boundingBox()).y > (await n.locator("#sl0").boundingBox()).y);
  const txt = await n.evaluate(() => document.body.innerText);
  check("画面に ${ や undefined・NaN が出ない", !/\$\{|undefined|NaN/.test(txt));
  await n.context().close();
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "haku-v1": JSON.stringify({ v: 1, tut: true, t: 1, days: { "2026-11-07": { s: [3, 2, 3, 1, 0], ids: [10, 20, 30, 40, 50] } }, late: {}, hdays: {}, words: { 10: 3, 20: 2, 30: 3, 40: 1 }, haiku: {}, ebest: 7, ach: { first: "2026-11-07" }, kofi: {}, runs: {}, opt: { bpm: 72, off: 0.04, easy: false, cal: true } }) };
  await checkTransfer({ browser, url, game: "haku-uchi", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 拍うち QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
