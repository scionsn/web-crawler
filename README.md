# 🕸️ E-Commerce Product URL Crawler

This project is a scalable and stealthy web crawler designed to extract product page URLs from e-commerce websites. It is built using `puppeteer-extra`, the Stealth plugin (to evade bot detection), and supports crawling multiple domains concurrently with customizable crawling logic.

---

## 🧠 How It Works

The crawler uses a **breadth-first search (BFS)** approach to traverse all internal pages of an e-commerce website starting from a given domain URL. For each visited page, it attempts to extract all internal links and identify which ones are **product pages** using a custom filtering function (`isProductUrl`).

### 🔍 Crawling Strategy

1. **Start with a domain URL** from the config.
2. **Launch a stealth Puppeteer browser** instance to avoid detection.
3. **Queue internal links** and iterate over them while maintaining a set of visited URLs.
4. For each page:
   - Visit the URL with `page.goto()`
   - Detect and handle **lazy loading** by scrolling the page.
   - Detect and click **"Load More"** buttons (if present) using CSS selectors and innerText matching.
   - Extract all anchor tags (`<a href="...">`) from the DOM.
   - Filter links using a custom `isProductUrl` function.
5. Output:
   - A list of unique product URLs.
   - A list of URLs that failed to load for debugging.

---

## 🔧 Configuration

Configuration is handled via a JavaScript object. To add or update sites, modify the domainsConfig array in the config file. Each entry can contain:

domainUrl: The base URL to start crawling from (required).

loadButtonClassName: CSS class of the "Load More" button (optional).

loadButtonInnerText: Inner text of the "Load More" button for confirmation (optional).

---

## 📂 Output

After crawling completes, results are saved into:

- `output/product-links.json` — Map of domains to found product URLs.
- `output/failed-urls.json` — Map of domains to URLs that failed during crawling.

---

## 🚀 Usage

1. **Install dependencies**

```bash
npm install
```

2. **Run the crawler**

```bash
npm run crawl
```

3. **View output**

Check the `output/` folder for saved product URLs and any failed links.

---

## 🛠 Dependencies
- `Node v20`
- `puppeteer-extra` with Stealth Plugin
- `p-limit` for concurrent crawling
- `config` for environment management
- `fs` and `path` for output handling

---

## ⚠️ Notes

- Crawling heavily depends on each website's structure. Custom selectors (like load button classes and text) may need to be adjusted per domain.

