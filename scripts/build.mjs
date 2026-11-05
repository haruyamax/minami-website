import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const articlesDirectory = path.join(root, "articles");
const staticFiles = [
  "index.html",
  "bedbugs.html",
  "stinkbugs.html",
  "wildlife.html",
  "company.html",
  "styles.css",
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function parseArticle(filename, source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filename}: Markdown front matter is required.`);
  }

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`${filename}: Invalid front matter line "${line}".`);
    }
    const key = line.slice(0, separator).trim();
    if (!["title", "date", "category", "excerpt"].includes(key)) {
      throw new Error(`${filename}: Unsupported front matter field "${key}".`);
    }
    metadata[key] = parseScalar(line.slice(separator + 1));
  }

  for (const key of ["title", "date", "category", "excerpt"]) {
    if (!metadata[key]) {
      throw new Error(`${filename}: "${key}" is required in the front matter.`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) || Number.isNaN(Date.parse(metadata.date))) {
    throw new Error(`${filename}: "date" must use YYYY-MM-DD format.`);
  }

  const slug = path.basename(filename, ".md");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${filename}: Use a lowercase, hyphen-separated filename.`);
  }

  return { ...metadata, slug, body: match[2].trim() };
}

function articleCard(article) {
  return `<a class="blog-card" href="/blog/${article.slug}.html">
    <span class="blog-card-meta">${escapeHtml(article.category)} · ${escapeHtml(article.date)}</span>
    <strong>${escapeHtml(article.title)}</strong>
    <span>${escapeHtml(article.excerpt)}</span>
    <b>記事を読む →</b>
  </a>`;
}

function pageShell(title, description, content) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#f7f8f2">
    <title>${escapeHtml(title)}｜駆除クリーン（仮）</title>
    <link rel="stylesheet" href="../styles.css">
  </head>
  <body>
    <div class="preview-notice">
      <strong>初稿プレビュー</strong>
      <span>会社情報・連絡先などは確認後に設定します。公開前にこの表示を削除してください。</span>
    </div>
    <header class="site-header">
      <a class="brand" href="../index.html#top" aria-label="駆除クリーン（仮）トップ">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy"><strong>駆除クリーン</strong><small>害虫・害獣のこと、まずはご相談ください</small></span>
        <span class="draft-tag">仮</span>
      </a>
      <nav class="main-nav" aria-label="メインメニュー">
        <a href="../index.html#services">サービス</a>
        <a href="../index.html#pricing">料金</a>
        <a href="../index.html#flow">ご依頼の流れ</a>
        <a href="../index.html#area">対応エリア</a>
        <a href="/blog/index.html">お知らせ</a>
        <a href="../company.html">会社案内</a>
      </nav>
      <a class="header-cta" href="../index.html#contact">まずは無料で相談 <span aria-hidden="true">→</span></a>
    </header>
    <main>
      <nav class="breadcrumbs" aria-label="パンくずリスト">
        <a href="../index.html">トップ</a><span aria-hidden="true">/</span><a href="/blog/index.html">お知らせ・日記</a><span aria-hidden="true">/</span><span>${escapeHtml(title)}</span>
      </nav>
      ${content}
    </main>
    <footer class="site-footer">
      <div class="footer-main">
        <a class="brand footer-brand" href="../index.html#top">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-copy"><strong>駆除クリーン</strong><small>害虫・害獣のこと、まずはご相談ください</small></span>
          <span class="draft-tag">仮</span>
        </a>
        <p>運営法人・所在地・電話番号・資格等は公開前に確認します。</p>
      </div>
      <div class="footer-bottom">
        <a href="../company.html">会社案内</a>
        <span>© 駆除クリーン（仮）</span>
        <span>このページは公開前の初稿プレビューです。</span>
      </div>
    </footer>
  </body>
</html>`;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const filename of staticFiles) {
  await cp(path.join(root, filename), path.join(output, filename));
}

const filenames = (await readdir(articlesDirectory))
  .filter((filename) => filename.endsWith(".md") && filename.toLowerCase() !== "readme.md")
  .sort();
const articles = [];
for (const filename of filenames) {
  const source = await readFile(path.join(articlesDirectory, filename), "utf8");
  articles.push(parseArticle(filename, source));
}
articles.sort((left, right) => right.date.localeCompare(left.date));

const generatedCards = articles.length
  ? `${articles.slice(0, 3).map(articleCard).join("\n")}
    <a class="blog-archive-link" href="/blog/index.html">記事一覧を見る →</a>`
  : `<div class="updates-empty">
      <span class="updates-icon" aria-hidden="true">✳</span>
      <p><strong>記事を準備中です</strong><br>実際のお知らせを掲載するまで、口コミや施工事例は表示しません。</p>
      <small>記事を追加すると、ここに最新記事が表示されます。</small>
      <a class="blog-archive-link" href="/blog/index.html">お知らせ・日記を見る →</a>
    </div>`;

const homepagePath = path.join(output, "index.html");
const homepage = await readFile(homepagePath, "utf8");
const marker = /<!-- BLOG_POSTS_START -->[\s\S]*?<!-- BLOG_POSTS_END -->/;
if (!marker.test(homepage)) {
  throw new Error("index.html is missing the blog post markers.");
}
await writeFile(
  homepagePath,
  homepage.replace(marker, `<!-- BLOG_POSTS_START -->\n${generatedCards}\n          <!-- BLOG_POSTS_END -->`),
);

const blogDirectory = path.join(output, "blog");
await mkdir(blogDirectory, { recursive: true });
const archiveCards = articles.length
  ? articles.map(articleCard).join("\n")
  : `<div class="updates-empty"><span class="updates-icon" aria-hidden="true">✳</span><p><strong>記事を準備中です</strong><br>記事を公開すると、このページに表示されます。</p></div>`;
const archiveContent = `<section class="blog-index">
    <p class="eyebrow">UPDATES & DIARY</p>
    <h1>お知らせ・日記</h1>
    <p>会社からのお知らせや、許可を得て匿名化した作業事例を掲載します。</p>
    <div class="blog-grid">${archiveCards}</div>
  </section>`;
await writeFile(
  path.join(blogDirectory, "index.html"),
  pageShell("お知らせ・日記", "駆除クリーン（仮）のお知らせ・日記", archiveContent),
);

for (const article of articles) {
  const markdownHtml = sanitizeHtml(await marked.parse(article.body));
  const articleContent = `<article class="blog-article">
    <header>
      <p class="blog-card-meta">${escapeHtml(article.category)} · ${escapeHtml(article.date)}</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="blog-article-excerpt">${escapeHtml(article.excerpt)}</p>
    </header>
    <div class="blog-article-body">${markdownHtml}</div>
    <a class="text-link" href="/blog/index.html">記事一覧へ戻る <span aria-hidden="true">→</span></a>
  </article>`;
  await writeFile(
    path.join(blogDirectory, `${article.slug}.html`),
    pageShell(article.title, article.excerpt, articleContent),
  );
}

console.log(`Built ${staticFiles.length} static pages and ${articles.length} blog posts into dist/.`);
