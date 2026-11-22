// PDFの分割
// ファイルはすべてこのブラウザの中で処理する（どこにも送らない）。
// - 分割：pdf-lib
// - ページの小さな画像（サムネイル）：pdf.js
// - 複数のPDFを1つにまとめて保存：fflate（ZIP）
import { PDFDocument, openView, readPdf, makeThumbs, saveFile, safeName, catchDrops, injectCss } from "./pdf-common.js";
import { zipSync } from "/vendor/fflate/fflate.js";

const CSS = `
.ps-file { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; }
.ps-file .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps-file .ct { font-size: 12px; color: var(--sub); white-space: nowrap; }
.ps-modes { margin-top: 8px; display: grid; gap: 8px; }
.ps-mode { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; }
.ps-mode.on { border-color: var(--accent); background: var(--accent-soft); }
.ps-mode input[type=radio] { accent-color: var(--accent); }
.ps-mode .lb { font-weight: 700; min-width: 13em; }
.ps-mode .fld { display: flex; align-items: center; gap: 6px; }
.ps-mode input[type=number], .ps-mode input[type=text] { padding: 5px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); font: inherit; color: var(--ink); }
.ps-mode input[type=number] { width: 80px; }
.ps-mode input[type=text] { width: 260px; max-width: 100%; }
.ps-mode .hint { flex-basis: 100%; font-size: 12px; color: var(--sub); padding-left: 24px; }
.ps-groups { margin-top: 8px; display: grid; gap: 10px; }
.ps-group { border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
.ps-ghead { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.ps-ghead b { font-size: 13px; }
.ps-ghead .rg { font-size: 12px; color: var(--sub); }
.ps-ghead .out { flex: 1; min-width: 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps-ghead .btn { padding: 3px 10px; font-size: 12px; }
.ps-strip { margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
.ps-pg { border: 1px solid var(--line); border-radius: 4px; padding: 4px; background: var(--card); }
.ps-pg .pm-thumb { margin-top: 0; }
.ps-pg span { display: block; margin-top: 2px; font-size: 11px; color: var(--sub); text-align: center; }
.ps-more { display: grid; place-items: center; font-size: 12px; color: var(--sub); border: 1px dashed var(--line); border-radius: 4px; }
.ps-skip { font-size: 12px; color: var(--sub); }
@media (max-width: 760px) {
  .ps-mode .lb { min-width: 0; }
  .ps-mode .hint { padding-left: 0; }
  .ps-strip { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); }
  .ps-ghead .out { flex-basis: 100%; order: 3; }
  .ps-ghead .btn { order: 4; }
}
`;

// 1つのまとまりに並べて見せるページの上限（多すぎると画面が長くなりすぎるため）
const SHOW_MAX = 12;

// 全角の数字や記号を半角にそろえる（「１－３、５」も書けるように）
const normalize = (s) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−‐ー～〜~]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/[、，,・\s]+/g, ",");

// 「1-3, 5, 8-10」を、まとまりごとのページ番号（0始まり）の並びにする
function parseRanges(text, total) {
  const items = normalize(text).split(",").filter(Boolean);
  if (!items.length) return { error: "分けるページを入力してください。" };
  const groups = [];
  for (const it of items) {
    const m = it.match(/^(\d+)(?:-(\d*))?$/);
    if (!m) return { error: `「${it}」の書き方が読み取れません。「1-3, 5, 8-10」のように書いてください。` };
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : m[2] === "" ? total : Number(m[2]);
    if (a < 1 || b < 1 || a > total || b > total) return { error: `「${it}」はページの範囲外です（このPDFは${total}ページです）。` };
    if (a > b) return { error: `「${it}」は、始めのページが終わりのページより後ろになっています。` };
    groups.push(Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k));
  }
  return { groups };
}

function everyN(n, total) {
  const groups = [];
  for (let s = 0; s < total; s += n) groups.push(Array.from({ length: Math.min(n, total - s) }, (_, k) => s + k));
  return groups;
}

export function mount(root) {
  injectCss("ps-style", CSS);

  let file = null; // { name, lib, pageCount, doc, task }
  let busy = false, alive = true;

  root.innerHTML = `
    <div class="pm-how">
      <ol class="pm-steps">
        <li><b>PDFを入れる</b><span>分けたいPDFを1つ入れる</span></li>
        <li><b>分け方を決める</b><span>ページ数ごと、またはページを指定する</span></li>
        <li><b>ダウンロード</b><span>分けたPDFを<em>ZIPにまとめて</em>保存する</span></li>
      </ol>
      <p class="pm-how-note">例：10ページのPDFを「3ページずつ」で分けると、1〜3・4〜6・7〜9・10ページの4つのPDFができ、1つのZIPファイルにまとめてダウンロードされます。<b>元のPDFはそのまま残り、書き換えられません。</b>ファイルはこのブラウザの中だけで処理し、どこにも送りません。</p>
    </div>
    <div class="drop pm-drop" tabindex="0" role="button">
      <div class="lead"><b>PDFをここにドラッグ</b>、または<b>クリックして選ぶ</b></div>
    </div>
    <input type="file" accept="application/pdf,.pdf" hidden>
    <div class="pm-err pm-hide"></div>

    <div class="pm-body pm-hide">
      <div class="pm-sec">ファイル</div>
      <div class="ps-file"><span class="nm"></span><span class="ct"></span></div>

      <div class="pm-sec">分け方</div>
      <div class="ps-modes">
        <label class="ps-mode" data-mode="every">
          <input type="radio" name="ps-mode" value="every" checked>
          <span class="lb">ページ数ごとに分ける</span>
          <span class="fld"><input type="number" class="ps-n" min="1" value="1" inputmode="numeric"> ページずつ</span>
          <span class="hint">先頭から決まったページ数ごとに区切ります。最後に余ったページも1つのPDFになります。</span>
        </label>
        <label class="ps-mode" data-mode="ranges">
          <input type="radio" name="ps-mode" value="ranges">
          <span class="lb">ページを指定して分ける</span>
          <span class="fld"><input type="text" class="ps-r" placeholder="例：1-3, 5, 8-10"></span>
          <span class="hint">カンマで区切ったまとまりごとに、1つのPDFになります。書かなかったページは含めません。「8-」と書くと8ページ目から最後までです。</span>
        </label>
      </div>

      <div class="pm-sec">できあがり <span class="ps-total"></span></div>
      <div class="ps-groups"></div>

      <div class="pm-bar">
        <span class="sp"></span>
        <label for="ps-name">ファイル名の頭</label>
        <div class="pm-name"><input id="ps-name" type="text"><span>_p01-03.pdf</span></div>
        <button class="btn pm-clear" type="button">クリア</button>
        <button class="btn primary pm-run" type="button">分割してダウンロード</button>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const drop = $(".pm-drop"), input = $("input[type=file]"), err = $(".pm-err");
  const body = $(".pm-body"), groupsEl = $(".ps-groups"), total = $(".ps-total");
  const nIn = $(".ps-n"), rIn = $(".ps-r"), nameIn = $("#ps-name");
  const runBtn = $(".pm-run"), clearBtn = $(".pm-clear");

  const thumbs = makeThumbs((card) => (file?.doc ? { doc: file.doc, index: Number(card.dataset.page) } : null));

  // ---- ファイルの受け取り ----
  drop.onclick = () => input.click();
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
  input.onchange = () => { load([...input.files]); input.value = ""; };
  const stopDrops = catchDrops(drop, load);

  async function load(list) {
    if (busy || !list.length) return;
    const problems = [];
    if (list.length > 1) problems.push("分割できるのは1回に1つのPDFです。最初のファイルだけを読み込みました。");
    busy = true;
    const r = await readPdf(list[0]);
    busy = false;
    if (r.error) { showError([...problems, r.error]); return; }
    unload();
    file = { name: list[0].name, lib: r.lib, pageCount: r.pageCount, doc: null, task: null };
    const me = file;
    openView(r.bytes).then(({ task, doc }) => {
      me.task = task;
      if (!alive || file !== me) { task.destroy(); return; }
      me.doc = doc;
      groupsEl.querySelectorAll(".ps-pg").forEach((n) => thumbs.observe(n));
    }).catch(() => {});
    nameIn.value = file.name.replace(/\.pdf$/i, "");
    showError(problems);
    draw();
  }

  function unload() {
    if (file?.doc) thumbs.forget(file.doc);
    file?.task?.destroy();
    file = null;
  }

  // ---- 分け方 ----
  const mode = () => root.querySelector("input[name=ps-mode]:checked").value;

  function plan() {
    if (!file) return { groups: [] };
    if (mode() === "every") {
      const n = Math.floor(Number(normalize(nIn.value)));
      if (!(n >= 1)) return { error: "何ページずつ分けるかを、1以上の数で入力してください。" };
      return { groups: everyN(n, file.pageCount) };
    }
    return parseRanges(rIn.value, file.pageCount);
  }

  const pad = () => String(file.pageCount).length;
  const label = (g) => {
    const p = (i) => String(i + 1).padStart(pad(), "0");
    return g.length === 1 ? `p${p(g[0])}` : `p${p(g[0])}-${p(g[g.length - 1])}`;
  };
  const outName = (g) => `${safeName(nameIn.value, "分割")}_${label(g)}.pdf`;
  const isContinuous = (g) => g.every((v, i) => i === 0 || v === g[i - 1] + 1);

  // ---- 描画 ----
  let current = [];
  function draw() {
    const has = !!file;
    body.classList.toggle("pm-hide", !has);
    drop.classList.toggle("small", has);
    drop.querySelector(".lead").innerHTML = has
      ? "<b>別のPDFに入れ替える</b><span class=\"pm-wide\">（ドラッグ、またはクリック）</span>"
      : "<b>PDFをここにドラッグ</b>、または<b>クリックして選ぶ</b>";
    root.querySelectorAll(".ps-mode").forEach((m) => m.classList.toggle("on", m.dataset.mode === mode()));
    if (!has) { groupsEl.replaceChildren(); current = []; runBtn.disabled = true; return; }

    $(".ps-file .nm").textContent = file.name;
    $(".ps-file .nm").title = file.name;
    $(".ps-file .ct").textContent = `${file.pageCount}ページ`;

    const r = plan();
    groupsEl.querySelectorAll(".ps-pg").forEach((n) => thumbs.unobserve(n));
    groupsEl.replaceChildren();
    if (r.error) {
      current = [];
      total.textContent = "";
      groupsEl.innerHTML = `<div class="pm-err" style="margin-top:0"></div>`;
      groupsEl.firstChild.textContent = r.error;
    } else {
      current = r.groups;
      const used = new Set(current.flat()).size;
      total.textContent = `（${current.length}個のPDFができます${used < file.pageCount ? `・含めないページ ${file.pageCount - used}ページ` : ""}）`;
      current.forEach((g, i) => {
        const box = document.createElement("div");
        box.className = "ps-group";
        const range = isContinuous(g)
          ? (g.length === 1 ? `${g[0] + 1}ページ目` : `${g[0] + 1}〜${g[g.length - 1] + 1}ページ（${g.length}ページ）`)
          : `${g.length}ページ`;
        box.innerHTML = `<div class="ps-ghead"><b>${i + 1}つ目</b><span class="rg">${range}</span><span class="out"></span><button class="btn" type="button">このPDFだけ保存</button></div><div class="ps-strip"></div>`;
        box.querySelector(".out").textContent = "→ " + outName(g);
        box.querySelector("button").onclick = () => saveOne(g);
        const strip = box.querySelector(".ps-strip");
        const show = g.length > SHOW_MAX ? [...g.slice(0, SHOW_MAX - 2), null, g[g.length - 1]] : g;
        for (const pi of show) {
          if (pi === null) {
            const more = document.createElement("div");
            more.className = "ps-more";
            more.textContent = `ほか ${g.length - SHOW_MAX + 1}ページ`;
            strip.appendChild(more);
            continue;
          }
          const pg = document.createElement("div");
          pg.className = "ps-pg";
          pg.dataset.page = pi;
          pg.innerHTML = `<div class="pm-thumb"></div><span>p.${pi + 1}</span>`;
          strip.appendChild(pg);
          if (file.doc) thumbs.observe(pg);
        }
        groupsEl.appendChild(box);
      });
    }
    $(".pm-name span").textContent = current.length ? "_" + label(current[0]) + ".pdf" : ".pdf";
    runBtn.disabled = busy || !current.length;
    if (!busy) runBtn.textContent = current.length > 1 ? `分割してダウンロード（${current.length}ファイル・ZIP）` : "分割してダウンロード";
  }

  root.querySelectorAll("input[name=ps-mode]").forEach((r) => (r.onchange = () => {
    draw();
    (mode() === "every" ? nIn : rIn).focus();
  }));
  // 入力欄を触ったら、その分け方を選んだことにする
  nIn.onfocus = () => { root.querySelector("input[value=every]").checked = true; draw(); };
  rIn.onfocus = () => { root.querySelector("input[value=ranges]").checked = true; draw(); };
  let timer;
  const later = () => { clearTimeout(timer); timer = setTimeout(draw, 250); };
  nIn.oninput = later;
  rIn.oninput = later;
  nameIn.oninput = later;

  // ---- 作る・保存する ----
  async function build(g) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(file.lib, g);
    pages.forEach((p) => out.addPage(p));
    out.setTitle(outName(g).replace(/\.pdf$/, ""));
    return out.save();
  }

  async function saveOne(g) {
    if (busy) return;
    try { saveFile(await build(g), outName(g), "application/pdf"); }
    catch (e) { console.error(e); showError(["PDFを作れませんでした。ファイルの中身に、この道具で扱えない形式が含まれている可能性があります。"]); }
  }

  runBtn.onclick = async () => {
    if (busy || !current.length) return;
    busy = true;
    runBtn.disabled = true;
    showError([]);
    try {
      if (current.length === 1) {
        runBtn.textContent = "作成中…";
        saveFile(await build(current[0]), outName(current[0]), "application/pdf");
      } else {
        const entries = {};
        const names = new Set();
        for (let i = 0; i < current.length; i++) {
          runBtn.textContent = `作成中… ${i + 1} / ${current.length}`;
          let n = outName(current[i]);
          // 同じ範囲を2回書いたときに、ZIPの中で名前がぶつからないようにする
          for (let k = 2; names.has(n); k++) n = outName(current[i]).replace(/\.pdf$/, `_${k}.pdf`);
          names.add(n);
          entries[n] = [await build(current[i]), { level: 0 }]; // PDFはもともと圧縮されているので、ZIPでは圧縮しない
        }
        runBtn.textContent = "ZIPにまとめています…";
        await new Promise((r) => setTimeout(r));
        saveFile(zipSync(entries), `${safeName(nameIn.value, "分割")}_分割.zip`, "application/zip");
      }
      busy = false;
      runBtn.textContent = "ダウンロードしました";
      setTimeout(() => { if (alive && !busy) draw(); }, 2500);
    } catch (e) {
      console.error(e);
      busy = false;
      showError(["分割できませんでした。ファイルの中身に、この道具で扱えない形式が含まれている可能性があります。"]);
      draw();
    }
    runBtn.disabled = !current.length;
  };

  clearBtn.onclick = () => {
    unload();
    nIn.value = "1";
    rIn.value = "";
    root.querySelector("input[value=every]").checked = true;
    showError([]);
    draw();
  };

  function showError(list) {
    err.textContent = list.join("\n");
    err.classList.toggle("pm-hide", !list.length);
  }

  draw();

  return () => {
    alive = false;
    clearTimeout(timer);
    stopDrops();
    thumbs.stop();
    unload();
  };
}
