# CLAUDE.md

## プロジェクト概要

矯正トレーニング中に歩数を計測するWebアプリ「もぐもぐウォーク」。
子供向けのシンプルでかわいいUIで、iPhone Safari 上で動作する。

## 技術スタック

- **フレームワーク**: Next.js（静的エクスポート）
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **ホスティング**: GitHub Pages（`/mogumogu-walk` パス）
- **データ保存**: localStorage のみ（サーバーサイド不使用）
- **センサー**: DeviceMotionEvent（加速度センサー）
- **音声**: Web Audio API（音源ファイルなし）

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 静的エクスポート（out/ ディレクトリに出力）
npm run lint     # Lint チェック
```

## 開発フロー

Issue を実装する際は git worktree を使用して作業ディレクトリを分離する。

### worktree の作成

```bash
git worktree add -b feature/issue-{番号}-{概要} ../mogumogu-walk-issue-{番号}
```

### 作業完了後の削除

```bash
git worktree remove ../mogumogu-walk-issue-{番号}
```

## 重要な制約

### 対応環境
- **iPhone Safari のみ**対応。Android は未対応。

### Next.js 静的エクスポート
- API Routes・Server Actions・サーバーサイド処理は**使用禁止**。
- `next.config.js` の設定：

```js
const nextConfig = {
  output: 'export',
  basePath: '/mogumogu-walk',
  assetPrefix: '/mogumogu-walk',
};
```

### iPhone Safari のセンサー許可
- `DeviceMotionEvent.requestPermission()` は**必ずユーザー操作（タップ）後**に呼ぶこと。
- アプリ起動時の自動呼び出しは禁止（許可ダイアログが無視される）。

### Web Audio API（メトロノーム）
- `AudioContext` は**ユーザー操作後**に生成すること（iOS 制限）。
- 音源ファイルは使用せず、オシレーターで生成する。
- 初期状態は **OFF**。

## localStorage 設計

```ts
const STORAGE_KEY = 'mogumogu-walk-training';

// 保存データ構造
type TrainingData = {
  date: string; // "YYYY-MM-DD"
  sessions: Session[];
};

type Session = {
  slot: number;  // 1始まりの連番（削除後は詰め直す）
  steps: number;
  time: string;  // "HH:MM"
};
```

**slot 採番ルール**: 個別削除後は 1 から連番に詰め直す。

## UI 方針

- スマホ縦持ち前提
- パステルカラー基調、角丸大きめ
- ボタンは大きく、文字は読みやすいサイズ
- アイコンはすべて絵文字を使用

## GitHub Issues との対応

| Issue | 内容 |
|-------|------|
| #1 | プロジェクトセットアップ |
| #2 | GitHub Pages デプロイ設定 |
| #3 | 歩数計測機能 |
| #4 | localStorage 保存 |
| #5 | 1日6回の記録管理 |
| #6 | メトロノーム機能 |
| #7 | PWA対応 |
| #8 | UIデザイン実装 |
