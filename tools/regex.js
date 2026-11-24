// よく使う正規表現：選ぶと、サンプル文章の当てはまる所が光り、置換後の文章も見られる辞書
// 文章はこのブラウザの中だけで処理する（どこにも送らない）。
import { injectCss, esc, copyText } from "./common.js";

const CSS = `
.rx { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 20px; align-items: start; }
.rx-list { display: grid; gap: 4px; position: sticky; top: 12px; }
.rx-list .hd { font-size: 12px; font-weight: 700; color: var(--sub); margin: 0 0 4px; }
.rx-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); line-height: 1.4; font-size: 13px; }
.rx-item:hover { border-color: var(--accent); }
.rx-item.on { border-color: var(--accent); background: var(--accent-soft); font-weight: 700; }
.rx-item .no { flex: none; width: 20px; color: var(--sub); font-size: 11px; font-weight: 400; }
.rx-item .nm { flex: 1; min-width: 0; }
.rx-tag { flex: none; font-size: 10px; font-weight: 400; padding: 0 6px; border-radius: 99px; border: 1px solid var(--line); color: var(--sub); white-space: nowrap; }
.rx-tag.rep { border-color: var(--accent); color: var(--accent); }

.rx-head h2 { font-size: 18px; }
.rx-head p { color: var(--sub); margin-top: 2px; }
.rx-ex { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 13px; }
.rx-ex code { padding: 2px 8px; border-radius: 4px; background: var(--bg); border: 1px solid var(--line); white-space: pre; }
.rx-ex .ar { color: var(--sub); }

.rx-fields { margin-top: 16px; display: grid; gap: 10px; }
.rx-field { display: grid; grid-template-columns: 6.5em minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.rx-field label { font-size: 12px; font-weight: 700; color: var(--sub); }
.rx-field input[type=text] { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--ink); font-size: 15px; }
.rx-field input[type=text]:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.rx-field.pat input { font-weight: 700; }
.rx-flags { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12px; color: var(--sub); }
.rx-flags label { display: flex; align-items: center; gap: 4px; font-weight: 400; cursor: pointer; }
.rx-flags input { accent-color: var(--accent); }
.rx-msg { grid-column: 2 / -1; font-size: 12px; }
.rx-msg.err { color: #c0392b; }
.rx-msg .reset { color: var(--accent); text-decoration: underline; cursor: pointer; }

.rx-read { margin-top: 18px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.rx-read .ttl { padding: 8px 12px; font-size: 12px; font-weight: 700; color: var(--sub); background: var(--bg); border-bottom: 1px solid var(--line); }
.rx-read table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rx-read td { padding: 7px 12px; border-top: 1px solid var(--line); vertical-align: top; line-height: 1.55; }
.rx-read tr:first-child td { border-top: 0; }
.rx-read td.tk { width: 1%; white-space: nowrap; }
.rx-read td.tk code { display: inline-block; padding: 1px 8px; border-radius: 4px; background: var(--accent-soft); font-weight: 700; white-space: pre; }
.rx-read tr.sub td { background: var(--bg); font-size: 12px; color: var(--sub); }
.rx-tip { padding: 10px 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--sub); line-height: 1.7; }
.rx-tip b { color: var(--ink); }
.rx-tip code { padding: 0 4px; border-radius: 3px; background: var(--bg); border: 1px solid var(--line); color: var(--ink); white-space: pre; }

.rx-pane { margin-top: 18px; }
.rx-pane .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 6px; }
.rx-pane .bar b { font-size: 13px; }
.rx-pane .bar .cnt { font-size: 12px; color: var(--sub); }
.rx-pane .bar .cnt strong { color: var(--ink); }
.rx-pane .bar .sp { flex: 1; }
.rx-key { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }

.rx-ed { position: relative; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
.rx-ed:focus-within { border-color: var(--accent); }
.rx-back, .rx-ta, .rx-out {
  font-size: 14px; line-height: 1.9; padding: 12px 14px; margin: 0;
  white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; tab-size: 4; letter-spacing: 0;
}
.rx-back { position: absolute; inset: 0; color: transparent; overflow: hidden; pointer-events: none; border: 1px solid transparent; }
.rx-ta { position: relative; display: block; width: 100%; min-height: 180px; resize: none; overflow: hidden; border: 1px solid transparent; background: transparent; color: var(--ink); caret-color: var(--ink); outline: none; }
.rx-out { border: 1px solid var(--line); border-radius: 8px; background: var(--bg); min-height: 60px; }
.rx-out.none { color: var(--sub); white-space: normal; font-family: inherit; font-size: 13px; }

.rx-back mark { background: var(--hl); color: transparent; border-radius: 2px; box-shadow: 0 0 0 1px var(--hl-edge); }
.rx-zw, .rx-nl, .rx-del { display: inline-block; width: 0; height: 1.3em; vertical-align: text-bottom; position: relative; }
.rx-zw::before { content: ""; position: absolute; left: -1px; top: 0; bottom: 0; width: 3px; border-radius: 2px; background: var(--hl-edge); }
.rx-nl::before { content: "↵"; position: absolute; left: 1px; top: 0; padding: 0 3px; line-height: 1.3em; font-size: 11px; color: var(--ink); background: var(--hl); border-radius: 2px; }
.rx-out ins { text-decoration: none; background: var(--ok); border-radius: 2px; box-shadow: 0 0 0 1px var(--ok-edge); }
.rx-out .rx-nlo::before { content: "↵"; font-size: 11px; color: var(--sub); }
.rx-del::before { content: ""; position: absolute; left: -1px; top: 0; bottom: 0; width: 3px; border-radius: 2px; background: #e5534b; }

.rx-how-tools { margin-top: 22px; }
.rx-how-tools summary { cursor: pointer; font-size: 13px; font-weight: 700; }
.rx-how-tools .wrap { margin-top: 8px; overflow-x: auto; }
.rx-how-tools table { border-collapse: collapse; font-size: 12px; min-width: 560px; width: 100%; }
.rx-how-tools th, .rx-how-tools td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; line-height: 1.6; }
.rx-how-tools th { background: var(--bg); font-weight: 700; color: var(--sub); }
.rx-how-tools code { padding: 0 4px; border-radius: 3px; background: var(--bg); border: 1px solid var(--line); white-space: pre; }
.rx-how-tools p { margin-top: 8px; font-size: 12px; color: var(--sub); line-height: 1.7; }

:root { --hl: #ffe066; --hl-edge: #f0b400; --ok: #c8f0d2; --ok-edge: #5cbf7a; }
@media (prefers-color-scheme: dark) { :root { --hl: rgba(255, 214, 0, .32); --hl-edge: #c9a400; --ok: rgba(80, 200, 120, .28); --ok-edge: #3f9a5c; } }

@media (max-width: 1000px) {
  .rx { grid-template-columns: 1fr; }
  .rx-list { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rx-list .hd { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  .rx-field { grid-template-columns: 1fr auto; }
  .rx-field label { grid-column: 1 / -1; }
  .rx-flags, .rx-msg { grid-column: 1 / -1; }
  .rx-list { grid-template-columns: 1fr; gap: 3px; }
  .rx-item { font-size: 13px; padding: 6px 10px; }
}
`;

// 変えやすいように、最初に入れておくサンプル文章
const SAMPLE = [
  "　お問い合わせ一覧（2026/11/24 時点）  ",
  "担当：山田　太郎    電話 045-123-4567",
  "メール：yamada.taro@example.co.jp",
  "〒100-0005 東京都千代田区丸の内1-2-3",
  "",
  "",
  "受付日\t件名\t金額",
  "2026/11/2\t見積もりの依頼\t１２，０００円",
  "2026/11/24\t納期の確認（至急）\t3,500円",
  "",
  "日付の書き方いろいろ：2026-11-24 ／ 2026年11月24日 ／ 令和8年11月24日 ／ 11/24（火）",
  "受付時間：平日 10:00〜17:00（土日祝は休み）",
  "詳しくは https://tools.kichi.page/ をご覧ください。",
  "  サポート窓口　support@example.com　電話 03-1234-5678   ",
].join("\n");

// よく使う正規表現。parts は [部品, 読み方]。"—" 始まりの行は小見出し
const ITEMS = [
  {
    id: "trim", name: "行頭・行末の空白を消す", kind: "rep",
    what: "行のはじめと終わりに残った、余分なスペースやタブを消します。",
    pattern: "^[ \\t　]+|[ \\t　]+$", flags: "m", replace: "",
    ex: ["　　見積もり  ", "見積もり"],
    parts: [
      ["^", "行の頭"],
      ["[ \\t　]", "［ ］の中のどれか1文字。ここでは半角スペース・タブ（\\t）・全角スペース"],
      ["+", "直前のものが1回以上続く"],
      ["|", "または（左右どちらかに当てはまればよい）"],
      ["[ \\t　]+$", "同じ空白が続いて、そのまま行の終わり（$）になる所"],
      ["— 置換後", ""],
      ["（空っぽ）", "何も入れない＝当てはまった所を消す"],
    ],
    tip: "<b>m（行ごと）</b>にすると、<code>^</code> と <code>$</code> が「文章全体の頭と終わり」ではなく「各行の頭と終わり」になります。",
  },
  {
    id: "blank", name: "空行を消す", kind: "rep",
    what: "何も書かれていない行（スペースだけの行も含む）を消して、行を詰めます。",
    pattern: "^[ \\t　]*\\r?\\n", flags: "m", replace: "",
    ex: ["A↵↵↵B", "A↵B"],
    parts: [
      ["^", "行の頭"],
      ["[ \\t　]*", "空白が0文字以上（＊は「0回以上」なので、何もなくても当てはまる）"],
      ["\\r?", "Windowsの改行の前半（\\r）。？は「あってもなくてもよい」"],
      ["\\n", "改行"],
      ["— 置換後", ""],
      ["（空っぽ）", "空の行ごと消す"],
    ],
    tip: "「行の頭から、空白だけ並んで、すぐ改行」＝空行です。光っている <b>↵</b> が消える改行です。",
  },
  {
    id: "spaces", name: "連続する空白を1つにまとめる", kind: "rep",
    what: "2つ以上続いたスペース（半角・全角）を、半角スペース1つにそろえます。",
    pattern: "[ 　]{2,}", flags: "", replace: " ",
    ex: ["電話    045", "電話 045"],
    parts: [
      ["[ 　]", "半角スペースか全角スペースのどちらか1文字"],
      ["{2,}", "直前のものが2回以上続く（{3} なら「ちょうど3回」、{2,4} なら「2〜4回」）"],
      ["— 置換後", ""],
      ["（半角スペース1つ）", "まとめて、スペース1つに置きかえる"],
    ],
    tip: "全角スペース1つだけの所（「山田　太郎」）は、2つ以上ではないので変わりません。",
  },
  {
    id: "date", name: "日付「2026/11/24」を「2026-11-24」に", kind: "rep",
    what: "スラッシュ区切りの日付を、ハイフン区切りに並べ替えます。かっこで「年・月・日」をつかまえて、置換後で呼び出します。",
    pattern: "(\\d{4})/(\\d{1,2})/(\\d{1,2})", flags: "", replace: "$1-$2-$3",
    ex: ["2026/11/24", "2026-11-24"],
    parts: [
      ["( )", "かっこで囲んだ部分は「つかまえる」。左から順に $1・$2・$3 と呼べる"],
      ["\\d{4}", "数字（\\d）が4けた ＝ 年"],
      ["/", "スラッシュそのもの"],
      ["\\d{1,2}", "数字が1〜2けた ＝ 月・日"],
      ["— 置換後", ""],
      ["$1-$2-$3", "つかまえた「年」「月」「日」を、ハイフンでつないで並べ直す"],
    ],
    tip: "置換後を <code>$1年$2月$3日</code> にすれば「2026年11月24日」になります。サンプルの「日付の書き方いろいろ」の行は、スラッシュ区切りではないので当てはまりません。年月日の形も拾うなら <code>(\\d{4})[/年-](\\d{1,2})[/月-](\\d{1,2})日?</code> のように書きます。",
  },
  {
    id: "bullet", name: "行の頭に「・」を付ける", kind: "rep",
    what: "空行以外のすべての行のはじめに「・」を付けて、箇条書きにします。",
    pattern: "^(?=.)", flags: "m", replace: "・",
    ex: ["りんご↵みかん", "・りんご↵・みかん"],
    parts: [
      ["^", "行の頭（文字ではなく「位置」）"],
      ["(?=.)", "すぐ後ろに何か1文字あるときだけ（先読み）。空行には付けないための条件で、文字そのものは選ばない"],
      ["— 置換後", ""],
      ["・", "その位置に「・」を差し込む"],
    ],
    tip: "文字ではなく「位置」に当てはまるので、光るのは細い縦線です。<code>(?=.)</code> を外して <code>^</code> だけにすると、空行にも「・」が付きます。",
  },
  {
    id: "tab", name: "タブ区切りをカンマ区切りにする", kind: "rep",
    what: "Excelからコピーした表（タブ区切り）を、CSVと同じカンマ区切りにします。",
    pattern: "\\t", flags: "", replace: ",",
    ex: ["受付日→件名→金額", "受付日,件名,金額"],
    parts: [
      ["\\t", "タブ1文字"],
      ["— 置換後", ""],
      [",", "カンマに置きかえる"],
    ],
    tip: "サンプルの「3,500円」のように、もともとカンマを含む項目があると、列がずれます。CSVとして使うときは、その項目を <code>\"</code> で囲む必要があります。",
  },
  {
    id: "mail", name: "メールアドレスを見つける", kind: "find",
    what: "文章の中からメールアドレスを探します。置換後は、伏せ字にする例です。",
    pattern: "[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+", flags: "", replace: "［メール］",
    ex: ["yamada@example.co.jp", "［メール］"],
    parts: [
      ["[A-Za-z0-9._+-]+", "英字・数字・「. _ + -」が1文字以上（@の前）"],
      ["@", "アットマークそのもの"],
      ["[A-Za-z0-9-]+", "英字・数字・ハイフンが1文字以上（example など）"],
      ["(?:\\.[A-Za-z0-9-]+)+", "「.」＋英数字のかたまりが1回以上（.co .jp など）。(?: ) は、$番号を付けないかっこ"],
      ["— 置換後", ""],
      ["［メール］", "見つけたアドレスを、この文字に置きかえる"],
    ],
    tip: "<code>\\.</code> のように <code>\\</code> を付けると「.」そのものの意味になります（<code>.</code> だけだと「どんな1文字でも」）。",
  },
  {
    id: "tel", name: "電話番号を見つける", kind: "find",
    what: "「045-123-4567」のような、ハイフン区切りの電話番号を探します。",
    pattern: "0\\d{1,4}-\\d{1,4}-\\d{3,4}", flags: "", replace: "［電話番号］",
    ex: ["電話 03-1234-5678", "電話 ［電話番号］"],
    parts: [
      ["0", "最初は0"],
      ["\\d{1,4}", "数字が1〜4けた（市外局番の残り）"],
      ["-", "ハイフンそのもの"],
      ["\\d{1,4}", "数字が1〜4けた"],
      ["-\\d{3,4}", "ハイフンのあとに、数字が3〜4けた"],
      ["— 置換後", ""],
      ["［電話番号］", "見つけた番号を、この文字に置きかえる"],
    ],
    tip: "ハイフンなし（0451234567）も拾うなら、<code>-</code> を <code>-?</code>（あってもなくてもよい）にします。",
  },
  {
    id: "zip", name: "郵便番号のハイフンを取る", kind: "rep",
    what: "「100-0005」のような郵便番号を見つけて、ハイフンなしの「1000005」にします。",
    pattern: "(?<![\\d-])(\\d{3})-(\\d{4})(?![\\d-])", flags: "", replace: "$1$2",
    ex: ["〒100-0005", "〒1000005"],
    parts: [
      ["(?<![\\d-])", "すぐ前が、数字やハイフンではない（否定の後読み）"],
      ["(\\d{3})", "数字3けたをつかまえる → $1"],
      ["-", "ハイフンそのもの"],
      ["(\\d{4})", "数字4けたをつかまえる → $2"],
      ["(?![\\d-])", "すぐ後ろが、数字やハイフンではない（否定の先読み）"],
      ["— 置換後", ""],
      ["$1$2", "ハイフンを抜いて、3けたと4けたをつなげる"],
    ],
    tip: "前後の条件を外して <code>\\d{3}-\\d{4}</code> だけにすると、電話番号「045-123-4567」の「123-4567」まで拾ってしまいます。試しに消して比べてみてください。",
  },
  {
    id: "url", name: "URLを見つける", kind: "find",
    what: "http:// や https:// で始まるURLを探します。",
    pattern: "https?://[A-Za-z0-9/:%#$&?=~._+-]+", flags: "", replace: "［URL］",
    ex: ["https://tools.kichi.page/ を", "［URL］ を"],
    parts: [
      ["https?", "http。最後の s は ? なので、あってもなくてもよい"],
      ["://", "そのままの文字"],
      ["[A-Za-z0-9/:%#$&?=~._+-]+", "URLに使われる英数字や記号が続くかぎり"],
      ["— 置換後", ""],
      ["［URL］", "見つけたURLを、この文字に置きかえる"],
    ],
    tip: "日本語や空白はURLの文字に入れていないので、「https://…/をご覧ください」のように続けて書かれていても、URLの所だけで止まります。",
  },
  {
    id: "paren", name: "（　）ごと消す", kind: "rep",
    what: "全角・半角のかっことその中身を、まとめて消します。",
    pattern: "[（(][^）)]*[）)]", flags: "", replace: "",
    ex: ["納期の確認（至急）", "納期の確認"],
    parts: [
      ["[（(]", "全角か半角の、開きかっこ"],
      ["[^）)]*", "閉じかっこ以外の文字が0文字以上。[^ ] は「［ ］の中の文字以外」"],
      ["[）)]", "全角か半角の、閉じかっこ"],
      ["— 置換後", ""],
      ["（空っぽ）", "かっこと中身をまとめて消す"],
    ],
    tip: "中身だけ残したいときは、<code>[（(]([^）)]*)[）)]</code> にして、置換後を <code>$1</code> にします。",
  },
  {
    id: "zen", name: "全角の数字を見つける", kind: "find",
    what: "「１２」のような全角の数字を探します。入力のゆれを見つけるのに使います。",
    pattern: "[０-９]+", flags: "", replace: null,
    ex: ["１２，０００円", "（光るだけ）"],
    parts: [
      ["[０-９]", "全角の０から９までのどれか1文字。［ ］の中の「-」は「〜から〜まで」"],
      ["+", "1文字以上続く"],
    ],
    tip: "正規表現だけでは「全角を半角に変える」置換はできません。半角にそろえるには、このサイトの「全角・半角のそろえ直し」を使います。半角の数字は <code>[0-9]</code> か <code>\\d</code> です。",
  },
];

export function mount(root) {
  injectCss("rx-style", CSS);

  let cur = ITEMS[0];
  root.innerHTML = `
    <div class="tk-how">
      <ol class="tk-steps">
        <li><b>正規表現を選ぶ</b><span>左の一覧から、やりたいことを選ぶ</span></li>
        <li><b>光る所を見る</b><span>サンプル文章の<em>当てはまる所が黄色</em>に光る</span></li>
        <li><b>コピーして使う</b><span>エディタやExcelに貼って、検索・置換する</span></li>
      </ol>
      <p class="tk-how-note">サンプル文章は自由に書き換えられます。自分の文章を貼って試すこともできます。正規表現と置換後の欄も、書き換えるとその場で結果が変わります。<b>文章はこのブラウザの中だけで処理し、どこにも送りません。</b></p>
    </div>
    <div class="rx">
      <div class="rx-list" role="listbox" aria-label="よく使う正規表現"><div class="hd">よく使う正規表現</div>
        ${ITEMS.map((it, i) => `<button class="rx-item" type="button" data-id="${it.id}"><span class="no">${i + 1}</span><span class="nm">${esc(it.name)}</span><span class="rx-tag ${it.kind}">${it.kind === "rep" ? "置換" : "検索"}</span></button>`).join("")}
      </div>
      <div class="rx-main">
        <div class="rx-head"><h2></h2><p></p><div class="rx-ex"></div></div>

        <div class="rx-fields">
          <div class="rx-field pat">
            <label for="rx-pat">正規表現</label>
            <input id="rx-pat" class="tk-mono" type="text" spellcheck="false" autocomplete="off">
            <button class="btn sm" type="button" data-copy="pat">コピー</button>
            <div class="rx-flags">
              <label><input type="checkbox" data-flag="m">行ごと（m）：^ と $ を各行の頭・終わりにする</label>
              <label><input type="checkbox" data-flag="i">大文字・小文字を区別しない（i）</label>
            </div>
            <div class="rx-msg"></div>
          </div>
          <div class="rx-field rep">
            <label for="rx-rep">置換後</label>
            <input id="rx-rep" class="tk-mono" type="text" spellcheck="false" autocomplete="off" placeholder="（空っぽ＝消す）">
            <button class="btn sm" type="button" data-copy="rep">コピー</button>
          </div>
        </div>

        <div class="rx-read"><div class="ttl">読み方（部品に分けると）</div><table><tbody></tbody></table><div class="rx-tip"></div></div>

        <div class="rx-pane">
          <div class="bar"><b><span class="rx-key" style="background:var(--hl)"></span>置換前（当てはまる所が黄色）</b><span class="cnt rx-cnt"></span><span class="sp"></span><button class="btn sm rx-reset" type="button">サンプルを元に戻す</button></div>
          <div class="rx-ed"><div class="rx-back tk-mono" aria-hidden="true"></div><textarea class="rx-ta tk-mono" spellcheck="false" aria-label="サンプル文章（書き換えられます）"></textarea></div>
        </div>
        <div class="rx-pane">
          <div class="bar"><b><span class="rx-key" style="background:var(--ok)"></span>置換後（変わった所が緑・赤の線は消えた所）</b><span class="sp"></span><button class="btn sm rx-copyout" type="button">置換後をコピー</button></div>
          <div class="rx-out tk-mono"></div>
        </div>

        <details class="rx-how-tools">
          <summary>エディタやExcelで使うときの書き方の違い</summary>
          <div class="wrap"><table>
            <tr><th>使う場所</th><th>正規表現を使うには</th><th>置換後で「1つ目のかっこ」を呼ぶ</th></tr>
            <tr><td>VS Code</td><td>検索欄の「.*」ボタンを押す</td><td><code>$1</code></td></tr>
            <tr><td>サクラエディタ</td><td>置換画面の「正規表現」にチェック</td><td><code>$1</code>（<code>\\1</code> も可）</td></tr>
            <tr><td>Excel（Microsoft 365）</td><td><code>=REGEXREPLACE(A1,"正規表現","置換後")</code></td><td><code>$1</code></td></tr>
            <tr><td>Googleスプレッドシート</td><td><code>=REGEXREPLACE(A1,"正規表現","置換後")</code></td><td><code>$1</code>　※<code>(?= )</code> <code>(?&lt;! )</code> などの先読み・後読みは使えない</td></tr>
            <tr><td>Python</td><td><code>re.sub(r"正規表現", r"置換後", 文字列, flags=re.M)</code></td><td><code>\\1</code></td></tr>
            <tr><td>JavaScript</td><td><code>文字列.replace(/正規表現/gm, "置換後")</code></td><td><code>$1</code></td></tr>
          </table></div>
          <p>このページの動きは JavaScript の正規表現と同じです。置換後の欄では、<code>\\n</code> と書くと改行、<code>\\t</code> と書くとタブになります（VS Code と同じ）。サクラエディタなどでは <code>\\w</code> に日本語も含まれることがあるため、英数字だけを指したいときは <code>[A-Za-z0-9_]</code> と書くと確実です。</p>
        </details>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const list = $(".rx-list"), pat = $("#rx-pat"), rep = $("#rx-rep"), msg = $(".rx-msg");
  const ta = $(".rx-ta"), back = $(".rx-back"), out = $(".rx-out"), cnt = $(".rx-cnt");
  const flagBox = (f) => root.querySelector(`[data-flag="${f}"]`);
  let lastResult = "";

  ta.value = SAMPLE;

  function choose(it) {
    cur = it;
    list.querySelectorAll(".rx-item").forEach((b) => b.classList.toggle("on", b.dataset.id === it.id));
    $(".rx-head h2").textContent = it.name;
    $(".rx-head p").textContent = it.what;
    $(".rx-ex").innerHTML = `<span>例：</span><code>${esc(it.ex[0])}</code><span class="ar">→</span><code>${esc(it.ex[1])}</code>`;
    pat.value = it.pattern;
    rep.value = it.replace ?? "";
    rep.disabled = it.replace === null;
    rep.placeholder = it.replace === null ? "（この正規表現は探すだけ）" : "（空っぽ＝消す）";
    flagBox("m").checked = it.flags.includes("m");
    flagBox("i").checked = it.flags.includes("i");
    $(".rx-read tbody").innerHTML = it.parts.map(([k, v]) =>
      k.startsWith("— ") ? `<tr class="sub"><td colspan="2">${esc(k.slice(2))}</td></tr>`
        : `<tr><td class="tk"><code class="tk-mono">${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join("");
    $(".rx-tip").innerHTML = it.tip;
    update();
  }

  // 置換後の「$1」などを、当てはまった中身に置きかえる（JavaScript と同じ決まり）
  function expand(r, m, text) {
    return r.replace(/\$(\$|&|`|'|\d{1,2}|<([^>]*)>)/g, (all, t, name) => {
      if (t === "$") return "$";
      if (t === "&") return m[0];
      if (t === "`") return text.slice(0, m.index);
      if (t === "'") return text.slice(m.index + m[0].length);
      if (name !== undefined) return m.groups?.[name] ?? "";
      let n = Number(t);
      if (t.length === 2 && n >= m.length) {
        n = Number(t[0]);
        return n > 0 && n < m.length ? (m[n] ?? "") + t[1] : all;
      }
      return n > 0 && n < m.length ? (m[n] ?? "") : all;
    });
  }
  const unescapeRep = (s) => s.replace(/\\(n|t|\\)/g, (_, c) => (c === "n" ? "\n" : c === "t" ? "\t" : "\\"));

  // 当てはまった所に、黄色の印を付けた文章を作る
  function markText(text, hits) {
    let html = "", at = 0;
    for (const h of hits) {
      html += esc(text.slice(at, h.i));
      const s = text.slice(h.i, h.i + h.len);
      if (!s) html += '<span class="rx-zw"></span>';
      else html += "<mark>" + s.split("\n").map(esc).join('<span class="rx-nl"></span>\n') + "</mark>";
      at = h.i + h.len;
    }
    return html + esc(text.slice(at)) + "\n";
  }

  function update() {
    const text = ta.value;
    let re = null;
    const flags = "g" + (flagBox("m").checked ? "m" : "") + (flagBox("i").checked ? "i" : "");
    const changed = pat.value !== cur.pattern;
    msg.className = "rx-msg";
    msg.innerHTML = changed ? `正規表現を書き換えています（読み方は元の形のものです）。<span class="reset" role="button" tabindex="0">元に戻す</span>` : "";
    if (pat.value) {
      try { re = new RegExp(pat.value, flags); } catch (e) {
        msg.className = "rx-msg err";
        msg.textContent = "正規表現の書き方に誤りがあります：" + e.message.replace(/^Invalid regular expression: /, "");
      }
    }
    const hits = [];
    if (re) {
      let m;
      while ((m = re.exec(text))) {
        hits.push({ i: m.index, len: m[0].length, m });
        if (m[0].length === 0) re.lastIndex++;
        if (hits.length >= 5000) break;
      }
    }
    back.innerHTML = markText(text, hits);
    cnt.innerHTML = re ? `当てはまる所：<strong>${hits.length}</strong> か所` : "";
    fit();

    // 置換後
    if (rep.disabled || !re) {
      out.classList.add("none");
      out.textContent = !re ? "正規表現を入れると、ここに置換後の文章が出ます。" : "この正規表現は探すだけです。上の文章で、光っている所を確かめてください。";
      lastResult = "";
      return;
    }
    out.classList.remove("none");
    const r = unescapeRep(rep.value);
    let html = "", plain = "", at = 0;
    for (const h of hits) {
      const keep = text.slice(at, h.i);
      html += esc(keep); plain += keep;
      const to = expand(r, h.m, text);
      if (to) html += "<ins>" + to.split("\n").map(esc).join('<span class="rx-nlo"></span>\n') + "</ins>";
      else if (h.len) html += `<span class="rx-del" title="消えた文字：${esc(JSON.stringify(text.slice(h.i, h.i + h.len)))}"></span>`;
      plain += to;
      at = h.i + h.len;
    }
    html += esc(text.slice(at)); plain += text.slice(at);
    out.innerHTML = html + "\n";
    lastResult = plain;
  }

  // 文章の量に合わせて、入力欄の高さを伸ばす
  function fit() {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  list.onclick = (e) => {
    const b = e.target.closest(".rx-item");
    if (b) choose(ITEMS.find((it) => it.id === b.dataset.id));
  };
  msg.onclick = (e) => { if (e.target.classList.contains("reset")) { pat.value = cur.pattern; rep.value = cur.replace ?? ""; update(); } };
  msg.onkeydown = (e) => { if (e.target.classList.contains("reset") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.target.click(); } };
  pat.oninput = rep.oninput = ta.oninput = update;
  root.querySelectorAll("[data-flag]").forEach((c) => (c.onchange = update));
  $(".rx-reset").onclick = () => { ta.value = SAMPLE; update(); };
  root.querySelector('[data-copy="pat"]').onclick = (e) => copyText(pat.value, e.currentTarget);
  root.querySelector('[data-copy="rep"]').onclick = (e) => copyText(rep.value, e.currentTarget);
  $(".rx-copyout").onclick = (e) => copyText(lastResult, e.currentTarget);
  const onResize = () => fit();
  addEventListener("resize", onResize);

  choose(cur);
  return () => removeEventListener("resize", onResize);
}
