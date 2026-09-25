import { absoluteUrl, SourceUrlError, Source } from "@riwaq/extension-api";

const BASE_URL = "https://kawaiimanga.org";

// دالة لتحليل معرف السلسلة
function getSlug(url) {
  const match = new URL(url).pathname.match(/^\/(?:manga|series)\/([^/]+)/);
  if (!match) throw new SourceUrlError(`Riwaq: Invalid URL: ${url}`);
  return decodeURIComponent(match[1]);
}

// دالة لتحليل معرف الفصل
function getChapterId(url) {
  const match = new URL(url).pathname.match(/^\/(?:manga|series)\/[^/]+\/read\/([^/]+)/);
  if (!match) throw new SourceUrlError(`Riwaq: Invalid Chapter URL: ${url}`);
  return decodeURIComponent(match[1]);
}

// دالة جلب تفاصيل السلسلة من الصفحة
async function getMangaInfoFromHtml(url) {
  const response = await fetch(url);
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // محاولة استخراج البيانات من Meta Tags
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');

  return {
    title: ogTitle || "Unknown",
    description: ogDesc || "",
    artist: "", // يمكن إضافته إذا وجد
    cover: ogImage ? absoluteUrl(ogImage, BASE_URL) : "",
    url
  };
}

// دالة استخراج قائمة الفصول من صفحة السلسلة
function getChaptersFromHtml(doc, baseUrl) {
  const chapters = [];
  // ابحث عن روابط تحتوي على /read/ أو /chapter/
  const links = Array.from(doc.querySelectorAll("a[href*='/read/'], a[href*='/chapter/']"));
  
  // نستخدم Set لتجنب التكرار
  const seen = new Set();

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href || seen.has(href)) continue;
    
    seen.add(href);
    const fullUrl = absoluteUrl(href, baseUrl);
    const title = link.textContent.trim() || "Chapter";
    
    // محاولة استخراج رقم الفصل
    const numMatch = title.match(/(\d+)/);
    
    chapters.push({
      id: fullUrl,
      title: title,
      url: fullUrl,
      number: numMatch ? parseInt(numMatch[1]) : undefined
    });
  }

  // ترتيب الفصول (الأحدث أولاً عادة)
  return chapters.reverse();
}

// دالة تحليل صور الفصل
function parseImagesFromHtml(doc) {
  const images = [];
  // محاولة العثور على الحاوية الصحيحة
  const container = doc.querySelector(".reading-content, #chapter_images, .page-break, .rd-manga, .vng-manga");
  
  if (!container) {
    // إذا لم نجد الحاوية، نبحث عن جميع الصور في الصفحة كحل بديل
    const allImgs = doc.querySelectorAll("img");
    for (const img of allImgs) {
      const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src");
      if (src) {
        images.push({
          type: "image",
          content: absoluteUrl(src.trim(), BASE_URL)
        });
      }
    }
  } else {
    const imgs = container.querySelectorAll("img");
    for (const img of imgs) {
      const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src");
      if (src) {
        images.push({
          type: "image",
          content: absoluteUrl(src.trim(), BASE_URL)
        });
      }
    }
  }

  if (images.length === 0) {
    throw new Error(`Riwaq: No images found in chapter.`);
  }

  return images;
}

// تعريف المصدر الرئيسي
const source = new Source({
  name: "Kawaii Manga",
  lang: "ar",
  id: "kawaiimanga",
  version: 1,

  // البحث عن سلاسل
  async search(query) {
    // ملاحظة: يجب تعديل هذا الجزء بناءً على رابط بحث الموقع الفعلي
    // غالباً ما يكون: https://kawaiimanga.org/search?q=QUERY
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const results = [];
    // تعديل selector حسب هيكل صفحة البحث في الموقع
    const items = Array.from(doc.querySelectorAll("a[href^='/manga/'], a[href^='/series/']"));
    
    for (const item of items) {
      const href = item.getAttribute("href");
      const title = item.querySelector("h2, h3, .title, .name")?.textContent?.trim() || "Unknown";
      const img = item.querySelector("img")?.getAttribute("src");
      
      results.push({
        id: href,
        title,
        cover: img ? absoluteUrl(img, BASE_URL) : "",
        url: absoluteUrl(href, BASE_URL),
        artist: "",
        description: ""
      });
    }
    return results;
  },

  // جلب تفاصيل السلسلة
  async fetchManga(url) {
    const info = await getMangaInfoFromHtml(url);
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    const chapters = getChaptersFromHtml(doc, BASE_URL);
    
    return {
      ...info,
      chapters,
      url
    };
  },

  // جلب محتوى الفصل
  async fetchChapter(url) {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    const images = parseImagesFromHtml(doc);
    return images;
  }
});

export default source;
