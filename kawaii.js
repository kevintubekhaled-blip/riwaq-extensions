import {
  absoluteUrl,
  SourceUrlError,
} from "@riwaq/extension-api";

export const BASE_URL = "https://kawaiimanga.org";

export function slugFromUrl(url) {
  const m = new URL(url).pathname.match(/^\/(?:manga|series|read)\/([^/]+)/);
  if (!m) throw new SourceUrlError(`kawaii: ${url} غير صالح`);
  return decodeURIComponent(m[1]);
}

export function parseChapterLines(doc, chapterUrl) {
  const root = doc.querySelector(".reading-content, .page-break, .rd-manga, .vng-manga, #chapter_images");
  if (!root) {
    throw new Error(`تعذر العثور على حاوية الصور في ${chapterUrl}`);
  }

  const lines = [];
  const images = Array.from(root.querySelectorAll("img"));
  
  for (const img of images) {
    const src = img.getAttribute("data-src") || img.getAttribute("src") || img.getAttribute("data-lazy-src");
    if (src) {
      lines.push({
        type: "image",
        content: absoluteUrl(src.trim(), BASE_URL)
      });
    }
  }

  if (lines.length === 0) {
    throw new Error(`لم يتم العثور على أي صور داخل الفصل في ${chapterUrl}`);
  }

  return lines;
}
