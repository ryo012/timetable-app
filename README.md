# 時間割マネージャー

小学校の時間割管理アプリです。GitHub Pages（フロント）+ Google Apps Script（バックエンドAPI）のハイブリッド構成で動作します。

## セットアップ手順

### 1. GAS（バックエンド）の設定

1. Google スプレッドシートを開き、**拡張機能 → Apps Script** を開く
2. `Code.gs` の内容をコピーして貼り付ける
3. **デプロイ → 新しいデプロイ** をクリック
4. 種類：**ウェブアプリ**
5. アクセス：**全員**（匿名を含む）を選択
6. デプロイして表示される**ウェブアプリURL**をコピーする

### 2. フロントエンド（index.html）の設定

`index.html` の以下の行にコピーしたURLを貼り付ける：

```javascript
const GAS_URL = 'ここにGASのウェブアプリURLを貼り付け';
```

### 3. GitHub Pages の有効化

1. このリポジトリを GitHub にプッシュ
2. リポジトリの **Settings → Pages**
3. Source: **Deploy from a branch** → `main` ブランチの `/ (root)` を選択
4. 数分後に `https://[ユーザー名].github.io/[リポジトリ名]/` で公開される

## ファイル構成

```
.
├── index.html   # フロントエンド（React + Tailwind CSS）
├── Code.gs      # GAS バックエンドコード（スプレッドシートのApps Scriptに貼り付ける）
└── README.md
```

## データ保存先

Google スプレッドシートの `Database` シートに自動保存されます。GASが初回起動時に自動作成します。
