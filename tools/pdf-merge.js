// PDFの結合
// ファイルはすべてこのブラウザの中で処理する（どこにも送らない）。
// - 結合：pdf-lib
// - ページの小さな画像（サムネイル）：pdf.js
// - ドラッグでの並べ替え：SortableJS
import { PDFDocument } from "/vendor/pdf-lib/pdf-lib.esm.min.js";
import Sortable from "/vendor/sortable/sortable.core.esm.js";

const PDFJS = "/vendor/pdfjs/";
let pdfjsReady;
function loadPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = import(PDFJS + "pdf.min.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsReady;
}

// ファイルごとの目印の色
const COLORS = ["#2f6f5e", "#b5651d", "#3b6ea5", "#8e4585", "#6b8e23", "#a33d3d", "#4a6670", "#b08d1a"];

const CSS = `
.pm-drop { margin-top: 0; cursor: pointer; transition: border-color .15s, background .15s; }
.pm-drop:hover, .pm-drop.over { border-color: var(--accent); background: var(--accent-soft); color: var(--ink); }
.pm-drop b { color: var(--accent); }
.pm-drop.small { padding: 14px 16px; }
.pm-note { margin-top: 8px; font-size: 12px; color: var(--sub); }
.pm-err { margin-top: 12px; padding: 10px 14px; border-radius: 6px; background: var(--warn-soft); color: var(--warn); font-size: 13px; white-space: pre-line; }
.pm-sec { margin-top: 20px; font-size: 12px; font-weight: 700; color: var(--sub); display: flex; align-items: baseline; gap: 8px; }
.pm-sec span { font-weight: 400; }
.pm-files { margin-top: 8px; border: 1px solid var(--line); border-radius: 6px; }
.pm-file { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-top: 1px solid var(--line); }
.pm-file:first-child { border-top: 0; }
.pm-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.pm-fname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-fcount { font-size: 12px; color: var(--sub); white-space: nowrap; }
.pm-ibtn { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; color: var(--sub); }
.pm-ibtn:hover:not(:disabled) { background: var(--accent-soft); color: var(--ink); }
.pm-ibtn:disabled { opacity: .3; cursor: default; }
.pm-pages { margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 12px; }
.pm-page { position: relative; border: 1px solid var(--line); border-radius: 6px; background: var(--card); padding: 6px; cursor: grab; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.pm-page:active { cursor: grabbing; }
.pm-page .pm-band { position: absolute; left: 0; right: 0; top: 0; height: 4px; border-radius: 6px 6px 0 0; }
.pm-thumb { margin-top: 4px; display: grid; place-items: center; aspect-ratio: 1 / 1.414; background: var(--bg); border-radius: 3px; overflow: hidden; }
.pm-thumb canvas { max-width: 100%; max-height: 100%; box-shadow: 0 0 0 1px rgba(0,0,0,.08); background: #fff; }
.pm-cap { margin-top: 4px; font-size: 11px; color: var(--sub); line-height: 1.4; display: flex; gap: 4px; }
.pm-cap .no { font-weight: 700; color: var(--ink); }
.pm-cap .src { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-del { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 99px; background: rgba(31,35,40,.78); color: #fff; opacity: 0; transition: opacity .15s; }
.pm-page:hover .pm-del, .pm-del:focus-visible { opacity: 1; }
@media (hover: none) { .pm-del { opacity: 1; } }
.pm-ghost { opacity: .35; }
.pm-chosen { border-color: var(--accent); box-shadow: 0 4px 14px rgba(0,0,0,.18); }
.pm-bar { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.pm-bar label { font-size: 12px; color: var(--sub); }
.pm-name { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 6px; background: var(--card); }
.pm-name input { width: 200px; padding: 6px 4px 6px 10px; border: 0; background: none; font: inherit; color: var(--ink); outline: none; }
.pm-name span { padding-right: 10px; color: var(--sub); }
.pm-bar .sp { flex: 1; }
.pm-hide { display: none !important; }
@media (max-width: 760px) {
  .pm-pages { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .pm-name input { width: 140px; }
  .pm-bar .sp { display: none; }
  .pm-wide { display: none; }
}
`;

const ICO = {
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
};
const ic = (k, s = 16) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export function mount(root) {
  if (!document.getElementById("pm-style")) {
    const st = el("style");
    st.id = "pm-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---- 状態 ----
  let files = [];   // { id, name, color, lib(pdf-lib), view(pdf.js), pageCount }
  let pages = [];   // { key, fileId, index }
  let deleted = []; // 削除したページ（戻す用）{ page, pos }
  let seq = 0;
  let busy = false;
  let alive = true;

  // ---- 画面 ----
  root.innerHTML = `
    <div class="drop pm-drop" tabindex="0" role="button">
      <div><b>PDFをここにドラッグ</b>、または<b>クリックして選ぶ</b></div>
      <div class="pm-note">複数まとめて選べます。あとから追加もできます。</div>
    </div>
    <input type="file" accept="application/pdf,.pdf" multiple hidden>
    <div class="pm-err pm-hide"></div>

    <div class="pm-body pm-hide">
      <div class="pm-sec">ファイル <span>（↑↓でファイルごと順番を変える）</span></div>
      <div class="pm-files"></div>

      <div class="pm-sec">ページ <span class="pm-total"></span></div>
      <div class="pm-note" style="margin-top:2px">ドラッグで並べ替え、×でそのページを外します。この並び順のまま1つのPDFになります。</div>
      <div class="pm-pages"></div>

      <div class="pm-bar">
        <button class="btn pm-undo" type="button"></button>
        <span class="sp"></span>
        <label for="pm-name">保存するファイル名</label>
        <div class="pm-name"><input id="pm-name" type="text" value="結合"><span>.pdf</span></div>
        <button class="btn pm-clear" type="button">クリア</button>
        <button class="btn primary pm-run" type="button">結合してダウンロード</button>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const drop = $(".pm-drop"), input = $("input[type=file]"), err = $(".pm-err");
  const body = $(".pm-body"), fileList = $(".pm-files"), grid = $(".pm-pages");
  const total = $(".pm-total"), undoBtn = $(".pm-undo"), runBtn = $(".pm-run");
  const clearBtn = $(".pm-clear"), nameInput = $("#pm-name");

  // ---- ファイルの受け取り ----
  drop.onclick = () => input.click();
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
  input.onchange = () => { addFiles([...input.files]); input.value = ""; };

  // 画面のどこに落としても受け取る（ブラウザがPDFを開いてしまうのを防ぐ）
  const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const onDragOver = (e) => { if (!isFileDrag(e)) return; e.preventDefault(); drop.classList.add("over"); };
  const onDragLeave = (e) => { if (!e.relatedTarget) drop.classList.remove("over"); };
  const onDrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    drop.classList.remove("over");
    addFiles([...e.dataTransfer.files]);
  };
  addEventListener("dragover", onDragOver);
  addEventListener("dragleave", onDragLeave);
  addEventListener("drop", onDrop);

  async function addFiles(list) {
    if (busy || !list.length) return;
    const problems = [];
    const pdfs = list.filter((f) => {
      const ok = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!ok) problems.push(`「${f.name}」はPDFではないため、追加しませんでした。`);
      return ok;
    });
    setBusy(true, "読み込み中…");
    for (const f of pdfs) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        let lib;
        try {
          lib = await PDFDocument.load(bytes, { updateMetadata: false });
        } catch (e) {
          if (/encrypt/i.test(String(e?.message))) {
            problems.push(`「${f.name}」は保護（パスワードや編集制限）がかかっているため、結合できません。保護を外してから入れてください。`);
          } else {
            problems.push(`「${f.name}」は読み込めませんでした。壊れているか、PDFとして正しくない可能性があります。`);
          }
          continue;
        }
        const pageCount = lib.getPageCount();
        if (!pageCount) { problems.push(`「${f.name}」にはページがありません。`); continue; }
        const id = ++seq;
        const file = { id, name: f.name, color: COLORS[(id - 1) % COLORS.length], lib, pageCount, view: null, task: null };
        files.push(file);
        for (let i = 0; i < pageCount; i++) pages.push({ key: `${id}-${i}`, fileId: id, index: i });
        // サムネイル用（失敗しても結合はできる）
        loadPdfjs()
          .then((pdfjs) => {
            file.task = pdfjs.getDocument({
              data: bytes.slice(),
              cMapUrl: PDFJS + "cmaps/", cMapPacked: true,
              standardFontDataUrl: PDFJS + "standard_fonts/",
              wasmUrl: PDFJS + "wasm/", iccUrl: PDFJS + "iccs/",
              isEvalSupported: false,
            });
            return file.task.promise;
          })
          .then((doc) => {
            if (!alive || !files.includes(file)) { file.task.destroy(); return; }
            file.view = doc;
            grid.querySelectorAll(`[data-file="${id}"]`).forEach((n) => observer.observe(n));
          })
          .catch(() => {});
      } catch {
        problems.push(`「${f.name}」を読み込めませんでした。`);
      }
    }
    if (files.length && nameInput.dataset.touched !== "1") {
      nameInput.value = files[0].name.replace(/\.pdf$/i, "") + "_結合";
    }
    setBusy(false);
    showError(problems);
    draw();
  }

  // ---- 描画 ----
  const fileOf = (id) => files.find((f) => f.id === id);

  function draw() {
    const has = files.length > 0;
    body.classList.toggle("pm-hide", !has);
    drop.classList.toggle("small", has);
    drop.querySelector(".pm-note").classList.toggle("pm-hide", has);
    drop.firstElementChild.innerHTML = has
      ? "＋ <b>PDFを追加する</b><span class=\"pm-wide\">（ドラッグ、またはクリック）</span>"
      : "<b>PDFをここにドラッグ</b>、または<b>クリックして選ぶ</b>";

    // ファイル一覧
    fileList.innerHTML = "";
    files.forEach((f, i) => {
      const used = pages.filter((p) => p.fileId === f.id).length;
      const row = el("div", "pm-file");
      row.innerHTML = `<i class="pm-dot" style="background:${f.color}"></i><span class="pm-fname"></span>
        <span class="pm-fcount">${used === f.pageCount ? `${f.pageCount}ページ` : `${used} / ${f.pageCount}ページ`}</span>
        <button class="pm-ibtn" data-a="up" title="上へ" ${i === 0 ? "disabled" : ""}>${ic("up")}</button>
        <button class="pm-ibtn" data-a="down" title="下へ" ${i === files.length - 1 ? "disabled" : ""}>${ic("down")}</button>
        <button class="pm-ibtn" data-a="remove" title="このファイルを外す">${ic("x")}</button>`;
      row.querySelector(".pm-fname").textContent = f.name;
      row.querySelector(".pm-fname").title = f.name;
      row.onclick = (e) => {
        const a = e.target.closest("button")?.dataset.a;
        if (a === "up") moveFile(i, -1);
        if (a === "down") moveFile(i, 1);
        if (a === "remove") removeFile(f.id);
      };
      fileList.appendChild(row);
    });

    // ページ一覧（すでにあるカードは使い回して、サムネイルを描き直さない）
    const old = new Map([...grid.children].map((n) => [n.dataset.key, n]));
    const frag = document.createDocumentFragment();
    pages.forEach((p, i) => {
      let card = old.get(p.key);
      if (!card) {
        const f = fileOf(p.fileId);
        card = el("div", "pm-page");
        card.dataset.key = p.key;
        card.dataset.file = p.fileId;
        card.innerHTML = `<i class="pm-band" style="background:${f.color}"></i>
          <div class="pm-thumb"></div>
          <div class="pm-cap"><span class="no"></span><span class="src"></span></div>
          <button class="pm-del" type="button" title="このページを外す" aria-label="このページを外す">${ic("x", 14)}</button>`;
        const src = card.querySelector(".src");
        src.textContent = `${f.name.replace(/\.pdf$/i, "")} p.${p.index + 1}`;
        src.title = `${f.name} の ${p.index + 1}ページ目`;
        card.querySelector(".pm-del").onclick = (e) => { e.stopPropagation(); removePage(p.key); };
        if (f.view) observer.observe(card);
      }
      old.delete(p.key);
      card.querySelector(".no").textContent = i + 1;
      frag.appendChild(card);
    });
    old.forEach((n) => observer.unobserve(n));
    grid.replaceChildren(frag);

    total.textContent = `（${files.length}ファイル・合計 ${pages.length}ページ）`;
    undoBtn.classList.toggle("pm-hide", !deleted.length);
    undoBtn.innerHTML = `${ic("undo", 14)} 外したページを戻す（${deleted.length}）`;
    undoBtn.style.display = "inline-flex";
    undoBtn.style.alignItems = "center";
    undoBtn.style.gap = "6px";
    runBtn.disabled = busy || pages.length === 0;
    clearBtn.disabled = busy;
  }

  // ---- 操作 ----
  function moveFile(i, d) {
    const j = i + d;
    if (j < 0 || j >= files.length) return;
    [files[i], files[j]] = [files[j], files[i]];
    // ページはファイルの順番どおりにまとめ直す（ファイル内の並びはそのまま）
    const order = new Map(files.map((f, k) => [f.id, k]));
    pages = pages.map((p, k) => ({ p, k }))
      .sort((a, b) => order.get(a.p.fileId) - order.get(b.p.fileId) || a.k - b.k)
      .map((x) => x.p);
    draw();
  }

  function removeFile(id) {
    const f = fileOf(id);
    f?.task?.destroy();
    files = files.filter((x) => x.id !== id);
    pages = pages.filter((p) => p.fileId !== id);
    deleted = deleted.filter((d) => d.page.fileId !== id);
    draw();
  }

  function removePage(key) {
    const pos = pages.findIndex((p) => p.key === key);
    if (pos < 0) return;
    deleted.push({ page: pages[pos], pos });
    pages.splice(pos, 1);
    draw();
  }

  undoBtn.onclick = () => {
    const d = deleted.pop();
    if (!d) return;
    pages.splice(Math.min(d.pos, pages.length), 0, d.page);
    draw();
  };

  clearBtn.onclick = () => {
    files.forEach((f) => f.task?.destroy());
    files = []; pages = []; deleted = [];
    nameInput.value = "結合"; nameInput.dataset.touched = "";
    showError([]);
    draw();
  };

  nameInput.oninput = () => { nameInput.dataset.touched = "1"; };

  const sortable = Sortable.create(grid, {
    animation: 150,
    filter: ".pm-del",
    preventOnFilter: false,
    delay: 180, delayOnTouchOnly: true,
    ghostClass: "pm-ghost", chosenClass: "pm-chosen",
    onEnd() {
      const byKey = new Map(pages.map((p) => [p.key, p]));
      pages = [...grid.children].map((n) => byKey.get(n.dataset.key));
      deleted = []; // 並びが変わったら「戻す」の位置がずれるので履歴を消す
      draw();
    },
  });

  // ---- 結合 ----
  runBtn.onclick = async () => {
    if (!pages.length || busy) return;
    setBusy(true, "結合中…");
    showError([]);
    try {
      const out = await PDFDocument.create();
      // ファイルごとにまとめてコピーする（ページ単位でコピーすると、フォントなどが重複して重くなるため）
      const copied = new Map();
      for (const f of files) {
        const idx = [...new Set(pages.filter((p) => p.fileId === f.id).map((p) => p.index))];
        if (!idx.length) continue;
        const got = await out.copyPages(f.lib, idx);
        idx.forEach((pi, k) => copied.set(`${f.id}-${pi}`, got[k]));
      }
      for (const p of pages) out.addPage(copied.get(p.key));
      const name = (nameInput.value.trim() || "結合").replace(/[\\/:*?"<>|]/g, "_");
      out.setTitle(name);
      const bytes = await out.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = el("a");
      a.href = url;
      a.download = name + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setBusy(false, null, "ダウンロードしました");
    } catch (e) {
      console.error(e);
      setBusy(false);
      showError(["結合できませんでした。ファイルの中身に、この道具で扱えない形式が含まれている可能性があります。"]);
    }
  };

  // ---- サムネイル（画面に入ったものから順に描く） ----
  const queue = [];
  let drawing = false;
  const observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      observer.unobserve(en.target);
      queue.push(en.target);
    }
    pump();
  }, { rootMargin: "300px" });

  async function pump() {
    if (drawing) return;
    drawing = true;
    while (queue.length && alive) {
      const card = queue.shift();
      const [fid, pi] = card.dataset.key.split("-").map(Number);
      const f = fileOf(fid);
      if (!f?.view || !card.isConnected || card.dataset.drawn) continue;
      try {
        const page = await f.view.getPage(pi + 1);
        const base = page.getViewport({ scale: 1 });
        const box = card.querySelector(".pm-thumb");
        const target = Math.max(box.clientWidth, 100) * Math.min(devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: target / Math.max(base.width, base.height * 0.707) });
        const cv = el("canvas");
        cv.width = Math.ceil(vp.width);
        cv.height = Math.ceil(vp.height);
        await page.render({ canvas: cv, canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        box.replaceChildren(cv);
        card.dataset.drawn = "1";
        page.cleanup();
      } catch { /* 描けなくても結合には影響しない */ }
    }
    drawing = false;
  }

  // ---- 表示の補助 ----
  function setBusy(on, label, done) {
    busy = on;
    runBtn.textContent = on && label ? label : done || "結合してダウンロード";
    if (done) setTimeout(() => { if (alive && !busy) runBtn.textContent = "結合してダウンロード"; }, 2500);
    draw();
  }
  function showError(list) {
    err.textContent = list.join("\n");
    err.classList.toggle("pm-hide", !list.length);
  }

  draw();

  // 別の道具に移るときの後片付け
  return () => {
    alive = false;
    removeEventListener("dragover", onDragOver);
    removeEventListener("dragleave", onDragLeave);
    removeEventListener("drop", onDrop);
    observer.disconnect();
    sortable.destroy();
    files.forEach((f) => f.task?.destroy());
  };
}
