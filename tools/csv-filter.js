// CSVの行の絞り込み：指定した文字を含む行を消す／含む行だけ残す
// ファイルはこのブラウザの中だけで処理する（どこにも送らない）。
// 残す行は元のファイルのバイト列をそのまま使うので、文字コード・改行・引用符は元のまま保たれる。
import { injectCss, saveFile, safeName, catchDrops, esc } from "./common.js";

const CSS = `
.cf-file { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-top: 8px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 6px; }
.cf-file .nm { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.cf-file .meta { font-size: 12px; color: var(--sub); }
.cf-file .sp { flex: 1; }
.cf-modes { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cf-mode { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; line-height: 1.5; }
.cf-mode.on { border-color: var(--accent); background: var(--accent-soft); }
.cf-mode input { margin-top: 3px; accent-color: var(--accent); }
.cf-mode b { display: block; font-size: 13px; }
.cf-mode span { display: block; font-size: 12px; color: var(--sub); }
.cf-cond { margin-top: 8px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 16px; }
.cf-cond .fld > label { display: block; font-size: 12px; color: var(--sub); margin-bottom: 4px; }
.cf-cond textarea, .cf-cond select { width: 100%; padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--ink); font: inherit; }
.cf-cond textarea { min-height: 84px; resize: vertical; line-height: 1.6; }
.cf-radios { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: 13px; }
.cf-radios label, .cf-opts label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.cf-radios input, .cf-opts input { accent-color: var(--accent); }
.cf-opts { margin-top: 12px; display: grid; gap: 6px; font-size: 13px; }
.cf-opts a { color: var(--accent); font-size: 12px; margin-left: 4px; }
.cf-sum { margin-top: 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 14px; border-radius: 8px; background: var(--bg); border: 1px solid var(--line); }
.cf-sum .big { font-size: 15px; }
.cf-sum .big b { font-size: 20px; }
.cf-sum .k-keep b { color: var(--accent); }
.cf-sum .k-drop b { color: #c0392b; }
.cf-sum .meta { font-size: 12px; color: var(--sub); }
.cf-tabs { display: flex; gap: 4px; margin-left: auto; }
.cf-tabs button { padding: 3px 10px; border-radius: 99px; border: 1px solid var(--line); font-size: 12px; background: var(--card); }
.cf-tabs button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.cf-table { margin-top: 8px; max-height: 460px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; }
.cf-table table { border-collapse: collapse; font-size: 12px; min-width: 100%; }
.cf-table th, .cf-table td { padding: 4px 8px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); white-space: nowrap; max-width: 280px; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.cf-table thead th { position: sticky; top: 0; background: var(--bg); color: var(--sub); font-weight: 700; z-index: 1; }
.cf-table td.no { color: var(--sub); text-align: right; }
.cf-table td.st { font-size: 11px; }
.cf-table tr.hd td { background: var(--accent-soft); font-weight: 700; }
.cf-table tr.out td { background: rgba(229, 83, 75, .08); color: var(--sub); }
.cf-table tr.out td.st { color: #c0392b; font-weight: 700; }
.cf-table tr.in td.st { color: var(--accent); font-weight: 700; }
.cf-table mark { background: #ffe066; color: #1f2328; border-radius: 2px; }
.cf-more { font-size: 12px; color: var(--sub); margin-top: 6px; }
.cf-bar { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.cf-bar label { font-size: 12px; color: var(--sub); }
.cf-bar .sp { flex: 1; }
.cf-name { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 6px; background: var(--card); }
.cf-name input { width: 220px; padding: 6px 4px 6px 10px; border: 0; background: none; font: inherit; color: var(--ink); outline: none; }
.cf-name span { padding-right: 10px; color: var(--sub); }
@media (max-width: 760px) {
  .cf-modes, .cf-cond { grid-template-columns: 1fr; }
  .cf-tabs { margin-left: 0; }
  .cf-name input { width: 150px; }
  .cf-bar .sp { display: none; }
}
`;

const SHOW_MAX = 300; // 下の一覧に並べる行の上限

// ---- ファイルの読み取り ----
function detectEncoding(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { enc: "utf-8", label: "UTF-8（BOM付き）", skip: 3 };
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return { error: "UTF-16 のファイルには、まだ対応していません。UTF-8 か Shift_JIS のCSVで保存し直してください。" };
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return { enc: "utf-8", label: "UTF-8", skip: 0 }; }
  catch { return { enc: "shift_jis", label: "Shift_JIS", skip: 0 }; }
}

// 1件ずつの行（引用符の中の改行は行の区切りにしない）を、バイト位置で切り出す。
// 「"」と改行は、UTF-8 でも Shift_JIS でも、ほかの文字の一部として現れないので、バイトのまま数えられる。
function splitRecords(bytes, start) {
  const recs = [];
  let inQ = false, s = start;
  for (let i = start; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x22) inQ = !inQ;
    else if (b === 0x0a && !inQ) { recs.push([s, i + 1]); s = i + 1; }
  }
  if (s < bytes.length) recs.push([s, bytes.length]);
  return { recs, broken: inQ };
}
function splitLines(bytes, start) {
  const recs = [];
  let s = start;
  for (let i = start; i < bytes.length; i++) if (bytes[i] === 0x0a) { recs.push([s, i + 1]); s = i + 1; }
  if (s < bytes.length) recs.push([s, bytes.length]);
  return recs;
}

function parseFields(line, d) {
  const f = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"' && cur === "") q = true;
    else if (c === d) { f.push(cur); cur = ""; }
    else cur += c;
  }
  f.push(cur);
  return f;
}
function guessDelimiter(firstLine, name) {
  if (/\.tsv$/i.test(name)) return "\t";
  const tabs = (firstLine.match(/\t/g) || []).length, commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}
const colName = (i) => { let s = ""; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };

export function mount(root) {
  injectCss("cf-style", CSS);

  let data = null; // { name, bytes, bom, enc, label, delim, rows:[{range, text, fields}] , note }
  let view = "all";
  let result = null;
  let timer = 0;

  root.innerHTML = `
    <div class="tk-how">
      <ol class="tk-steps">
        <li><b>CSVを入れる</b><span>Excelで保存したCSVなど</span></li>
        <li><b>条件を決める</b><span>探す文字と、<em>消すか・残すか</em>を選ぶ</span></li>
        <li><b>ダウンロード</b><span>条件どおりに行を絞った<em>新しいCSV</em>ができる</span></li>
      </ol>
      <p class="tk-how-note">例：「担当者」の列に「山田」を含む行だけ残す、「キャンセル」と書かれた行をまとめて消す、など。<b>元のファイルはそのまま残り、書き換えられません。</b>文字コード（Shift_JIS／UTF-8）や改行も、元のファイルのまま保存します。ファイルはこのブラウザの中だけで処理し、どこにも送りません。</p>
    </div>
    <div class="drop tk-drop" tabindex="0" role="button">
      <div><b>CSVをここにドラッグ</b>、または<b>クリックして選ぶ</b></div>
      <div class="tk-note">.csv / .tsv / .txt（Shift_JIS・UTF-8）</div>
    </div>
    <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden>
    <div class="tk-err tk-hide"></div>

    <div class="cf-body tk-hide">
      <div class="cf-file"><span class="nm"></span><span class="meta"></span><span class="sp"></span><button class="btn sm cf-change" type="button">別のファイルにする</button></div>
      <div class="cf-filenote tk-note tk-hide"></div>

      <div class="tk-sec">やりたいこと</div>
      <div class="cf-modes">
        <label class="cf-mode"><input type="radio" name="cf-mode" value="drop" checked><div><b>含む行を消す</b><span>探す文字が入っている行を、行ごと消す。ほかは残す</span></div></label>
        <label class="cf-mode"><input type="radio" name="cf-mode" value="keep"><div><b>含む行だけ残す</b><span>探す文字が入っている行だけを残す。ほかは消す</span></div></label>
      </div>

      <div class="tk-sec">条件</div>
      <div class="cf-cond">
        <div class="fld">
          <label for="cf-words">探す文字（1行に1つ。いくつでも）</label>
          <textarea id="cf-words" spellcheck="false" placeholder="例）キャンセル"></textarea>
          <div class="cf-radios">
            <label><input type="radio" name="cf-any" value="any" checked>どれか1つでも含む</label>
            <label><input type="radio" name="cf-any" value="all">すべて含む</label>
          </div>
        </div>
        <div class="fld">
          <label for="cf-col">探す場所</label>
          <select id="cf-col"></select>
          <div class="cf-opts">
            <label><input type="checkbox" id="cf-head" checked>1行目は見出しとして必ず残す</label>
            <label><input type="checkbox" id="cf-norm">全角・半角、大文字・小文字の違いを無視する</label>
            <label><input type="checkbox" id="cf-re">正規表現で探す<a href="#regex">よく使う正規表現 →</a></label>
          </div>
        </div>
      </div>
      <div class="cf-condnote tk-err tk-hide"></div>

      <div class="cf-sum">
        <span class="big k-keep">残る <b class="n-keep">0</b> 行</span>
        <span class="big k-drop">消える <b class="n-drop">0</b> 行</span>
        <span class="meta n-all"></span>
        <div class="cf-tabs">
          <button type="button" data-view="all" class="on">すべて</button>
          <button type="button" data-view="keep">残る行</button>
          <button type="button" data-view="drop">消える行</button>
        </div>
      </div>
      <div class="cf-table"><table><thead></thead><tbody></tbody></table></div>
      <div class="cf-more"></div>

      <div class="cf-bar">
        <span class="sp"></span>
        <label for="cf-name">保存するファイル名</label>
        <div class="cf-name"><input id="cf-name" type="text"><span class="ext">.csv</span></div>
        <button class="btn cf-clear" type="button">クリア</button>
        <button class="btn primary cf-run" type="button">絞り込んでダウンロード</button>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const drop = $(".tk-drop"), input = $("input[type=file]"), err = $(".tk-err");
  const body = $(".cf-body"), words = $("#cf-words"), colSel = $("#cf-col");
  const headBox = $("#cf-head"), normBox = $("#cf-norm"), reBox = $("#cf-re"), condNote = $(".cf-condnote");
  const nameInput = $("#cf-name"), runBtn = $(".cf-run");

  drop.onclick = () => input.click();
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
  input.onchange = () => { if (input.files[0]) load(input.files[0]); input.value = ""; };
  $(".cf-change").onclick = () => input.click();
  const stopDrops = catchDrops(drop, (fs) => fs[0] && load(fs[0]));

  function showError(t) { err.textContent = t || ""; err.classList.toggle("tk-hide", !t); }

  async function load(file) {
    showError("");
    if (file.size > 200 * 1024 * 1024) { showError("ファイルが大きすぎます（200MBまで）。"); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const det = detectEncoding(bytes);
    if (det.error) { showError(det.error); return; }
    let { recs, broken } = splitRecords(bytes, det.skip);
    let note = "";
    if (broken) { recs = splitLines(bytes, det.skip); note = "引用符（\"）の対応が取れない所があったため、改行ごとに1行として扱っています。"; }
    if (!recs.length) { showError(`「${file.name}」には中身がありません。`); return; }
    const dec = new TextDecoder(det.enc);
    const rows = recs.map((r) => ({ range: r, text: dec.decode(bytes.subarray(r[0], r[1])).replace(/\r?\n$/, "") }));
    const delim = guessDelimiter(rows[0].text, file.name);
    for (const r of rows) r.fields = parseFields(r.text, delim);
    const ext = (file.name.match(/\.(csv|tsv|txt)$/i) || [".csv"])[0];
    data = { name: file.name, bytes, bom: det.skip, label: det.label, delim, rows, ext };
    $(".cf-file .nm").textContent = file.name;
    $(".cf-file .meta").textContent = `${rows.length.toLocaleString()} 行 ・ ${det.label} ・ ${delim === "\t" ? "タブ区切り" : "カンマ区切り"}`;
    $(".cf-filenote").textContent = note;
    $(".cf-filenote").classList.toggle("tk-hide", !note);
    $(".ext").textContent = ext.toLowerCase();
    nameInput.value = file.name.replace(/\.(csv|tsv|txt)$/i, "") + "_絞り込み";
    fillColumns();
    drop.classList.add("small");
    body.classList.remove("tk-hide");
    run();
  }

  function fillColumns() {
    const n = Math.max(...data.rows.slice(0, 50).map((r) => r.fields.length));
    const head = headBox.checked ? data.rows[0].fields : [];
    const prev = colSel.value;
    colSel.innerHTML = `<option value="-1">行全体（どの列でも）</option>` +
      Array.from({ length: n }, (_, i) => `<option value="${i}">${colName(i)}列${head[i] ? "：" + esc(head[i].slice(0, 30)) : ""}</option>`).join("");
    if ([...colSel.options].some((o) => o.value === prev)) colSel.value = prev;
  }

  const norm = (s) => s.normalize("NFKC").toLowerCase();

  // 条件から「当てはまるか」を調べる関数を作る
  function makeTester() {
    const list = words.value.split(/\r?\n/).map((s) => s.trim() ? s : "").filter(Boolean);
    if (!list.length) return { empty: true };
    const useNorm = normBox.checked;
    let tests;
    if (reBox.checked) {
      try {
        tests = list.map((w) => { const re = new RegExp(useNorm ? norm(w) : w, useNorm ? "i" : ""); return (s) => re.test(s); });
      } catch (e) { return { error: "正規表現の書き方に誤りがあります：" + e.message.replace(/^Invalid regular expression: /, "") }; }
    } else {
      const ws = list.map((w) => (useNorm ? norm(w) : w));
      tests = ws.map((w) => (s) => s.includes(w));
    }
    const all = $('input[name="cf-any"]:checked').value === "all";
    const col = Number(colSel.value);
    return {
      list,
      test(row) {
        let s = col < 0 ? row.fields.join(" ") : (row.fields[col] ?? "");
        if (useNorm) s = norm(s);
        return all ? tests.every((t) => t(s)) : tests.some((t) => t(s));
      },
    };
  }

  function run() {
    if (!data) return;
    const mode = $('input[name="cf-mode"]:checked').value;
    root.querySelectorAll(".cf-mode").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
    const t = makeTester();
    condNote.textContent = t.error || "";
    condNote.classList.toggle("tk-hide", !t.error);
    const head = headBox.checked;
    const states = data.rows.map((row, i) => {
      if (head && i === 0) return "head";
      if (t.empty || t.error) return "keep";
      const hit = t.test(row);
      return (mode === "drop" ? !hit : hit) ? "keep" : "drop";
    });
    const nBody = data.rows.length - (head ? 1 : 0);
    const nKeep = states.filter((s) => s === "keep").length;
    $(".n-keep").textContent = nKeep.toLocaleString();
    $(".n-drop").textContent = (nBody - nKeep).toLocaleString();
    $(".n-all").textContent = t.empty ? `全 ${nBody.toLocaleString()} 行（探す文字を入れると、ここで数が変わります）` : `全 ${nBody.toLocaleString()} 行${head ? "（見出しを除く）" : ""}`;
    result = { states, tester: t };
    runBtn.disabled = !!(t.empty || t.error);
    drawTable();
  }

  function highlight(s, t) {
    if (!t || t.empty || t.error || normBox.checked) return esc(s);
    const list = t.list;
    let re;
    try {
      re = new RegExp(reBox.checked ? list.map((w) => `(?:${w})`).join("|") : list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
    } catch { return esc(s); }
    let out = "", at = 0, m;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      out += esc(s.slice(at, m.index)) + "<mark>" + esc(m[0]) + "</mark>";
      at = m.index + m[0].length;
    }
    return out + esc(s.slice(at));
  }

  function drawTable() {
    const { states, tester } = result;
    const n = Math.max(...data.rows.slice(0, 50).map((r) => r.fields.length));
    const col = Number(colSel.value);
    const thead = `<tr><th>行</th><th>結果</th>${Array.from({ length: n }, (_, i) => `<th>${colName(i)}</th>`).join("")}</tr>`;
    const rows = [];
    let shown = 0, total = 0;
    for (let i = 0; i < data.rows.length; i++) {
      const st = states[i];
      if (view !== "all" && st !== view && !(st === "head" && view === "keep")) continue;
      total++;
      if (shown >= SHOW_MAX) continue;
      shown++;
      const f = data.rows[i].fields;
      const label = st === "head" ? "見出し" : st === "keep" ? "残る" : "消える";
      const cls = st === "head" ? "hd" : st === "keep" ? "in" : "out";
      rows.push(`<tr class="${cls}"><td class="no">${i + 1}</td><td class="st">${label}</td>${Array.from({ length: Math.max(n, f.length) }, (_, k) =>
        `<td title="${esc(f[k] ?? "")}">${st !== "head" && (col < 0 || col === k) ? highlight(f[k] ?? "", tester) : esc(f[k] ?? "")}</td>`).join("")}</tr>`);
    }
    $(".cf-table thead").innerHTML = thead;
    $(".cf-table tbody").innerHTML = rows.join("") || `<tr><td colspan="${n + 2}" style="color:var(--sub)">当てはまる行はありません</td></tr>`;
    $(".cf-more").textContent = total > SHOW_MAX ? `ここには先頭の ${SHOW_MAX} 行だけ表示しています（全 ${total.toLocaleString()} 行）。ダウンロードするファイルには、すべての行が入ります。` : "";
    root.querySelectorAll(".cf-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
  }

  function later() { clearTimeout(timer); timer = setTimeout(run, 150); }
  words.oninput = later;
  root.querySelectorAll('input[name="cf-mode"], input[name="cf-any"]').forEach((r) => (r.onchange = run));
  colSel.onchange = run;
  headBox.onchange = () => { fillColumns(); run(); };
  normBox.onchange = reBox.onchange = run;
  root.querySelector(".cf-tabs").onclick = (e) => { const b = e.target.closest("button"); if (b && result) { view = b.dataset.view; drawTable(); } };

  runBtn.onclick = () => {
    if (!data || !result) return;
    const parts = [];
    let size = data.bom;
    data.rows.forEach((r, i) => { if (result.states[i] !== "drop") { parts.push(r.range); size += r.range[1] - r.range[0]; } });
    const outBytes = new Uint8Array(size);
    let at = 0;
    if (data.bom) { outBytes.set(data.bytes.subarray(0, data.bom), 0); at = data.bom; }
    for (const [s, e] of parts) { outBytes.set(data.bytes.subarray(s, e), at); at += e - s; }
    const type = data.label.startsWith("Shift") ? "text/csv;charset=shift_jis" : "text/csv;charset=utf-8";
    saveFile(outBytes, safeName(nameInput.value, "絞り込み") + data.ext.toLowerCase(), type);
  };
  $(".cf-clear").onclick = () => {
    data = null; result = null; words.value = "";
    body.classList.add("tk-hide"); drop.classList.remove("small"); showError("");
  };

  return () => { stopDrops(); clearTimeout(timer); };
}
