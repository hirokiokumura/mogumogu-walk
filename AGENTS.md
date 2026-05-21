# AGENTS.md

## 言語設定

**すべてのレビューコメント・フィードバック・提案は日本語で記述すること。**

## プロジェクト概要

「もぐもぐウォーク」は、矯正トレーニング中の歩数を計測する子供向け Web アプリ。
iPhone Safari 上で動作し、GitHub Pages でホストされる。

## レビュー時の重点確認事項

### 対応環境・制約
- **対象は iPhone Safari のみ**。Android 対応コードは不要。
- Next.js は静的エクスポート（`output: 'export'`）。API Routes・Server Actions は使用禁止。

### iPhone Safari 固有の制約
- `DeviceMotionEvent.requestPermission()` はユーザーのタップ後にのみ呼び出す。
- `AudioContext` もユーザー操作後に生成する（iOS の自動再生ブロック対策）。
- メトロノームの初期状態は OFF であること。

### データ整合性
- localStorage のキーは `mogumogu-walk-training` で統一されているか。
- session の `slot` は 1 始まりの連番で、削除後に詰め直されているか。
- 日付チェック（アプリ起動時に今日の日付と保存日付を比較してリセット）が機能しているか。

### セキュリティ・堅牢性
- localStorage の読み込みで JSON パースエラーの考慮があるか。
- センサー許可が拒否された場合のエラーハンドリングがあるか。

### UX
- 計測中は「はじめる」ボタンが非表示・無効化されているか。
- 全リセット時に確認ダイアログが表示されるか。
- 6回記録後に新規計測が開始できないようになっているか。

## 技術スタック

- Next.js + TypeScript + Tailwind CSS
- localStorage（サーバーサイドDB なし）
- DeviceMotionEvent（歩数計測）
- Web Audio API（メトロノーム、音源ファイルなし）
- PWA（manifest + Service Worker）

## ディレクトリ構成（想定）

```
src/
  app/          # Next.js App Router
  components/   # UIコンポーネント
  hooks/        # カスタムフック（センサー、localStorage等）
  lib/          # ユーティリティ（storage操作等）
public/
  manifest.json
```

## 詳細仕様

詳細は [requirements.md](./requirements.md) を参照。

## AI スキル（modern-web-guidance）

HTML・CSS・クライアントサイド JS を実装する際は `modern-web-guidance` スキルを参照すること。

### 対象となる実装例

- モーダル・ダイアログ → `<dialog>` 要素を優先
- 確認ダイアログ（#5 リセット） → `<dialog>` + `showModal()`
- CSS レイアウト → コンテナクエリ、`@layer`、`:has()` を検討
- スクロール演出 → Scroll-driven Animations、View Transitions

### セットアップ

`.agents/` は gitignore されており、クローン後に以下で再生成する：

```bash
npx modern-web-guidance@latest install
```

バージョンは `skills-lock.json` で固定されている。
