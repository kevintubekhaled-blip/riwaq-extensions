import { absoluteUrl, SourceUrlError, Source } from "@riwaq/extension-api";

const BASE_URL = "https://kawaiimanga.org";

// دالة لتحليل معرف السلسلة من الرابط
function slugFromUrl(url) {
  const m = new URL(url).pathname.match(/^\/(?:manga|series)\/([^/]+)/);
  if (!m) throw new SourceUrlError(`kawaii: ${url} غير صالح لسلسلة`);
  return decodeURIComponent(m[1]);
}

// دالة لتحليل معرف الفصل من الرابط
function chapterSlugFromUrl(url) {
  const m = new URL(url).pathname.match(/^\/(?:manga|series)\/[^/]+\/read\/([^/]+)/);
  if (!m) throw new SourceUrlError(`kawaii: ${url} غير صالح لفصل`);
  return decodeURIComponent(m[1]);
}

// دالة لجلب تفاصيل السلسلة (قد تحتاج لتعديلها إذا كان الموقع يستخدم API خاص)
// هنا نفترض أننا نستخرج المعلومات من HTML أو نستخدم رابط مباشر إذا وجد
async function fetchMangaInfo(url) {
  const response = await fetch(url);
  const html = await response.text();
  
  // ملاحظة: بما أن الموقع Next.js، المحتوى قد يكون في HTML مباشرة أو يحتاج لاستخراج عبر Regex
  // هذا مثال بسيط لاستخراج العناوين إذا كانت موجودة في الـ HTML
  // قد تحتاج لتعديل هذا الجزء بناءً على عناصر الـ DOM الفعلية في kawaiimanga.org
  
  // مثال: استخراج العنوان من meta tag
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : "غير معروف";
  
  const artistMatch = html.match(/<meta name="author" content="([^"]+)"/); // أو أي meta آخر
  const artist = artistMatch ? artistMatch[1] : "";
  
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const description = descMatch ? descMatch[1] : "";

  return {
    title,
    artist,
    description,
    // قد تحتاج لإضافة fields أخرى مثل genres, status إذا كانت متوفرة
  };
}

// دالة لتحليل الفصول من صفحة السلسلة
function parseChaptersFromList(doc, baseUrl) {
  const chapters = [];
  // افتراض أن الروابط للفصول تحتوي على /read/ أو /chapter/
  // تحتاج لتعديل الـ selector بناءً على هيكل الصفحة الفعلي في kawaiimanga.org
  const links = Array.from(doc.querySelectorAll("a[href*='/read/'], a[href*='/chapter/']"));
  
  for (const link of links) {
    const href = link.getAttribute("href");
    const chapterTitle = link.textContent.trim();
    const chapterUrl = absoluteUrl(href, baseUrl);
    
    // استخراج رقم الفصل من الرابط إذا أمكن، وإلا نستخدم العنوان
    let chapterNumber = chapterTitle.match(/(\d+)/)?.[1];
    
    chapters.push({
      id: chapterUrl, // نستخدم الرابط كمعرف فريد
      title: chapterTitle,
      url: chapterUrl,
      number: chapterNumber || undefined
    });
  }
  return chapters;
}

// دالة تحليل الصور داخل الفصل (نفس الكود السابق مع تحسين بسيط)
function parseChapterContent(doc, chapterUrl) {
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

// تعريف المصدر الرئيسي
const source = new Source({
  name: "Kawaii Manga",
  lang: "ar",
  id: "kawaiimanga",
  version: 1,
  
  // دالة البحث عن السلاسل (تحتاج لتعديلها حسب هيكل صفحة البحث في الموقع)
  async search(query) {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    // هنا تحتاج لتحديد selector للعناصر التي تمثل نتائج البحث
    // مثال: const items = Array.from(doc.querySelectorAll(".manga-card a"));
    // سأضع كود افتراضي:
    const items = Array.from(doc.querySelectorAll("a[href^='/manga/']"));
    
    const mangaList = [];
    for (const item of items) {
      const href = item.getAttribute("href");
      const title = item.querySelector("h2, h3, .title")?.textContent?.trim() || "مجهول";
      const cover = item.querySelector("img")?.getAttribute("src") || "";
      
      mangaList.push({
        id: href,
        title,
        cover: absoluteUrl(cover, BASE_URL),
        url: absoluteUrl(href, BASE_URL),
        artist: "",
        description: ""
      });
    }
    
    return mangaList;
  },

  // دالة جلب تفاصيل السلسلة وقائمة الفصول
  async fetchManga(url) {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    const info = await fetchMangaInfo(url);
    const chapters = parseChaptersFromList(doc, BASE_URL);
    
    return {
      ...info,
      chapters,
      url
    };
  },

  // دالة جلب محتوى الفصل
  async fetchChapter(url) {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    const lines = parseChapterContent(doc, url);
    return lines;
  }
});

export default source;
