# もぐもぐウォーク iOS アプリ 要件定義

## 0. 開発開始前の準備（初回のみ）

iOS アプリ開発・TestFlight 配布には、コードを書く前に以下の準備が必要。
未対応の場合、開発開始まで数日かかることがある。

| 準備項目 | 内容 | 担当 | 完了 |
|---------|------|------|----|
| **Mac** | macOS 15 (Sequoia) 以上 + Xcode 17（iOS 26 SDK 同梱、約15GB） | [要記入] | [ ] |
| **Apple Developer Program 加入** | ¥12,800/年。[developer.apple.com/jp/programs/](https://developer.apple.com/jp/programs/) から登録（審査 24〜48時間）。TestFlight 配布には有料加入が必須（無料枠では不可） | [要記入] | [ ] |
| **App Store Connect でアプリ登録** | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → 新規 App → Bundle ID 取得、アプリ名「もぐもぐウォーク」、言語「日本語」を設定 | [要記入] | [ ] |
| **Bundle ID 決定** | 例: `com.yourname.mogumogu-walk`（App Store Connect で登録後、Xcode と一致させる） | [要記入] | [ ] |
| **Xcode Signing 設定** | Signing & Capabilities で Team を選択、Bundle Identifier を App Store Connect と一致させ、Automatically manage signing を有効化 | 実装担当 | [ ] |
| **App Icon 制作** | 1024×1024px PNG（絵文字そのものは使用不可。下記 App Icon セクション参照） | [要記入] | [ ] |
| **PrivacyInfo.xcprivacy 作成** | UserDefaults 使用の Privacy Manifest（下記セクション7参照） | 実装担当 | [ ] |

### Xcode Signing 設定

Xcode でプロジェクトを開いたら、以下を設定する。

```txt
Xcode → [プロジェクト] → Signing & Capabilities
  - Team: Apple Developer Program に登録したチームを選択
  - Bundle Identifier: App Store Connect で登録した Bundle ID と一致させる
  - Signing Certificate: Automatically manage signing を有効化（推奨）
  - Background Modes: Audio, AirPlay, and Picture in Picture を有効化
```

Bundle ID が App Store Connect 側と一致しない場合、Archive や TestFlight アップロードで署名エラーになる。

### TestFlight ビルドアップロード手順

```
1. Xcode でビルドターゲットを「Any iOS Device (arm64)」に設定
2. Product → Archive でアーカイブビルドを作成
3. Organizer → Distribute App → App Store Connect → Upload
4. App Store Connect の TestFlight タブで処理完了を待つ（15〜30分）
5. テスターのメールアドレスを追加して招待メールを送信
6. テスターが TestFlight アプリ（App Store 無料）をインストールして招待メールからインストール
```

---

## 1. アプリ概要

| 項目 | 内容 |
|------|------|
| アプリ名 | もぐもぐウォーク |
| 目的 | 矯正トレーニング中の歩数計測 |
| ターゲット | 矯正トレーニングを行う子供（保護者が設定・利用） |
| プラットフォーム | iOS 16.0 以上 / iPhone |
| 配布方法 | TestFlight |
| 言語 | 日本語のみ |

### Web版からの移行理由

| 課題 | Web版（現行） | iOS版（解決後） |
|------|------------|------------|
| バックグラウンド再生 | 画面オフでメトロノームが停止 | Background Audio で継続再生 |
| 歩数精度 | 自前アルゴリズム（閾値1.5、間隔300ms）で低精度 | CMPedometer（Appleモーションコプロセッサ）で高精度 |
| センサー権限 | 毎回ユーザー操作が必要 | 初回のみ許可 |

---

## 2. 機能要件

### 2-1. 歩数カウント

**基本動作**：
- 「はじめる」ボタンタップで `CMPedometer.startUpdates(from: sessionStartTime)` を開始
- `sessionStartTime`（`Date` 型）を**メモリと UserDefaults 一時キー `mogumogu-walk-active-session` の両方に保存**する（OS によるアプリ終了後も復元可能にするため）
- 計測中は `startUpdates` コールバックの `numberOfSteps` をリアルタイムで画面に表示（整数）
- 「とめる」ボタンタップ時の歩数確定は以下の手順で行う：

```
1. stopUpdates() で更新を停止
2. queryPedometerData(from: sessionStartTime, to: Date()) で確定値を取得
3. 取得した finalSteps をセッションに保存
4. 一時キー mogumogu-walk-active-session を UserDefaults から削除
```

> `startUpdates` のコールバックは非同期バッチ処理のため、最後のコールバック値は停止直前の歩数を含まない場合がある。`queryPedometerData` による確定値取得が必須。

**フォアグラウンド復帰時の再同期**：
- `scenePhase == .active` かつ計測中の場合、`sessionStartTime` から `startUpdates` を再発行して歩数を最新値に同期する
- 画面ロック解除後も同様に再同期が走る

**スレッド安全性**：
- `CMPedometer` のコールバックはメインスレッドではなく任意のシリアルキューで呼ばれる
- コールバック内での UI 更新は必ず `DispatchQueue.main.async {}` または `await MainActor.run {}` 経由で行う

**ハードウェア確認**：
- 起動時に `CMPedometer.isStepCountingAvailable()` で利用可否を確認する
- `false` の場合は「この端末では歩数計測を利用できません」を表示し、「はじめる」ボタンを非活性化

**権限フロー**：
- `CMPedometer.startUpdates()` の**初回呼び出し時**に「モーションとフィットネス」の権限ダイアログが表示される
- `CMPedometer.authorizationStatus()` による 4 状態のハンドリング：

| 状態 | UI 挙動 |
|------|---------|
| `.notDetermined` | ダイアログ未表示（`startUpdates` 呼び出しでトリガー） |
| `.authorized` | 計測開始可能 |
| `.denied` | エラーメッセージ「歩数センサーの許可が必要です」を表示し、設定アプリへ誘導ボタンを表示 |
| `.restricted` | エラーメッセージ「この端末では歩数計測が制限されています」を表示（設定アプリへの誘導不要） |

**Info.plist**：
```xml
<key>NSMotionUsageDescription</key>
<string>歩数を計測するために動作センサーを使用します。</string>
```

---

### 2-2. メトロノーム

**基本動作**：
- BPM: **120**（固定、変更不可）
- 音: 短いクリック音（50ms、1200Hz サイン波 + 指数減衰エンベロープ）
- アプリ起動時は **OFF**
- ボタンタップで ON/OFF トグル
- 「とめる」タップ時にメトロノームも自動停止
- 画面オフ・バックグラウンド時も継続再生

**スケジューリング実装方針**：
- `AVAudioPlayerNode.scheduleBuffer(_:at:options:completionHandler:)` + `AVAudioTime` による**サンプル精度の先行スケジューリング**を採用する
- `Timer.scheduledTimer` ベースの実装は禁止（ドリフトが蓄積するため）

```swift
// 採用するパターン
let nextBeatTime = AVAudioTime(sampleTime: ..., atRate: sampleRate)
playerNode.scheduleBuffer(clickBuffer, at: nextBeatTime, options: [], completionHandler: ...)
```

**AVAudioSession 設定**：
- カテゴリ: `.playback`（マナーモードのサイレントスイッチを無視して再生）
- `setCategory(.playback)` + `setActive(true)` はメトロノーム **ON ボタンタップ時**に呼び出す（アプリ起動時ではない）
- マナーモード（サイレントスイッチ ON）でも音が鳴ることを UI 上に明示する

**マナーモード表示**：
- メトロノームボタンの近くに「🔔 マナーモード中も音が鳴ります」を常時表示する

**AVAudioSession 割り込み処理**：
- 電話着信・Siri・他アプリ音声などで割り込みが発生した場合の挙動：
  - 割り込み中（`.began`）: メトロノームは自動停止する
  - 割り込み終了（`.ended`）: 自動再開は**しない**。ユーザーが手動でボタンタップして再開する
- `AVAudioSession.interruptionNotification` を購読し、`.ended` 受信時にメトロノームの状態を OFF に更新する

**Background Audio**：
- Capabilities: `Background Modes → Audio, AirPlay, and Picture in Picture` を有効化

---

### 2-3. セッション管理

**要件**：
- 1日最大 **6セッション**
- 6回に達したら「はじめる」ボタンを非活性化
- 各セッションに保存する情報:

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `slot` | Int | セッション番号（1〜6の連番） |
| `steps` | Int | 歩数（整数） |
| `time` | String | 停止時刻（`HH:MM`、端末ローカル時刻、日本語環境では JST 固定） |
| `startTimestamp` | Double | セッション開始の Unix time（秒精度）。強制終了時の復元用 |
| `stopTimestamp` | Double | セッション停止の Unix time（秒精度） |

- セッション一覧を画面に表示
- 個別削除の確認 UI:

```
通常表示:
  🐾 09:30   150歩   [🗑]

🗑 タップ後（インライン切り替え）:
  🐾 09:30   150歩   [消す] [やめる]

  → [消す] タップ: 削除実行
  → [やめる] タップ: 通常表示に戻る
```

- 削除後は slot を 1 から連番に詰め直す（例: 1,2,3 → 2を削除 → 1,2）
- 日付が変わるとセッションを自動リセット（アプリ起動・フォアグラウンド復帰時に判定）

**異常系・エッジケース**：

| ケース | 挙動 |
|--------|------|
| 計測中に電話着信 | メトロノーム停止。歩数カウントは継続（CMPedometer はコプロセッサ動作）。通話終了後にメトロノームは手動再開 |
| 計測中にアプリ強制終了（または OS によるメモリ終了） | セッションは**保存しない**（中断データは破棄）。アプリ再起動時に一時キー `mogumogu-walk-active-session` が存在した場合は削除してリセットする |
| 計測中に日をまたいだ | **停止時の日付**でセッションを保存する |
| UserDefaults 保存失敗 | エラーメッセージ「記録の保存に失敗しました」を表示。アプリを継続使用可能 |

---

### 2-4. データ永続化

**採用: UserDefaults + Codable**

最小ターゲット iOS 16.0 のため SwiftData（iOS 17 以降）は使用しない。
データ量・構造ともに UserDefaults で十分対応可能。

| 比較 | UserDefaults + Codable | SwiftData |
|------|----------------------|-----------|
| 最小 OS | iOS 16.0 ✅ | iOS 17.0 ❌ |
| 実装コスト | 低（軽量） | 低（@Model マクロ） |
| データ量 | 1日6件・軽量 ✅ | オーバースペック |

**キー**: `mogumogu-walk-training`

**保存形式**：
```json
{
  "date": "2026-05-23",
  "sessions": [
    {
      "slot": 1,
      "steps": 150,
      "time": "09:30",
      "startTimestamp": 1748945400.0,
      "stopTimestamp": 1748945700.0
    }
  ]
}
```

**データマイグレーション**：
- 将来 `Session` 構造に変更が生じた場合はキーをバージョンアップする（例: `mogumogu-walk-training-v2`）
- 旧バージョンのキーが存在する場合は**破棄**（移行処理なし）

---

## 3. 画面仕様

### メイン画面（単一画面）

```
┌─────────────────────────────┐
│                             │
│          150 歩             │  ← 大きな歩数表示（紫、等幅フォント）
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │🐾 はじめる│ │🔕 メトロ  │  │  ← Idle 状態
│  └──────────┘ └──────────┘  │
│  🔔 マナーモード中も音が鳴ります │  ← 常時表示
│                             │
│  ┌──────────────────────┐   │  ← Counting 状態（はじめると切替）
│  │      ⏹ とめる         │   │
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │  🔔 メトロノーム ON   │   │
│  └──────────────────────┘   │
│                             │
│  📋 今日の記録 (2/6)        │
│  ┌─────────────────────────┐ │
│  │ 🐾 09:30   150歩  [🗑]  │ │
│  │ 🐾 10:45   200歩  [🗑]  │ │
│  └─────────────────────────┘ │
└─────────────────────────────┘
```

### 状態遷移（正常系）

```
Idle → [はじめる] → Counting → [とめる] → Idle（保存）
```

### 状態遷移（異常系）

```
Idle → [はじめる] →
  ├─ isStepCountingAvailable() == false → エラー表示（Idle のまま）
  ├─ authorizationStatus == .denied     → 設定アプリ誘導表示（Idle のまま）
  └─ authorizationStatus == .restricted → エラー表示（Idle のまま）

Counting →
  ├─ [電話着信]         → メトロノーム自動停止 → 歩数は継続カウント → 通話終了後 Counting 継続
  └─ [強制終了]         → セッション破棄
```

### UIコンポーネント実装方針

- 歩数表示: `Text("\(steps)").monospacedDigit()` + 大フォント（system font、.largeTitle 以上）
- ボタン: `Button` + `.clipShape(RoundedRectangle(cornerRadius: 20))` + `.fill` スタイル
  - ※ `.cornerRadius()` は iOS 17 で deprecated のため使用禁止
- セッションリスト: `ScrollView + VStack`
- 最小タップ領域: **44×44pt 以上**（Apple HIG 準拠）

**アイコン: SF Symbols を採用**

Apple 提供の SF Symbols（6,000以上のシステムアイコン）をボタン・ラベルに使用する。

```swift
Image(systemName: "figure.walk")   // はじめる
Image(systemName: "stop.fill")     // とめる
Image(systemName: "metronome")     // メトロノーム
Image(systemName: "trash")         // 削除
```

SF Symbols の VoiceOver 読み上げは、システム任せにすると英語のシンボル名になる場合がある。
日本語アプリとして、必ず `accessibilityLabel()` で日本語ラベルを付与する。

```swift
Image(systemName: "figure.walk")
    .accessibilityLabel("歩数計測を開始")

Image(systemName: "metronome")
    .accessibilityLabel("メトロノーム")
```

| 比較 | 絵文字 | SF Symbols（採用） |
|------|--------|-------------------|
| ダークモード対応 | 固定デザイン | 自動対応 ✅ |
| Dynamic Type 連動 | 非対応 | フォントサイズに連動 ✅ |
| VoiceOver ラベル | 手動設定が必要 | `accessibilityLabel()` で日本語ラベルを明示 |

絵文字はラベルテキスト（「📋 今日の記録」等）には引き続き使用可。

### カラースキーム

| 要素 | 色 |
|------|-----|
| 歩数・アクセント | `.purple` |
| はじめるボタン | `.green` |
| とめるボタン | `.red` |
| メトロノームON | `.orange` |
| メトロノームOFF | `.blue` |
| 背景 | `.purple.opacity(0.1)` 相当 |

### iOS 26 Liquid Glass 対応方針

iOS 26（WWDC 2025発表）で導入された **Liquid Glass** デザイン言語への対応:
- **SwiftUI 標準コンポーネントをそのまま使用**し、Liquid Glass を自動適用する
- 子供向けパステルカラー（`.purple`, `.green` 等）は Liquid Glass のカラーティントとして機能するため共存可能
- 明示的な旧スタイル指定（`.buttonStyle(.plain)` 等）は原則使用しない

---

## 4. アーキテクチャ設計方針

**採用パターン: MVVM**

```
View (SwiftUI)
  └─ WalkViewModel (@MainActor, ObservableObject)
       ├─ PedometerService (CMPedometer ラッパー)
       └─ MetronomeService (AVAudioEngine ラッパー)
```

- `WalkViewModel` が CMPedometer・AVAudioEngine を保持し、View は状態を購読するのみ
- ビジネスロジック（歩数カウント・セッション管理・保存）は ViewModel に集約
- View はレンダリングのみを担当

**注意: `@Observable` マクロ（iOS 17+）は使用しない**
- 最小ターゲット iOS 16.0 のため `ObservableObject` + `@Published` を使用する

---

## 5. 非機能要件

| 項目 | 要件 |
|------|------|
| 対応OS | iOS 16.0 以上 |
| 対応デバイス | iPhone（縦持ち固定） |
| 言語 | 日本語のみ |
| ダークモード | 対応（SwiftUI自動対応） |
| Dynamic Type | 対応（SwiftUIデフォルト） |
| VoiceOver | 対応（基本的なラベル付けを行う） |
| 最小タップ領域 | 44×44pt 以上（Apple HIG 準拠） |
| Reduce Motion | アニメーションを使用する場合は `@Environment(\.accessibilityReduceMotion)` で無効化 |
| オフライン | 全機能オフライン動作（ネットワーク不要） |
| プライバシー | 歩数データは端末内のみ保存、外部送信なし |
| 配布 | TestFlight のみ（App Store 公開なし） |

### ハプティクス（触覚フィードバック）

子供向けアプリとして操作の確かさを伝えるためハプティクスを採用する：

| トリガー | フィードバック種別 |
|---------|----------------|
| 「はじめる」「とめる」タップ | `UIImpactFeedbackGenerator(style: .medium).impactOccurred()` |
| セッション保存完了 | `UINotificationFeedbackGenerator().notificationOccurred(.success)` |
| セッション削除確認 | `UIImpactFeedbackGenerator(style: .light).impactOccurred()` |

---

## 6. 技術スタック

| 領域 | 技術 |
|------|------|
| 言語 | **Swift 6.0+** |
| UI フレームワーク | SwiftUI |
| アーキテクチャ | MVVM（ObservableObject + @Published） |
| 歩数カウント | CoreMotion（CMPedometer） |
| 音声 | AVFoundation（AVAudioEngine + AVAudioPlayerNode） |
| データ永続化 | UserDefaults（Codable） |
| 最小ターゲット | iOS 16.0 |
| Xcode | **17.0 以上**（iOS 26 SDK 同梱） |

### Swift 6 Strict Concurrency 対応

Swift 6 ではコンパイラが並行性エラーを厳格にチェックする。以下の対応を必須とする：

- CMPedometer コールバック: `Task { @MainActor in ... }` でメインスレッドに戻す
- AVAudioEngine セットアップ・操作: `@MainActor` 付きの ViewModel メソッドで行う
- `Sendable` 準拠が必要な型には `@unchecked Sendable` または actor isolation を明示する

---

## 7. Info.plist 必須エントリ

```xml
<!-- 歩数センサー利用の説明 -->
<key>NSMotionUsageDescription</key>
<string>歩数を計測するために動作センサーを使用します。</string>

<!-- 画面オフ時もメトロノーム再生を継続するため -->
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>

<!-- 縦持ち固定 -->
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

### Privacy Manifest（PrivacyInfo.xcprivacy）

iOS 17 以降、UserDefaults を使用するアプリは Privacy Manifest の記述が必要。
TestFlight アップロード時に未記載だと警告が出る。

プロジェクトルートに `PrivacyInfo.xcprivacy` を新規作成し、以下を記述する：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
</dict>
</plist>
```

> `CA92.1`: アプリ自身のデータ保存のための UserDefaults 使用（Apple 承認理由コード）

---

## 8. App Icon・Launch Screen

**App Icon**:
- サイズ: 1024×1024px PNG（`AppIcon.appiconset`）
- **絵文字をそのまま App Icon として使用することはできない**（PNG 画像として別途制作が必要）
- デザイン案: 足跡モチーフ（🐾 イメージ）、パステル紫背景。SF Symbols の `figure.walk` を参考にイラスト化する
- 制作方法: Canva・Sketch・Figma 等で PNG を書き出す（または SF Symbols アイコンを画像化）
- 担当: [要記入]

**Launch Screen**:
- `LaunchScreen.storyboard` にてアプリ背景色（薄紫）のみのシンプルなスプラッシュ
- ロゴ・テキスト表示は不要

---

## 9. TestFlight 配布要件

| 項目 | 内容 |
|------|------|
| Bundle ID | `[要記入]`（例: `com.yourname.mogumogu-walk`） |
| Apple Developer Account | [要記入] |
| テスター招待方法 | 家族は内部テスターとして招待することを推奨 |
| What to Test | 歩数カウント・メトロノーム再生・セッション保存・削除の動作確認 |

### 配布種別

家族の iPhone へ配布する場合は、App Store Connect の内部テスターとして招待する方法を推奨する。

| 配布先 | テスター区分 | Apple ベータ審査 | 設定方法 |
|-------|------------|----------------|---------|
| 開発者自身 | 内部テスター | 不要 | App Store Connect の役割を持つため自動 |
| 家族 | **内部テスター（推奨）** | 不要 | App Store Connect → ユーザーとアクセス → 家族の Apple ID を App Manager 等で招待 |
| 友人・外部協力者 | 外部テスター | 初回ビルドのみ必要（1〜2営業日目安） | TestFlight 外部テストグループへメールアドレスで招待 |

> 家族を外部テスターとして追加すると、初回のみ Apple のベータ審査が必要になる。内部テスターとして招待すれば、審査なしでビルド処理完了後すぐ配布できる。

### 家族向け TestFlight 利用フロー

```txt
初回セットアップ:
  1. App Store Connect → ユーザーとアクセス
  2. 家族の Apple ID を App Manager 等の役割で招待
  3. 家族の iPhone に TestFlight アプリをインストール

更新のたび:
  1. Xcode → Product → Archive
  2. Distribute App → App Store Connect → Upload
  3. App Store Connect → TestFlight → 内部テストにビルドを追加
  4. 処理完了後、家族の TestFlight に通知が届く
  5. 家族が TestFlight からインストールまたはアップデート
```

---

## 10. テスト戦略

| テスト種別 | 対象 | ツール |
|-----------|------|--------|
| ユニットテスト | セッション管理（slot 採番・日付リセット・異常系）、データ永続化（Codable encode/decode） | Swift Testing |
| UIテスト | 主要フロー（計測開始→停止→保存→削除） | XCUITest |
| 手動テスト（実機必須） | CMPedometer 歩数精度・バックグラウンド再生・着信割り込み | 実機 iPhone |

slot 採番ロジック（削除後の詰め直し）はバグが混入しやすいためユニットテストを最優先で実装する。

---

## 11. スコープ外（本バージョンでは対応しない）

- HealthKit 連携（歩数データの同期）
- BPM 変更機能
- 複数日の記録閲覧・履歴機能
- ウィジェット
- Apple Watch 対応
- iPad 対応
- 通知・リマインダー
- `AVAudioApplication`（iOS 17+ API）への移行
- `@Observable` マクロ（iOS 17+ API）の使用
- SwiftData（iOS 17+ API）への移行
