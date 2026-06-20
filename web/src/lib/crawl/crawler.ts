import { chromium } from "playwright";
import { normalizeUrl, isSameSite, isCrawlable } from "./url";
import type { CrawledPage } from "./csv";

export interface CrawlProgress {
  done: number;
  found: number;
  url: string;
}

export interface CrawlOptions {
  startUrl: string;
  maxPages?: number;
  onProgress?: (p: CrawlProgress) => void;
}

const CONCURRENCY = 4;
const NAV_TIMEOUT = 20_000;

export async function crawlSite(opts: CrawlOptions): Promise<CrawledPage[]> {
  const { startUrl, maxPages = 200, onProgress } = opts;

  const normalizedStart = normalizeUrl(startUrl);
  if (!normalizedStart) throw new Error(`URL inválida: ${startUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "CannibalScan-Crawler/1.0 (+https://github.com/cannibal-scan)",
    javaScriptEnabled: true,
  });

  const visited = new Set<string>();
  const queue: string[] = [normalizedStart];
  const results: CrawledPage[] = [];

  visited.add(normalizedStart);

  try {
    while (queue.length > 0 && results.length < maxPages) {
      // Take up to CONCURRENCY URLs from the queue
      const batch = queue.splice(0, CONCURRENCY);

      await Promise.all(
        batch.map(async (url) => {
          if (results.length >= maxPages) return;

          const page = await context.newPage();
          try {
            // Try networkidle first, fall back to domcontentloaded on timeout
            try {
              await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
            } catch {
              await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
            }

            // Check Content-Type — skip non-HTML responses
            const contentType = await page.evaluate(() => {
              const meta = document.querySelector('meta[http-equiv="Content-Type"]');
              return meta?.getAttribute("content") ?? document.contentType ?? "";
            });
            if (contentType && !contentType.includes("html")) return;

            const extracted = await page.evaluate(() => {
              const title = document.title?.trim() ?? "";
              const h1El = document.querySelector("h1");
              const h1 = h1El?.innerText?.trim() ?? "";
              const metaDesc =
                document.querySelector('meta[name="description"]')?.getAttribute("content") ??
                document.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
                "";
              const rawText = document.body?.innerText ?? "";
              // Collapse whitespace while preserving newlines for readability
              const content = rawText.replace(/[^\S\n]+/g, " ").trim();

              const links: string[] = [];
              document.querySelectorAll("a[href]").forEach((a) => {
                const href = (a as HTMLAnchorElement).href;
                if (href) links.push(href);
              });

              return { title, h1, meta: metaDesc.trim(), content, links };
            });

            results.push({
              url,
              title: extracted.title,
              h1: extracted.h1,
              meta: extracted.meta,
              content: extracted.content,
            });

            // Enqueue new links from the same site
            for (const href of extracted.links) {
              const normalized = normalizeUrl(href, url);
              if (
                normalized &&
                !visited.has(normalized) &&
                isSameSite(normalizedStart, normalized) &&
                isCrawlable(normalized)
              ) {
                visited.add(normalized);
                queue.push(normalized);
              }
            }

            onProgress?.({
              done: results.length,
              found: visited.size,
              url,
            });
          } catch {
            // Skip pages that fail — don't crash the whole crawl
          } finally {
            await page.close();
          }
        })
      );
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}
