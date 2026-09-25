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
