import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

export interface ScrapedHeaders {
  h1: string[];
  h2: string[];
  h3: string[];
}

export class WebScraper {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService();
  }

  /**
   * 1. Get plain text from a URI
   */
  async getPlainText(url: string): Promise<string> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      
      // Remove script and style elements to avoid getting their content as text
      $('script, style, noscript, iframe').remove();
      
      return $.text().replace(/\s\s+/g, ' ').trim();
    } catch (error) {
      throw new Error(`Failed to get plain text from ${url}: ${(error as Error).message}`);
    }
  }

  /**
   * 2. Get Markdown from a URI
   */
  async getMarkdown(url: string): Promise<string> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      
      // Remove script and style elements to avoid getting their content as text
      $('script, style, noscript, iframe').remove();

      return this.turndownService.turndown($.html());
    } catch (error) {
      throw new Error(`Failed to get markdown from ${url}: ${(error as Error).message}`);
    }
  }

  /**
   * 3. Get links from URI
   */
  async getLinks(url: string): Promise<string[]> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);
      const links: string[] = [];

      $('a[href]').each((_, element) => {
        let href = $(element).attr('href');
        if (href) {
          // Handle relative URLs
          try {
            const absoluteUrl = new URL(href, url).toString();
            links.push(absoluteUrl);
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      return [...new Set(links)]; // Return unique links
    } catch (error) {
      throw new Error(`Failed to get links from ${url}: ${(error as Error).message}`);
    }
  }

  /**
   * 4. Get H1, H2, H3 section head text from URI
   */
  async getHeaders(url: string): Promise<ScrapedHeaders> {
    try {
      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const headers: ScrapedHeaders = {
        h1: [],
        h2: [],
        h3: []
      };

      $('h1').each((_, element) => {
        headers.h1.push($(element).text().trim());
      });
      $('h2').each((_, element) => {
        headers.h2.push($(element).text().trim());
      });
      $('h3').each((_, element) => {
        headers.h3.push($(element).text().trim());
      });

      return headers;
    } catch (error) {
      throw new Error(`Failed to get headers from ${url}: ${(error as Error).message}`);
    }
  }
}
