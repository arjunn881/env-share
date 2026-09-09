import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
const sitemap0 = path.join(distDir, 'sitemap-0.xml');
const sitemapXml = path.join(distDir, 'sitemap.xml');

// XSL processing instruction to inject after the XML declaration
const XSL_PI = `<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n`;

/**
 * Injects <?xml-stylesheet?> PI after the <?xml?> declaration if not already present.
 */
function injectXsl(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('xml-stylesheet')) return; // already injected
  // Insert after the first ?>
  const firstPiEnd = content.indexOf('?>');
  if (firstPiEnd !== -1) {
    content = content.slice(0, firstPiEnd + 2) + '\n' + XSL_PI + content.slice(firstPiEnd + 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Injected XSL stylesheet reference into ${path.basename(filePath)}`);
  }
}

if (fs.existsSync(sitemap0)) {
  fs.copyFileSync(sitemap0, sitemapXml);
  console.log('✓ Successfully created dist/sitemap.xml from dist/sitemap-0.xml');
  // Inject XSL into both files
  injectXsl(sitemap0);
  injectXsl(sitemapXml);
} else {
  const sitemapIndex = path.join(distDir, 'sitemap-index.xml');
  if (fs.existsSync(sitemapIndex)) {
    fs.copyFileSync(sitemapIndex, sitemapXml);
    console.log('✓ Successfully created dist/sitemap.xml from dist/sitemap-index.xml');
    injectXsl(sitemapXml);
  }
}
