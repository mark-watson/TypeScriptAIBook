import { WebScraper } from './web-scraper';

async function runTest() {
  const scraper = new WebScraper();
  const url = 'https://example.com'; // Using a simple URL for testing

  console.log(`Testing with URL: ${url}\n`);

  try {
    console.log('--- 1. Plain Text ---');
    const text = await scraper.getPlainText(url);
    console.log(text.substring(0, 200) + '...');
    console.log('\n');

    console.log('--- 2. Markdown ---');
    const markdown = await scraper.getMarkdown(url);
    console.log(markdown.substring(0, 200) + '...');
    console.log('\n');

    console.log('--- 3. Links ---');
    const links = await scraper.getLinks(url);
    console.log(`Found ${links.length} links:`);
    console.log(links.slice(0, 5));
    console.log('\n');

    console.log('--- 4. Headers ---');
    const headers = await scraper.getHeaders(url);
    console.log('H1:', headers.h1);
    console.log('H2:', headers.h2);
    console.log('H3:', headers.h3);

  } catch (error) {
    console.error('Error during testing:', error);
  }
}

runTest();
