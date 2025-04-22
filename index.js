import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import config from "config";
import { isProductUrl, normalizeUrl } from "./utils/index.js";

const {
  domainsConfig,
  outputDir,
  maxScrollAttempts,
  concurrencyLimit,
  productFileName,
  failedUrlsFileName,
} = config;
const limit = pLimit(concurrencyLimit); // Control concurrent headless browser instances
puppeteer.use(StealthPlugin());

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

async function crawlSite(domainInfo) {
  const { domainName, loadButtonClassName, loadButtonInnerText } = domainInfo;
  const browser = await puppeteer.launch({
    headless: false
  });

  const page = await browser.newPage();
  const visited = new Set();
  const queue = [domainName];
  const productUrls = new Set();
  const failedUrls = new Set(); // URLs that failed during crawling
  console.log(`\n[Crawling Started] ${domainName}`);

  while (queue.length > 0) {// BFS
    const url = normalizeUrl(queue.shift());

    if (visited.has(url)) continue;

    visited.add(url);
    console.log(`[Visiting] ${url}`);

    try {
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
      const isLazyLoading = await page.evaluate(() => {
        return (
          !!document.querySelector('img[loading="lazy"]') ||
          !!document.querySelector("[data-lazy]")
        );
      });

      if (isLazyLoading) {
        console.log("[Lazy Loading Detected] Scrolling to load more content.");
        await scrollToLoadMore(page); // Function to handle lazy loading
      }

      // if lazy loading is not detected, check for a button
      // Check if a "Load More" button exists
      if (loadButtonClassName) {
        const loadMoreButton = await page.$(loadButtonClassName); // Update selector as needed
        if (loadMoreButton) {
          console.log("[Load More Button Detected] Clicking to load more content.");
          await clickLoadMoreButton(
            page,
            loadButtonClassName,
            loadButtonInnerText
          ); // Click the button to load more
        }
      }
      
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]"), (a) => a.href)
      );

      console.log(`[Found Links] ${links.length} links on ${url}`);

      for (const link of links) {
        console.log(link);
        const normalizedlink = normalizeUrl(link); // Normalize before using

        if (isProductUrl(normalizedlink)) {
          productUrls.add(normalizedlink);
        } else if (!visited.has(normalizedlink)) {
          if (link.startsWith(domainName)) {
            queue.push(normalizedlink); // avoid pushing external links
          }
        }
      }
    } catch (err) {
      console.error(`Failed to crawl ${url}: ${err.message}`);
      failedUrls.add(url);
    }
  }

  await browser.close();
  console.log(
    `[Crawling Finished] ${domainName} — ${productUrls.size} product URLs found`
  );

  return {
    domainName,
    productUrls: Array.from(productUrls),
    failedUrls: Array.from(failedUrls),
  };
}

// Scroll function for lazy loading pages
async function scrollToLoadMore(page) {
  let previousHeight;
  try {
    previousHeight = await page.evaluate("document.body.scrollHeight");
    let scrollCount = 0;
    while (scrollCount++ < maxScrollAttempts) {
      console.log(`[Crawler] Scroll #${scrollCount}, scrolling to bottom...`);
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for new content
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) break; // If no new content, stop scrolling
      previousHeight = newHeight;
    }
    if (scrollCount >= maxScrollAttempts) {
      console.warn(`Reached max scroll attempts! `);
    }
  } catch (error) {
    console.error("Error during scroll-to-load-more: ", error);
  }
}

// Click the "Load More" button for pages with manual loading
async function clickLoadMoreButton(page, selector, loadButtonInnerText) {
  try {
    let clickCount = 0;

    while (clickCount++ < maxScrollAttempts) {
      const button = await page.$(selector);
      if (!button) {
        console.log(`[Click Load More] No button found, stopping.`);
        break;
      }

      // Get the button's current inner text
      const buttonInnerText = await page.evaluate(
        (button) => button.innerText,
        button
      );

      // If the button's text has changed, break the loop
      if (buttonInnerText !== loadButtonInnerText) {
        console.log(`[Click Load More] Button text changed, stopping.`);
        break;
      }

      const isVisible = await button.isIntersectingViewport();
      if (!isVisible) {
        console.log(
          `[Click Load More] Button not in viewport, scrolling into view.`
        );
        await button.evaluate((b) =>
          b.scrollIntoView({ behavior: "smooth", block: "center" })
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for new content
      }

      console.log(`[Click Load More] Clicking button #${clickCount}`);
      await button.click();
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for new content
    }
    if (clickCount >= maxScrollAttempts) {
      console.warn(`Reached max scroll attempts! `);
    }
  } catch (error) {
    console.error("Error while clicking 'Load More' button: ", error);
  }
}

(async () => {
  const results = await Promise.allSettled(
    domainsConfig.map((domainInfo) =>
      limit(async () => {
        const { domainName, productUrls, failedUrls } = await crawlSite(
          domainInfo
        );
        return { domainName, productUrls, failedUrls };
      })
    )
  );
  const output = {};
  const failedUrlsOutput = {};

  results.forEach((result, index) => {
    const { domainName, productUrls, failedUrls } = result.value;

    if (result.status === "fulfilled") {
      output[domainName] = productUrls;
      failedUrlsOutput[domainName] = failedUrls;
    } else {
      const error = result.reason?.message || result.reason;
      console.error(`\n==  ${domainName} failed:`, error);
      output[domainName] = [];
      failedUrlsOutput[domainName] = [`Failed to crawl: ${error}`];
    }
  });
  fs.writeFileSync(
    path.join(outputDir, productFileName),
    JSON.stringify(output, null, 2)
  );
  console.log(`\nProduct links saved to ${productFileName}`);
  fs.writeFileSync(
    path.join(outputDir, failedUrlsFileName),
    JSON.stringify(failedUrlsOutput, null, 2)
  );
  console.log(`\n Failed URLs saved to ${failedUrlsFileName}`);
})();
