// アプリのアイコン（icon-192.png・icon-512.png）と OGP の絵（og.png）を作る。生成りの地に、8つの拍のます。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
const F = "'Noto Sans CJK JP',sans-serif";
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f6f0e4"/>
      <g transform="translate(12 12) scale(0.76)"><!-- maskable：丸く切られても欠けないよう、中身を中央の安全な円（半径40%）に収める -->
      <text x="50" y="58" font-size="44" text-anchor="middle" fill="#22242e" font-family="${F}" font-weight="900">拍</text>
      ${[0, 1, 2, 3].map((i) => `<rect x="${17 + i * 17}" y="70" width="13" height="13" rx="3" fill="${i < 3 ? "#b23a24" : "#25457d"}"/>`).join("")}</g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const cells = ["が", "っ", "こ", "う", "休", "休", "休", "休"].map((k, i) => `<rect x="${110 + i * 125}" y="360" width="105" height="105" rx="16" fill="${i < 4 ? "#eef7f0" : "#eef2f9"}" stroke="${i < 4 ? "#24704a" : "#25457d"}" stroke-width="5"/><text x="${162 + i * 125}" y="432" font-size="54" text-anchor="middle" fill="#22242e" font-family="${F}" font-weight="900">${k}</text>`).join("");
  await p.setContent(`<body style="margin:0"><svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#f6f0e4"/>
    <text x="600" y="170" font-size="120" text-anchor="middle" fill="#22242e" font-family="${F}" font-weight="900">拍<tspan fill="#b23a24">うち</tspan></text>
    <text x="600" y="270" font-size="48" text-anchor="middle" fill="#50535f" font-family="${F}" font-weight="700">「学校」は何拍？ ことばに手拍子</text>${cells}
    <text x="600" y="560" font-size="40" text-anchor="middle" fill="#50535f" font-family="${F}" font-weight="700">1拍に1回タップする音ゲー</text></svg></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
