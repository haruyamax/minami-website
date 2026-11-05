# 駆除クリーン（仮）サイト

静的HTMLサイトです。ブログ記事は `articles/` のMarkdownからビルドし、GitHubへの更新をCloudflare Pagesで公開する構成です。

## ローカルでビルド

```powershell
npm install
npm run build
python -m http.server 8080 --directory dist
```

ブラウザーで `http://localhost:8080` を開きます。ブログ記事の書式は [articles/README.md](./articles/README.md) を参照してください。

## Cloudflare Pages

GitHubリポジトリをCloudflare Pagesに接続し、次の設定を使います。

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22` 以上

Markdown記事やサイト内容をGitHubへ反映すると、自動ビルド・公開されます。独自ドメインは後から設定できます。

`preview/` の確認用ページは公開ビルドに含まれません。

## 公開前の確認

このサイトは初稿プレビューです。仮の屋号、法人名、所在地、代表者、電話番号、LINEリンク、資格・許可、価格適用範囲、再訪問条件などを実情報で確認し、プレビュー表示を削除してから公開してください。
