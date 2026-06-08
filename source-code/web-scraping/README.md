# Web Scraper Library

A lightweight TypeScript library for scraping web content, providing easy access to plain text, Markdown, links, and header structures from any URI.

## Features

- **Plain Text Extraction**: Get clean, readable text by stripping out scripts, styles, and excessive whitespace.
- **Markdown Conversion**: Convert HTML content directly into formatted Markdown using `turndown`.
- **Link Extraction**: Retrieve all unique absolute URLs found in anchor (`<a>`) tags.
- **Header Analysis**: Extract text from `<h1>`, `<h2>`, and `<h3>` elements to understand page structure.

## Installation

Ensure you have [Node.js](https://nodejs.org/) installed. Then, install the required dependencies:

```bash
npm install axios cheerio turndown
npm install --save-dev @types/node @types/cheerio @types/turndown typescript ts-node tsx
```

## Usage

You can import the `WebScraper` class into your own TypeScript projects.

```typescript
import { WebScraper } from './web-scraper';

const scraper = new WebScraper();

async function scrape() {
  const url = 'https://example.com';
  
  // 1. Get Plain Text
  const text = await scraper.getPlainText(url);
  console.log('Text:', text);

  // 2. Get Markdown
  const markdown = await scraper.getMarkdown(url);
  console.log('Markdown:', markdown);

  // 3. Get Links
  const links = await scraper.getLinks(url);
  console.log('Links:', links);

  // 4. Get Headers
  const headers = await scraper.getHeaders(url);
  console.log('Headers:', headers);
}

scrape();
```

## Running the Tests

The repository includes a `test-scraper.ts` file to demonstrate and verify the library's functionality. To run the test suite, use `tsx`:

```bash
npx tsx test-scraper.ts
```

## API Reference

### `WebScraper` Class

#### `getPlainText(url: string): Promise<string>`
Fetches the HTML of a URL and returns the text content with scripts/styles removed.

#### `getMarkdown(url: string): Promise<string>`
Fetches the HTML of a URL and converts it to Markdown format.

#### `getLinks(url: string): Promise<string[]>`
Returns an array of unique, absolute URLs found in the page's anchor tags.

#### `getHeaders(url: string): Promise<ScrapedHeaders>`
Returns an object containing arrays of text from all `h1`, `h2`, and `h3` elements.

```typescript
interface ScrapedHeaders {
  h1: string[];
  h2: string[];
  h3: string[];
}
```

## Dependencies

- [axios](https://github.com/axios/axios) - Promise based HTTP client.
- [cheerio](https://cheerio.js.org/) - Implementation of core jQuery designed for the server.
- [turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter.
