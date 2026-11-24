// PDF以外の道具で共通に使う部品（PDFの部品を読み込まずにすむよう分けている）
// ファイルはすべてこのブラウザの中で処理する（どこにも送らない）。

export function injectCss(id, css) {
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = css;
  document.head.appendChild(st);
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

// 画面のどこにファイルを落としても受け取る
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

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// クリップボードにコピーして、ボタンの文字で知らせる
export async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
  }
  if (btn) {
    const old = btn.dataset.label || btn.textContent;
    btn.dataset.label = old;
    btn.textContent = ok ? "コピーしました" : "コピーできませんでした";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = old; }, 1400);
  }
  return ok;
}

// 道具で共通の見た目（使い方の3ステップ・ファイルを入れる場所など）
injectCss("tk-common-style", `
.tk-how { margin-bottom: 16px; }
.tk-steps { list-style: none; counter-reset: st; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tk-steps li { counter-increment: st; position: relative; padding: 10px 12px 10px 44px; border-radius: 6px; background: var(--accent-soft); line-height: 1.5; }
.tk-steps li::before { content: counter(st); position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; display: grid; place-items: center; border-radius: 99px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; }
.tk-steps b { display: block; font-size: 13px; }
.tk-steps span { display: block; font-size: 12px; color: var(--sub); }
.tk-steps em { font-style: normal; font-weight: 700; color: var(--ink); }
.tk-how-note { margin-top: 10px; font-size: 12px; color: var(--sub); line-height: 1.7; }
.tk-how-note b { color: var(--ink); }
.tk-drop { margin-top: 0; cursor: pointer; transition: border-color .15s, background .15s; }
.tk-drop:hover, .tk-drop.over { border-color: var(--accent); background: var(--accent-soft); color: var(--ink); }
.tk-drop b { color: var(--accent); }
.tk-drop.small { padding: 14px 16px; }
.tk-note { margin-top: 8px; font-size: 12px; color: var(--sub); }
.tk-err { margin-top: 12px; padding: 10px 14px; border-radius: 6px; background: var(--warn-soft); color: var(--warn); font-size: 13px; white-space: pre-line; }
.tk-sec { margin-top: 20px; font-size: 12px; font-weight: 700; color: var(--sub); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.tk-sec span { font-weight: 400; }
.tk-hide { display: none !important; }
.tk-mono { font-family: "BIZ UDGothic", "Osaka-Mono", "MS Gothic", "Menlo", "Consolas", monospace; }
.btn.sm { padding: 3px 10px; font-size: 12px; }
@media (max-width: 760px) {
  .tk-steps { grid-template-columns: 1fr; }
}
`);
