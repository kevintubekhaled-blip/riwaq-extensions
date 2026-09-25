import { absoluteUrl, SourceUrlError } from "@riwaq/extension-api";

export const BASE_URL = "https://kawaiimanga.org";

// ── معلومات المصدر ──────────────────────────────────────────
export const source = {
  id: 1001,
  name: "Kawaii Manga",
  lang: "ar",
  baseUrl: BASE_URL,

  // ── قائمة المانجا الشعبية ──────────────────────────────
  async getPopularManga(page = 1) {
    const url = `${BASE_URL}/manga/?page=${page}&order=popular`;
    const doc = await this.fetchDocument(url);
    return parseMangaList(doc, BASE_URL);
  },

  // ── قائمة المانجا الأحدث ──────────────────────────────
  async getLatestUpdates(page = 1) {
    const url = `${BASE_URL}/manga/?page=${page}&order=update`;
    const doc = await this.fetchDocument(url);
    return parseMangaList(doc, BASE_URL);
  },

  // ── البحث ─────────────────────────────────────────────
  async searchManga(query, page = 1) {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&page=${page}`;
    const doc = await this.fetchDocument(url);
    return parseMangaList(doc, BASE_URL);
  },

  // ── تفاصيل المانجا ────────────────────────────────────
  async getMangaDetails(mangaUrl) {
    const doc = await this.fetchDocument(mangaUrl);

    const title =
      doc.querySelector(".post-title h1, .manga-title")?.textContent?.trim() ?? "";
    const cover =
      doc.querySelector(".summary_image img")?.getAttribute("src") ?? "";
    const description =
      doc.querySelector(".summary__content p, .description-summary p")?.textContent?.trim() ?? "";
    const status =
      doc.querySelector(".post-status .summary-content")?.textContent?.trim() ?? "";
    const genres = Array.from(
      doc.querySelectorAll(".genres-content a")
    ).map((a) => a.textContent.trim());

    return { title, cover: absoluteUrl(cover, BASE_URL), description, status, genres };
  },

  // ── قائمة الفصول ──────────────────────────────────────
  async getChapterList(mangaUrl) {
    const doc = await this.fetchDocument(mangaUrl);
    const items = doc.querySelectorAll(".wp-manga-chapter, .chapter-li");
    const chapters = [];

    for (const item of items) {
      const a = item.querySelector("a");
      if (!a) continue;
      chapters.push({
        name: a.textContent.trim(),
        url: a.href,
        date: item.querySelector(".chapter-release-date")?.textContent?.trim() ?? "",
      });
    }
    return chapters;
  },

  // ── صفحات الفصل ───────────────────────────────────────
  async getPageList(chapterUrl) {
    const doc = await this.fetchDocument(chapterUrl);
    return parseChapterLines(doc, chapterUrl);
  },
};

// ── دوال مساعدة ─────────────────────────────────────────────

function parseMangaList(doc, baseUrl) {
  const items = doc.querySelectorAll(".manga-item, .c-tabs-item__content, .page-item-detail");
  const list = [];

  for (const item of items) {
    const a = item.querySelector("a");
    const img = item.querySelector("img");
    if (!a) continue;

    list.push({
      title: a.getAttribute("title") ?? a.textContent.trim(),
      url: a.href,
      cover: absoluteUrl(
        img?.getAttribute("data-src") ?? img?.getAttribute("src") ?? "",
        baseUrl
      ),
    });
  }
  return list;
}

export function slugFromUrl(url) {
  const m = new URL(url).pathname.match(/^\/(?:manga|series|read)\/([^/]+)/);
  if (!m) throw new SourceUrlError(`kawaii: ${url} غير صالح`);
  return decodeURIComponent(m[1]);
}

export function parseChapterLines(doc, chapterUrl) {
  const root = doc.querySelector(
    ".reading-content, .page-break, .rd-manga, .vng-manga, #chapter_images"
  );
  if (!root) throw new Error(`تعذر العثور على حاوية الصور في ${chapterUrl}`);

  const lines = [];
  for (const img of root.querySelectorAll("img")) {
    const src =
      img.getAttribute("data-src") ??
      img.getAttribute("src") ??
      img.getAttribute("data-lazy-src");
    if (src) lines.push({ type: "image", content: absoluteUrl(src.trim(), BASE_URL) });
  }

  if (lines.length === 0)
    throw new Error(`لم يتم العثور على أي صور داخل الفصل في ${chapterUrl}`);

  return lines;
}
