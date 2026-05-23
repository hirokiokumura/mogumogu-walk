# Web Audio API と PWA / Service Worker 入門

このドキュメントは、もぐもぐウォークで出てくる次の用語を理解するためのメモです。

- Web Audio API
- AudioContext
- resume
- WebKit
- PWA
- Service Worker
- manifest

このアプリでは「iPhone Safariでメトロノーム音を鳴らす」「ホーム画面に追加してアプリらしく使う」という目的のために、これらの仕組みを使っています。

## まず全体像

このアプリでの関係をざっくり書くと、次のようになります。

```txt
もぐもぐウォーク
  ├─ メトロノーム音を鳴らす
  │    └─ Web Audio API
  │         ├─ AudioContext
  │         ├─ AudioBuffer
  │         ├─ AudioBufferSourceNode
  │         └─ resume()
  │
  ├─ iPhone Safariで動かす
  │    └─ WebKit
  │         ├─ Safariのブラウザエンジン
  │         └─ iOS特有の自動再生制限
  │
  └─ ホーム画面に追加してアプリらしく使う
       └─ PWA
            ├─ manifest.json
            └─ Service Worker
```

Web Audio API は「音を作って鳴らす仕組み」です。

PWA / Service Worker は「Webアプリをアプリらしく起動したり、ファイルをキャッシュしたりする仕組み」です。

この2つは別物です。Service Workerがあるから音が鳴るわけではありません。

## Web Audio API とは

Web Audio API は、ブラウザ上で音を扱うためのAPIです。

普通のWebページで音を鳴らすだけなら、`<audio>` 要素を使う方法もあります。

```html
<audio src="/click.mp3" controls></audio>
```

ただし、もぐもぐウォークのメトロノームでは音源ファイルを使わず、プログラムでクリック音を作っています。そのため Web Audio API を使います。

Web Audio API を使うと、次のようなことができます。

- 音をプログラムで生成する
- 音量を変える
- 音を正確な時刻に予約して鳴らす
- 複数の音を合成する
- フィルターやエフェクトをかける

メトロノームでは「一定間隔で短いクリック音を鳴らす」必要があります。`setInterval` だけで音を鳴らすとタイミングが揺れやすいので、Web Audio API の時計を使って少し先の音を予約しています。

## AudioContext とは

`AudioContext` は、Web Audio API の中心になるオブジェクトです。

イメージとしては、ブラウザ内の音声エンジンです。

```ts
const ctx = new AudioContext();
```

この `ctx` を使って、音の材料を作ったり、音量を調整したり、最終的にスピーカーへつないだりします。

このアプリでは、`useMetronome.ts` で次のように使っています。

```ts
const AudioContextClass = getAudioContextConstructor();
ctxRef.current = new AudioContextClass();
```

`ctxRef` に入れているのは、Reactの再描画をまたいでも同じ `AudioContext` を使い続けたいからです。

## AudioContext の state

`AudioContext` には状態があります。

代表的なのは次の3つです。

```txt
suspended  停止中。音声処理が動いていない
running    動作中。音を鳴らせる
closed     終了済み。もう使えない
```

iPhone Safariでは、自動再生を防ぐために、ページを開いただけでは音を鳴らせません。そのため、`AudioContext` を作っても最初は `suspended` になることがあります。

```ts
if (ctx.state !== "running") {
  await ctx.resume();
}
```

メトロノーム音を鳴らすには、最終的に `running` になっている必要があります。

## resume とは

`resume()` は、停止中の `AudioContext` を再開するメソッドです。

```ts
await ctx.resume();
```

英語の `resume` は「再開する」という意味です。

Web Audio API の文脈では、`suspended` の音声エンジンを `running` に戻す操作です。

```txt
AudioContextを作る
  ↓
最初は suspended の場合がある
  ↓
ユーザーがボタンをタップ
  ↓
ctx.resume()
  ↓
running になる
  ↓
音を鳴らす
```

重要なのは、iPhone Safariでは `resume()` をユーザー操作の後に呼ぶ必要があることです。

たとえば、ページ表示直後の `useEffect` で勝手に `resume()` しても、Safariにブロックされる可能性があります。

良い例:

```ts
const handleClick = async () => {
  await ctx.resume();
  playClick();
};
```

良くない例:

```ts
useEffect(() => {
  ctx.resume();
}, []);
```

ユーザーが明確にタップしたタイミングで音声を開始することが大事です。

## なぜiPhone Safariで音が鳴りにくいのか

iPhone Safariは、ユーザーが意図しない音声再生を防ぐために制限が強めです。

特に関係するのは次の制約です。

- ユーザーのタップなどがないと音声再生を開始できない
- `AudioContext` が `suspended` のままになることがある
- `resume()` の前に予約した音が鳴らないことがある
- 消音モード、音量、Bluetooth出力先の影響を受ける
- PWAとしてホーム画面から起動した場合も、同じように音声制限を受ける

そのため、メトロノームでは次の順序が重要です。

```txt
メトロノームONボタンをタップ
  ↓
AudioContextを作る
  ↓
resume() で running にする
  ↓
running になった後にクリック音を予約する
```

`suspended` の間に `source.start()` で初回音を予約すると、iPhone Safariではその音が捨てられる可能性があります。

## AudioBuffer とは

`AudioBuffer` は、音の波形データを入れておく箱です。

このアプリでは、クリック音をプログラムで作っています。

```ts
const buffer = ctx.createBuffer(1, length, sampleRate);
const data = buffer.getChannelData(0);
```

`data` は数値の配列です。ここに波形を書き込みます。

```ts
data[i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 100) * 0.9;
```

これは、短く減衰する高めの音を作っています。

ファイルでいうと `click.mp3` のような音声ファイルを読み込む代わりに、JavaScriptで小さなクリック音を作っているイメージです。

## AudioBufferSourceNode とは

`AudioBufferSourceNode` は、`AudioBuffer` に入っている音を実際に再生するためのノードです。

```ts
const source = ctx.createBufferSource();
source.buffer = buffer;
source.connect(destination);
source.start(when);
```

注意点として、`AudioBufferSourceNode` は一度しか再生できません。

そのため、メトロノームではクリックのたびに新しい `source` を作ります。

```txt
AudioBuffer          再利用できる音のデータ
AudioBufferSourceNode 1回再生したら使い捨て
```

## GainNode とは

`GainNode` は音量を調整するためのノードです。

```ts
const masterGain = ctx.createGain();
masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
masterGain.connect(ctx.destination);
```

音声処理はノードを線でつなぐように考えると分かりやすいです。

```txt
AudioBufferSourceNode
  ↓
GainNode
  ↓
ctx.destination
  ↓
スピーカー
```

`ctx.destination` は最終出力先です。ブラウザの音声出力先、つまりスピーカーやイヤホンにつながる場所だと考えてください。

## WebKit とは

WebKitは、Safariの中でWebページを表示・実行しているブラウザエンジンです。

ブラウザは大きく分けると、見た目のアプリ部分と、中でHTML/CSS/JavaScriptを処理するエンジン部分があります。

```txt
Safari
  └─ WebKit
       ├─ HTMLを解釈する
       ├─ CSSを描画する
       ├─ JavaScriptを実行する
       ├─ Web Audio APIを提供する
       └─ Service Workerを動かす
```

Chromeは主にBlinkというエンジンを使いますが、iPhone上のブラウザは基本的にWebKitを使います。

つまり、iPhoneではChromeアプリで開いても、中身のWebエンジンはSafariと同じWebKitです。

このアプリが「iPhone Safari対象」としている場合、WebKitの挙動を意識する必要があります。

## PlaywrightのWebKitテストで分かること

Playwrightでは、WebKit相当のブラウザで自動テストできます。

PR #50では、iPhone 15 Pro相当の画面サイズとWebKitを使って、メトロノームONの操作をテストしています。

ただし、PlaywrightのWebKitテストで分かることと、分からないことがあります。

分かること:

- ボタンが表示されるか
- タップ操作で処理が走るか
- `AudioContext.resume()` と `source.start()` の順序が正しいか
- UI状態がONに変わるか

分からないこと:

- 実機iPhoneのスピーカーから実際に音が出るか
- 消音モードや音量設定の影響
- Bluetoothイヤホンなど出力先の状態
- iOS実機固有の音声制限

つまり、Playwrightはとても有用ですが、実機音声確認の完全な代わりにはなりません。

## PWA とは

PWAは Progressive Web App の略です。

Webサイトをスマートフォンのホーム画面に追加し、アプリのように使えるようにする仕組みです。

PWAでは主に次の2つが重要です。

- `manifest.json`
- Service Worker

このアプリでは、`public/manifest.json` と `public/sw.js` がそれに対応します。

## manifest.json とは

`manifest.json` は、Webアプリの名前、アイコン、起動URL、表示方法などを書く設定ファイルです。

```json
{
  "name": "もぐもぐウォーク",
  "short_name": "もぐもぐ",
  "start_url": "/mogumogu-walk/",
  "scope": "/mogumogu-walk/",
  "display": "standalone"
}
```

主な役割は次の通りです。

- ホーム画面に表示する名前を決める
- ホーム画面に表示するアイコンを決める
- ホーム画面から起動したときのURLを決める
- Safariのタブではなく、アプリ風に表示するかを決める

`display: "standalone"` にすると、ホーム画面から開いたときに通常のSafariタブよりアプリに近い見た目になります。

## Service Worker とは

Service Worker は、ページとは別にブラウザの裏側で動くJavaScriptです。

主な役割は、ネットワーク通信の間に入って、ファイルをキャッシュすることです。

```txt
ページ
  ↓ リクエスト
Service Worker
  ├─ ネットワークから取る
  └─ キャッシュから返す
```

このアプリでは `public/sw.js` が Service Worker 本体です。

## なぜService Workerが必要なのか

Service Workerは、メトロノーム音を鳴らすために必要なものではありません。

必要になる理由は、PWAとしてアプリらしく使うためです。

このアプリでは、Service Workerにより次のような効果があります。

- 一度読み込んだHTML/CSS/JavaScriptをキャッシュできる
- 通信が不安定でも、キャッシュ済みの画面を表示できる可能性がある
- ホーム画面追加したWebアプリとしての体験を安定させやすい
- GitHub Pagesの静的ファイル配信でも、簡易的なオフライン対応ができる

逆に、Service Workerがなくても、オンラインでページを開けるならアプリ自体は動きます。

ただし、PWAとしてホーム画面から安定して使いたい場合や、通信が弱い場所でも起動しやすくしたい場合は、Service Workerが役立ちます。

## このアプリのService Workerの流れ

このアプリでは、`src/app/sw-register.tsx` でService Workerを登録しています。

```ts
navigator.serviceWorker.register("/mogumogu-walk/sw.js", {
  scope: "/mogumogu-walk/",
});
```

登録された `public/sw.js` は、主に3つのイベントを扱います。

```txt
install   初回インストール時。必要なファイルをキャッシュする
activate  新しいService Workerを有効化し、古いキャッシュを消す
fetch     通信を横取りし、ネットワークまたはキャッシュから返す
```

このアプリの `fetch` は、ネットワーク優先です。

```txt
まずネットワークから取得
  ↓
成功したらキャッシュにも保存
  ↓
失敗したらキャッシュから返す
```

つまり、オンラインならなるべく最新のファイルを使い、ネットワークに失敗したときだけキャッシュを使います。

## Service WorkerとlocalStorageの違い

Service WorkerとlocalStorageは、どちらもブラウザに何かを保存しますが、役割が違います。

```txt
Service Worker / Cache Storage
  └─ アプリ本体のファイルを保存する
     例: HTML, CSS, JavaScript, 画像

localStorage
  └─ ユーザーのデータを保存する
     例: 今日の歩数記録
```

もぐもぐウォークの歩数記録は、Service WorkerではなくlocalStorageに保存されています。

Service Workerを消しても、localStorageの記録がすぐ消えるわけではありません。

localStorageを消しても、Service Workerのキャッシュがすぐ消えるわけではありません。

この2つは別の保存場所です。

## PWAと音声再生の関係

PWAとしてホーム画面から起動しても、iPhone Safariの音声制限は残ります。

つまり、PWAにすれば自動的にメトロノーム音が鳴りやすくなるわけではありません。

音声再生に関して大事なのは、PWAかどうかよりも次の点です。

- ユーザーのタップ後に `AudioContext` を作る
- ユーザーのタップ後に `resume()` する
- `running` になった後に音を鳴らす
- iPhone本体の音量や消音モードを確認する

PWAは「起動体験」や「キャッシュ」に関係します。

Web Audio APIは「音を鳴らす処理」に関係します。

この2つを分けて考えると、問題調査がしやすくなります。

## まとめ

このアプリで出てくる用語を短くまとめると、次の通りです。

```txt
Web Audio API
  ブラウザで音を作って鳴らすためのAPI

AudioContext
  Web Audio APIの音声エンジン

resume()
  suspended状態のAudioContextをrunningに再開する処理

WebKit
  SafariやiPhone上のブラウザが使うWebエンジン

PWA
  Webサイトをホーム画面追加できるアプリのように扱う仕組み

manifest.json
  PWAの名前、アイコン、起動URLなどを書く設定ファイル

Service Worker
  裏側で動き、アプリ本体のファイルをキャッシュするJavaScript
```

メトロノーム音が鳴らない問題を調べるときは、まず Web Audio API / AudioContext / resume の流れを見ます。

ホーム画面追加やキャッシュの問題を調べるときは、PWA / manifest / Service Worker を見ます。
