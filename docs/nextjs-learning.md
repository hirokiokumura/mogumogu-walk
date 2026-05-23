# もぐもぐウォークで学ぶ Next.js 入門

このドキュメントは、フロントエンド開発や Next.js に慣れていない状態から、このリポジトリの実装を読み解けるようになるためのメモです。

対象アプリ「もぐもぐウォーク」は、iPhone Safari 上で動く子供向け歩数カウンターです。GitHub Pages に静的ファイルとして公開するため、Next.js のサーバー機能ではなく、ブラウザだけで動く実装を中心にしています。

## Next.js と React の関係

Next.js と React は、同じものではありません。

ざっくり言うと、React は画面を作るためのライブラリで、Next.js は React を使って Web アプリ全体を作るためのフレームワークです。

- React: UI 部品を作る道具
- Next.js: その UI 部品をページとして配置し、ビルド・ルーティング・配信まで面倒を見る仕組み

このアプリで React が担当しているのは、ボタンや記録一覧などの UI、クリック時の処理、状態に応じた表示切り替えです。

```tsx
export function StepCounter() {
  const [error, setError] = useState<string | null>(null);

  return (
    <button type="button">
      はじめる
    </button>
  );
}
```

このように、画面の部品を関数として作るのが React の基本です。

一方、Next.js は `src/app/page.tsx` のような特別なファイルを見て、「このファイルはページだ」と判断します。

```tsx
export default function Home() {
  return <StepCounter />;
}
```

Next.js は、次のようなアプリ全体の仕組みを担当します。

- どの URL でどのページを表示するか
- HTML / CSS / JavaScript としてどうビルドするか
- `metadata` をどう `<head>` に入れるか
- 静的サイトとしてどう書き出すか
- `public/` の画像や manifest をどう配信するか

このプロジェクトでの関係は次のように考えるとわかりやすいです。

```txt
Next.js
  ├─ Next.jsの仕様として意味がある場所
  │    ├─ src/app/page.tsx をページとして扱う
  │    ├─ src/app/layout.tsx を全体レイアウトとして扱う
  │    ├─ public/ を静的ファイル置き場として扱う
  │    └─ next.config.ts の設定で静的サイトとして出力する
  │
  └─ React/フロントエンド開発の慣習として分けている場所
       ├─ src/components/ UIコンポーネントを置く
       │    ├─ StepCounter
       │    └─ SessionList
       ├─ src/hooks/ React Hooksを使ったロジックを置く
       │    ├─ useStepCounter
       │    └─ useMetronome
       └─ src/lib/ UIに直接依存しない共通処理を置く
            └─ storage
```

`src/app`、`public`、`next.config.ts` は Next.js の仕様として意味があります。特に `src/app/page.tsx` や `src/app/layout.tsx` は、ファイル名と置き場所によって Next.js が特別に扱います。

一方、`src/components`、`src/hooks`、`src/lib` は Next.js の必須仕様ではありません。React やフロントエンド開発でよく使われるディレクトリ分けの慣習です。別の名前にしても動かせますが、役割ごとに分けると読みやすくなります。

つまり、実装中に書く `.tsx` の多くは React の書き方です。ただし、そのファイルをページとして扱ったり、アプリとして組み立てたり、ビルドしたりするのが Next.js です。

最初は「React は UI を作るもの。Next.js は React 製 UI を Web アプリとして成立させるもの」と理解しておけば大丈夫です。

## このアプリの全体像

主な技術は次の通りです。

- Next.js: 画面、ルーティング、ビルドを担当
- React: UI コンポーネントと状態管理を担当
- TypeScript: 型安全に JavaScript を書くために使用
- Tailwind CSS: CSS クラスで見た目を指定
- localStorage: ブラウザ内に歩数記録を保存
- DeviceMotionEvent: iPhone のモーションセンサーで歩数を計測
- Web Audio API: メトロノーム音をプログラムで生成
- PWA: ホーム画面追加や Service Worker 対応

GitHub Pages で配信するため、`next.config.ts` では次の設定をしています。

```ts
const nextConfig = {
  output: "export",
  basePath: "/mogumogu-walk",
  assetPrefix: "/mogumogu-walk",
};
```

`output: "export"` は、Next.js アプリを静的な HTML / CSS / JS に書き出す設定です。そのため、このプロジェクトでは API Routes や Server Actions のようなサーバー実行前提の機能は使いません。

`basePath` があるので、ローカル開発時もトップページは `http://localhost:3000/` ではなく `http://localhost:3000/mogumogu-walk` になります。

## ディレクトリ構成の読み方

このリポジトリでは、おおよそ次の役割でファイルが分かれています。

```txt
src/
  app/
    layout.tsx       # アプリ全体のHTML骨格、メタデータ、PWA設定
    page.tsx         # トップページ
    globals.css      # グローバルCSS
    sw-register.tsx  # Service Worker登録
  components/
    StepCounter.tsx  # 歩数カウンター画面
    SessionList.tsx  # 記録一覧
  hooks/
    useStepCounter.ts # 歩数計測ロジック
    useMetronome.ts   # メトロノーム音ロジック
  lib/
    storage.ts       # localStorage保存・読み込み
public/
  manifest.json
  sw.js
```

Next.js の `src/app` 配下は App Router と呼ばれる仕組みです。ファイル名に意味があります。

- `layout.tsx`: 全ページ共通のレイアウト
- `page.tsx`: その階層のページ本体
- `globals.css`: アプリ全体に効く CSS

このアプリにはページがほぼ1つだけなので、`src/app/page.tsx` がトップページです。

## Server Component と Client Component

Next.js App Router では、コンポーネントは標準では Server Component として扱われます。

Server Component はサーバー側で描画される前提のコンポーネントです。ブラウザ専用 API を直接使えません。

一方、次のような機能はブラウザでしか動きません。

- `window`
- `localStorage`
- `DeviceMotionEvent`
- `AudioContext`
- `useState`
- `useEffect`
- クリックイベント

そのため、これらを使うファイルの先頭には `"use client";` を書きます。

例: `src/hooks/useMetronome.ts`

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
```

この指定により、そのファイルは Client Component 側のコードとして扱われ、ブラウザ上で実行できます。

## `layout.tsx` の役割

`src/app/layout.tsx` はアプリ全体の土台です。

このファイルでは、主に次のことをしています。

- ページタイトルや説明文を設定
- PWA manifest を設定
- iPhone ホーム画面追加向けのアイコンや表示設定を設定
- viewport を設定
- Service Worker 登録用コンポーネントを読み込む

`metadata` は Next.js が `<head>` に反映してくれる設定です。

```ts
export const metadata = {
  title: "もぐもぐウォーク",
  description: "矯正トレーニング用歩数カウンター",
  manifest: "/mogumogu-walk/manifest.json",
};
```

`viewport` では、iPhone向けに幅やズーム設定を調整しています。

## `page.tsx` の役割

`src/app/page.tsx` はトップページです。

```tsx
import { StepCounter } from "@/components/StepCounter";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4">
      <h1 className="text-2xl font-bold mt-4 mb-8">🌈 もぐもぐウォーク</h1>
      <StepCounter />
    </main>
  );
}
```

ここでは大きなロジックは持たず、画面の枠と `StepCounter` コンポーネントの表示だけを担当しています。

Next.js では、ページファイルを薄くして、実際の画面やロジックを `components` や `hooks` に分けると読みやすくなります。

## React コンポーネントの考え方

`StepCounter.tsx` は、ユーザーが見る歩数カウンター画面です。

このコンポーネントは、自分ですべての処理を持つのではなく、カスタムフックを呼び出して機能を組み合わせています。

```ts
const { state, steps, start, stop } = useStepCounter();
const {
  isOn: metronomeOn,
  toggle: toggleMetronome,
  stop: stopMetronome,
} = useMetronome();
```

このように分けると、責務が整理されます。

- `StepCounter.tsx`: 画面表示、ボタン、エラーメッセージ
- `useStepCounter.ts`: センサー許可、歩数計測
- `useMetronome.ts`: 音声再生、メトロノームON/OFF
- `storage.ts`: 保存、削除、日付リセット

フロントエンドでは「見た目」と「状態・副作用」を分ける意識が重要です。

## React Hooks の基本

このアプリでは、React Hooks が多く使われています。

### `useState`

画面に反映したい状態を持ちます。

```ts
const [isOn, setIsOn] = useState(false);
```

`isOn` が現在値、`setIsOn` が更新関数です。値を更新すると React が画面を再描画します。

### `useRef`

再描画しても保持したい値を入れます。ただし、値を変えても画面は再描画されません。

```ts
const ctxRef = useRef<AudioContext | null>(null);
```

`AudioContext` や `setInterval` のIDのように、画面表示そのものではないが保持したいものに向いています。

### `useEffect`

イベントリスナー登録やクリーンアップなど、画面描画の外側にある処理を扱います。

```ts
useEffect(() => {
  return () => {
    ctxRef.current?.close();
  };
}, []);
```

上の例では、コンポーネントが破棄されるときに `AudioContext` を閉じます。

### `useCallback`

関数を再利用し、不要な再生成を減らします。

```ts
const stop = useCallback(() => {
  setIsOn(false);
}, []);
```

Hooks の依存配列には、その関数内で参照している外側の値を入れます。依存配列が間違うと、古い値を参照するバグにつながることがあります。

## localStorage と `useSyncExternalStore`

歩数記録は `src/lib/storage.ts` で localStorage に保存しています。

保存キーは `mogumogu-walk-training` に統一されています。

```ts
const STORAGE_KEY = "mogumogu-walk-training";
```

保存データは次の形です。

```ts
export type TrainingData = {
  date: string;
  sessions: Session[];
};
```

起動時に保存日付と今日の日付を比較し、日付が変わっていたらリセットします。

```ts
if (parsed.date !== today()) {
  const reset = { date: today(), sessions: [] };
  save(reset);
  return reset;
}
```

`StepCounter.tsx` では `useSyncExternalStore` を使って、localStorage の変更を React の画面に反映しています。

```ts
const sessions = useSyncExternalStore(
  subscribeToSessions,
  getSessionsSnapshot,
  getSessionsServerSnapshot,
);
```

localStorage は React の外側にある状態なので、更新されたことを React に知らせる仕組みが必要です。この実装では、保存・削除後に独自イベント `mogumogu-storage-change` を発火しています。

## iPhone Safari とセンサー許可

iPhone Safari では、`DeviceMotionEvent.requestPermission()` はユーザーのタップ後に呼ぶ必要があります。

このアプリでは、「はじめる」ボタンを押したあとに `useStepCounter().start()` が呼ばれ、その中で許可を求めます。

```ts
const handleStart = () => {
  setSavedSteps(null);
  setError(null);
  start();
};
```

センサー許可が拒否された場合は `denied` 状態にして、ユーザーにメッセージを表示します。

フロントエンドでは、このようなブラウザAPIの失敗を必ず考慮します。ユーザーの端末設定、ブラウザ設定、プライベートモードなどで失敗することがあるためです。

## 今回のメトロノーム修正

今回の修正対象は `src/hooks/useMetronome.ts` です。

目的は、iPhone 15 Pro Safari でメトロノーム音が一度も鳴らない問題を改善することでした。

Web Audio API は iPhone Safari では制約が強く、`AudioContext` の生成や再生開始はユーザー操作に結びついている必要があります。

重要なのは、単にクリックイベントの中で `AudioContext.resume()` を呼ぶだけでは不十分な場合があることです。`await ctx.resume()` の完了後に初回の音源ノードを作ると、iOS Safari ではユーザー操作の同期範囲から外れた扱いになり、無音になることがあります。

そこで、今回の実装では次の順序に変えています。

1. メトロノームボタンのタップで `start()` を呼ぶ
2. `AudioContext` を作る
3. クリック音の `AudioBuffer` を作る
4. 初回クリック音をすぐ未来の時刻に予約する
5. 必要なら `ctx.resume()` を呼ぶ
6. `setInterval` で次のクリック音を継続的に予約する

実装の中心はここです。

```ts
const firstBeatTime = ctx.currentTime + FIRST_BEAT_DELAY;

playClick(ctx, masterGain, clickBuffer, firstBeatTime);
nextBeatTimeRef.current = firstBeatTime + intervalSec;

if (ctx.state !== "running") {
  const resumePromise = ctx.resume();
  void resumePromise.catch(() => {
    stop();
  });
}
```

ポイントは、`resume()` の完了を待つ前に、初回の実音クリックを予約していることです。

今回追加した `playClick()` は、クリック音を鳴らす処理を共通化しています。

```ts
function playClick(
  ctx: AudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  when: number,
) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(destination);
  source.start(when);
}
```

`AudioBufferSourceNode` は一度 `start()` すると再利用できません。そのため、クリック音を鳴らすたびに `createBufferSource()` で新しい source を作っています。一方、音の波形データである `AudioBuffer` は再利用できます。

## メトロノームのスケジューリング

メトロノームでは、`setInterval` のタイミングぴったりに音を鳴らすのではなく、少し先の音を Web Audio API に予約しています。

```ts
const SCHEDULE_INTERVAL_MS = 50;
const LOOKAHEAD_SEC = 0.1;
```

`setInterval` は JavaScript の都合で多少遅れることがあります。そこで、50ms ごとに「今から0.1秒先までに鳴らすべき音」をチェックし、Web Audio の正確な時計である `ctx.currentTime` に対して予約します。

```ts
while (nextBeatTimeRef.current < currentCtx.currentTime + LOOKAHEAD_SEC) {
  playClick(
    currentCtx,
    currentMasterGain,
    currentBuffer,
    nextBeatTimeRef.current,
  );
  nextBeatTimeRef.current += intervalSec;
}
```

120 BPM は1分間に120拍なので、1拍の間隔は `60 / 120 = 0.5秒` です。

```ts
const intervalSec = 60 / BPM;
```

## なぜ `useRef` を使うのか

`useMetronome` では、`AudioContext` や `setInterval` のIDを `useRef` に入れています。

```ts
const ctxRef = useRef<AudioContext | null>(null);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

これらは画面に直接表示する状態ではありません。`useState` にすると更新のたびに再描画が起きますが、音声制御には不要です。

そのため、再描画を起こさず値を保持できる `useRef` が向いています。

## PWA とは何か

PWA は Progressive Web App の略です。Webサイトを、スマートフォンのホーム画面に追加できるアプリのように扱うための仕組みです。

通常のWebサイトは、SafariなどのブラウザでURLを開いて使います。一方、PWA対応しているWebサイトは、ホーム画面に追加するとアプリのような見た目で起動できます。

PWAでよく使われる要素は次の通りです。

- manifest: アプリ名、アイコン、起動URL、表示モードなどを定義するJSON
- Service Worker: ブラウザの裏側で動き、キャッシュやオフライン対応を制御するJavaScript
- HTTPS配信: Service Workerを使うために基本的に必要
- アイコン: ホーム画面やアプリ一覧に表示する画像

このアプリでは、iPhone Safariで使うことを想定しているため、PWA設定もiPhoneのホーム画面追加を意識しています。

## manifest.json の役割

`public/manifest.json` は、ブラウザに「このWebサイトはアプリとして扱えます」と伝えるための設定ファイルです。

このアプリでは次のような設定があります。

```json
{
  "name": "もぐもぐウォーク",
  "short_name": "もぐもぐ",
  "start_url": "/mogumogu-walk/",
  "scope": "/mogumogu-walk/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#D8A4F0",
  "theme_color": "#D8A4F0"
}
```

重要な項目は次の通りです。

- `name`: アプリの正式名称
- `short_name`: ホーム画面などで短く表示される名前
- `start_url`: ホーム画面から起動したときに開くURL
- `scope`: PWAとして扱うURL範囲
- `display`: 表示モード
- `orientation`: 画面の向き
- `theme_color`: ブラウザUIやPWAのテーマ色
- `icons`: ホーム画面やアプリ一覧で使うアイコン

`display: "standalone"` にすると、ホーム画面から開いたときに通常のSafariタブよりアプリに近い表示になります。

このプロジェクトでは `basePath: "/mogumogu-walk"` を使っているため、`start_url` や `scope`、アイコンのパスも `/mogumogu-walk/` から始まっています。GitHub Pagesではリポジトリ名配下に配信されるため、このパス合わせが重要です。

## layout.tsx とPWAメタデータ

`src/app/layout.tsx` では、Next.jsの `metadata` を使って manifest や iPhone向け設定を指定しています。

```ts
export const metadata: Metadata = {
  title: "もぐもぐウォーク",
  description: "矯正トレーニング用歩数カウンター",
  manifest: "/mogumogu-walk/manifest.json",
  icons: {
    apple: [
      { url: "/mogumogu-walk/icons/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "もぐもぐウォーク",
  },
};
```

`manifest` は、先ほどの `public/manifest.json` へのリンクです。

`icons.apple` は、iPhoneのホーム画面に追加したときに使われるアイコンです。iOS SafariはPWA対応に少し独自の癖があるため、通常の manifest アイコンだけでなく Apple向けアイコンも指定しています。

`appleWebApp.capable: true` は、ホーム画面から起動したときにWebアプリらしく表示するための設定です。

## Service Worker とは何か

Service Worker は、ページ本体とは別にブラウザの裏側で動くJavaScriptです。

普通のJavaScriptは、ページを開いている間だけ画面の中で動きます。一方、Service Workerはネットワークリクエストの途中に入り、レスポンスをキャッシュしたり、ネットワークが失敗したときにキャッシュから返したりできます。

Service Workerができる代表的なことは次の通りです。

- 画像、CSS、JavaScript、HTMLなどをキャッシュする
- オフライン時にキャッシュ済みのページを表示する
- 古いキャッシュを削除する
- リクエストをネットワーク優先、キャッシュ優先などの方針で処理する

このアプリでは、`public/sw.js` が Service Worker 本体です。

## Service Worker の登録

Service Workerはファイルを置くだけでは動きません。ブラウザに登録する必要があります。

このアプリでは `src/app/sw-register.tsx` で登録しています。

```tsx
"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/mogumogu-walk/sw.js", {
        scope: "/mogumogu-walk/",
      });
    }
  }, []);

  return null;
}
```

`navigator.serviceWorker.register()` が登録処理です。

ここでも `/mogumogu-walk/` が重要です。

- Service Worker本体: `/mogumogu-walk/sw.js`
- Service Workerの担当範囲: `/mogumogu-walk/`

`SwRegister` は画面には何も表示しないため、`return null` です。目的は、ページ表示後に `useEffect` でService Workerを登録することだけです。

`layout.tsx` で次のように読み込まれているため、アプリ全体で一度登録されます。

```tsx
<body className="min-h-full">
  {children}
  <SwRegister />
</body>
```

`useEffect` を使っている理由は、Service Worker登録に必要な `navigator` がブラウザにしか存在しないためです。サーバー側で実行されるタイミングでは `navigator` は使えません。

## sw.js の処理

`public/sw.js` は3つのイベントを扱っています。

- `install`
- `activate`
- `fetch`

### install

`install` はService Workerがインストールされるときに発火します。

```js
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }),
  );
});
```

ここでは、最初にキャッシュしておきたいURLを保存しています。

```js
const PRECACHE_URLS = [`${BASE_PATH}/`];
```

つまり `/mogumogu-walk/` を事前キャッシュしています。

`self.skipWaiting()` は、新しいService Workerをなるべく早く有効化するための処理です。

### activate

`activate` はService Workerが有効化されるときに発火します。

```js
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
});
```

ここでは、今のキャッシュ名と違う古いキャッシュを削除しています。

```js
const CACHE_NAME = "mogumogu-walk-v2";
```

Service Workerはキャッシュが残りやすい仕組みです。アプリを更新しても古いファイルが使われ続けることがあります。そのため、`CACHE_NAME` を変えて古いキャッシュを消す設計がよく使われます。

`self.clients.claim()` は、開いているページを新しいService Workerの管理下に置くための処理です。

### fetch

`fetch` は、ページがHTML、CSS、JavaScript、画像などを取得しようとしたときに発火します。

```js
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(`${BASE_PATH}/`)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((r) => r ?? Response.error()),
      ),
  );
});
```

この実装は、ネットワーク優先のキャッシュ戦略です。

流れは次の通りです。

1. まずネットワークから最新のレスポンスを取りに行く
2. 成功したら、そのレスポンスをキャッシュにも保存する
3. ネットワークが失敗したら、キャッシュにあるものを返す
4. キャッシュにもなければエラーにする

ネットワーク優先なので、オンライン時はできるだけ最新の内容を表示します。一方、過去に取得済みのファイルはキャッシュされるため、通信が不安定なときにも表示できる可能性があります。

このアプリでは次の条件に合うリクエストだけをService Workerが扱います。

- `GET` リクエストである
- 同じオリジンである
- URLのパスが `/mogumogu-walk/` から始まる

この条件により、関係ない外部サイトや別パスのリクエストまでキャッシュしないようにしています。

## PWA と localStorage の違い

PWAやService Workerは、アプリのファイルをキャッシュする仕組みです。

一方、localStorageはユーザーの記録データを保存する仕組みです。

この2つは役割が違います。

- Service Worker / Cache Storage: HTML、CSS、JavaScript、画像など、アプリ本体を保存する
- localStorage: 歩数記録など、ユーザーのデータを保存する

つまり、Service Workerがあるから歩数記録が保存されるわけではありません。歩数記録は `src/lib/storage.ts` の localStorage 処理で保存されています。

逆に、localStorageがあるからオフライン表示できるわけでもありません。オフライン表示に関係するのはService WorkerとCache Storageです。

この区別はとても大事です。

## iPhone SafariでPWAを見るときの注意

iPhone SafariのPWAは、ChromeなどのPWAと少し挙動が違うことがあります。

特に注意する点は次の通りです。

- ホーム画面追加はSafariの共有メニューから行う
- manifestよりApple独自メタタグやapple-touch-iconが効く場面がある
- Service Workerやキャッシュが強く残り、修正後も古いファイルが使われることがある
- Web AudioやDeviceMotionEventは、PWA表示でもユーザー操作が必要
- バックグラウンド移行時の音声再生やセンサー取得は制限されることがある

実機確認で「コードを直したはずなのに変わらない」ときは、Service Workerのキャッシュが原因の場合があります。

その場合は、次のような確認をします。

- Safariでページを再読み込みする
- ホーム画面のPWAを一度削除して追加し直す
- SafariのWebサイトデータを削除する
- `CACHE_NAME` を変更して古いキャッシュを削除させる

開発中は、Service Workerが便利さと同時に混乱の原因にもなります。PWAまわりの不具合を調べるときは、「今見ているファイルは本当に最新か」を最初に疑うとよいです。

## 静的エクスポートで気をつけること

このアプリは GitHub Pages に置くため、サーバー処理は使えません。

使ってよいもの:

- React コンポーネント
- Client Component
- ブラウザAPI
- localStorage
- 静的ファイル

避けるもの:

- API Routes
- Server Actions
- サーバー側DB接続
- 実行時にサーバーが必要な処理

静的エクスポートでは、アプリの状態は基本的にブラウザ側で管理します。このアプリでは localStorage を使っているため、サーバーなしで記録を残せます。

## 開発時によく使うコマンド

開発サーバーを起動します。

```bash
npm run dev
```

このプロジェクトは `basePath` があるため、表示URLは次です。

```txt
http://localhost:3000/mogumogu-walk
```

本番ビルドを確認します。

```bash
npm run build
```

特定ファイルだけ lint を確認します。

```bash
npx eslint src/hooks/useMetronome.ts
```

現状、全体の `npm run lint` は `.claude/worktrees` 配下の生成物まで拾うと失敗することがあります。実務では、lint 対象から生成物や作業用ディレクトリを除外する設定も重要です。

## 学習の順番

このリポジトリで Next.js と React を学ぶなら、次の順番で読むのがおすすめです。

1. `src/app/page.tsx`
2. `src/components/StepCounter.tsx`
3. `src/hooks/useStepCounter.ts`
4. `src/hooks/useMetronome.ts`
5. `src/lib/storage.ts`
6. `src/app/layout.tsx`
7. `next.config.ts`

最初は「ページがコンポーネントを表示する」「コンポーネントが hooks を呼ぶ」「hooks がブラウザAPIを扱う」という流れをつかむと読みやすくなります。

## このアプリから学べること

このアプリは小さめですが、実用的なフロントエンド開発の要素がかなり詰まっています。

- App Router の基本
- Server Component と Client Component の違い
- React Hooks による状態管理
- ブラウザAPIの扱い
- iPhone Safari 固有制約への対応
- localStorage の堅牢な読み書き
- 静的エクスポートと GitHub Pages 配信
- PWA の基本設定

Next.js は単なるページ作成フレームワークではなく、React アプリをどう配信し、どう分割し、どうブラウザとサーバーの責務を分けるかを整理するためのフレームワークです。

このプロジェクトではサーバー機能をほぼ使っていませんが、それでも `app` ディレクトリ、メタデータ、静的ビルド、Client Component など、Next.js の重要な入口を学べます。
