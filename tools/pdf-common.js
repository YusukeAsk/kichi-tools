// PDFの道具（結合・分割など）で共通に使う部品
// ファイルはすべてこのブラウザの中で処理する（どこにも送らない）。
import { PDFDocument } from "/vendor/pdf-lib/pdf-lib.esm.min.js";

export { PDFDocument };

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

// サムネイル表示用にPDFを開く。{ task, promise }（task.destroy() で後片付け）
export async function openView(bytes) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: PDFJS + "cmaps/", cMapPacked: true,
    standardFontDataUrl: PDFJS + "standard_fonts/",
    wasmUrl: PDFJS + "wasm/", iccUrl: PDFJS + "iccs/",
    isEvalSupported: false,
  });
  return { task, doc: await task.promise };
}

// PDFを読み込む。失敗したときは、そのまま画面に出せる文を error に入れて返す
export async function readPdf(file) {
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) {
    return { error: `「${file.name}」はPDFではないため、追加しませんでした。` };
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lib = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = lib.getPageCount();
    if (!pageCount) return { error: `「${file.name}」にはページがありません。` };
    return { bytes, lib, pageCount };
  } catch (e) {
    if (/encrypt/i.test(String(e?.message))) {
      return { error: `「${file.name}」は保護（パスワードや編集制限）がかかっているため、扱えません。保護を外してから入れてください。` };
    }
    return { error: `「${file.name}」は読み込めませんでした。壊れているか、PDFとして正しくない可能性があります。` };
  }
}

// ページの小さな画像を、画面に入ったものから順に描く
// resolve(card) → { doc(pdf.js), index(0始まり) } を返す。まだ描けないときは null
// 同じページを何度も描かないよう、描いた画像はページ番号ごとに取っておく
export function makeThumbs(resolve) {
  const queue = [];
  const cache = new Map();
  let drawing = false, alive = true;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      queue.push(en.target);
    }
    pump();
  }, { rootMargin: "300px" });

  async function pump() {
    if (drawing) return;
    drawing = true;
    while (queue.length && alive) {
      const card = queue.shift();
      const src = resolve(card);
      if (!src || !card.isConnected || card.dataset.drawn) continue;
      const box = card.querySelector(".pm-thumb");
      const hit = cache.get(src.doc)?.get(src.index);
      if (hit) {
        const cv = document.createElement("canvas");
        cv.width = hit.width; cv.height = hit.height;
        cv.getContext("2d").drawImage(hit, 0, 0);
        box.replaceChildren(cv);
        card.dataset.drawn = "1";
        continue;
      }
      try {
        const page = await src.doc.getPage(src.index + 1);
        const base = page.getViewport({ scale: 1 });
        const target = Math.max(box.clientWidth, 100) * Math.min(devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: target / Math.max(base.width, base.height * 0.707) });
        const cv = document.createElement("canvas");
        cv.width = Math.ceil(vp.width);
        cv.height = Math.ceil(vp.height);
        await page.render({ canvas: cv, canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        box.replaceChildren(cv);
        card.dataset.drawn = "1";
        if (!cache.has(src.doc)) cache.set(src.doc, new Map());
        cache.get(src.doc).set(src.index, cv);
        page.cleanup();
      } catch { /* 描けなくても処理には影響しない */ }
    }
    drawing = false;
  }

  return {
    observe: (n) => io.observe(n),
    unobserve: (n) => io.unobserve(n),
    forget(doc) { cache.delete(doc); },
    stop() { alive = false; io.disconnect(); cache.clear(); },
  };
}

// ブラウザにファイルを保存させる
export function saveFile(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ファイル名に使えない文字を置きかえる
export const safeName = (s, fallback) => (s.trim() || fallback).replace(/[\\/:*?"<>|]/g, "_");

// 画面のどこにファイルを落としても受け取る（ブラウザがPDFを開いてしまうのを防ぐ）
export function catchDrops(dropEl, onFiles) {
  const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const over = (e) => { if (!isFileDrag(e)) return; e.preventDefault(); dropEl.classList.add("over"); };
  const leave = (e) => { if (!e.relatedTarget) dropEl.classList.remove("over"); };
  const drop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dropEl.classList.remove("over");
    onFiles([...e.dataTransfer.files]);
  };
  addEventListener("dragover", over);
  addEventListener("dragleave", leave);
  addEventListener("drop", drop);
  return () => {
    removeEventListener("dragover", over);
    removeEventListener("dragleave", leave);
    removeEventListener("drop", drop);
  };
}

export function injectCss(id, css) {
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = css;
  document.head.appendChild(st);
}

// PDFの道具で共通の見た目
injectCss("pdf-common-style", `
.pm-how { margin-bottom: 16px; }
.pm-steps { list-style: none; counter-reset: st; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.pm-steps li { counter-increment: st; position: relative; padding: 10px 12px 10px 44px; border-radius: 6px; background: var(--accent-soft); line-height: 1.5; }
.pm-steps li::before { content: counter(st); position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; display: grid; place-items: center; border-radius: 99px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; }
.pm-steps b { display: block; font-size: 13px; }
.pm-steps span { display: block; font-size: 12px; color: var(--sub); }
.pm-steps em { font-style: normal; font-weight: 700; color: var(--ink); }
.pm-how-note { margin-top: 10px; font-size: 12px; color: var(--sub); line-height: 1.7; }
.pm-how-note b { color: var(--ink); }
.pm-drop { margin-top: 0; cursor: pointer; transition: border-color .15s, background .15s; }
.pm-drop:hover, .pm-drop.over { border-color: var(--accent); background: var(--accent-soft); color: var(--ink); }
.pm-drop b { color: var(--accent); }
.pm-drop.small { padding: 14px 16px; }
.pm-note { margin-top: 8px; font-size: 12px; color: var(--sub); }
.pm-err { margin-top: 12px; padding: 10px 14px; border-radius: 6px; background: var(--warn-soft); color: var(--warn); font-size: 13px; white-space: pre-line; }
.pm-sec { margin-top: 20px; font-size: 12px; font-weight: 700; color: var(--sub); display: flex; align-items: baseline; gap: 8px; }
.pm-sec span { font-weight: 400; }
.pm-ibtn { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; color: var(--sub); }
.pm-ibtn:hover:not(:disabled) { background: var(--accent-soft); color: var(--ink); }
.pm-ibtn:disabled { opacity: .3; cursor: default; }
.pm-thumb { margin-top: 4px; display: grid; place-items: center; aspect-ratio: 1 / 1.414; background: var(--bg); border-radius: 3px; overflow: hidden; }
.pm-thumb canvas { max-width: 100%; max-height: 100%; box-shadow: 0 0 0 1px rgba(0,0,0,.08); background: #fff; }
.pm-bar { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.pm-bar label { font-size: 12px; color: var(--sub); }
.pm-name { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 6px; background: var(--card); }
.pm-name input { width: 200px; padding: 6px 4px 6px 10px; border: 0; background: none; font: inherit; color: var(--ink); outline: none; }
.pm-name span { padding-right: 10px; color: var(--sub); }
.pm-bar .sp { flex: 1; }
.pm-hide { display: none !important; }
@media (max-width: 760px) {
  .pm-steps { grid-template-columns: 1fr; }
  .pm-name input { width: 140px; }
  .pm-bar .sp { display: none; }
  .pm-wide { display: none; }
}
`);
