/**
 * PPTX Converter - Converts HTML slides to PowerPoint format
 *
 * Usage: node convert.js <input.json> <output.pptx>
 *
 * Input JSON format:
 * {
 *   "title": "Presentation Title",
 *   "slides": [
 *     { "html": "<div>...</div>", "width": 960, "height": 540 }
 *   ],
 *   "theme": { "primaryColor": "#1a73e8", "fontFamily": "Arial" }
 * }
 */

import pptxgen from 'pptxgenjs';
import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node convert.js <input.json> <output.pptx>');
  process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1];

// Read input JSON
let inputData;
try {
  const inputContent = fs.readFileSync(inputPath, 'utf-8');
  inputData = JSON.parse(inputContent);
} catch (error) {
  console.error(`Error reading input file: ${error.message}`);
  process.exit(1);
}

// Create presentation
const pptx = new pptxgen();

// Set presentation properties
pptx.title = inputData.title || 'Untitled Presentation';
pptx.author = 'AI Presentation Generator';
pptx.subject = inputData.title || '';

// Set slide dimensions (default 16:9)
pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
pptx.layout = 'CUSTOM';

// Theme settings
const theme = inputData.theme || {};
const primaryColor = theme.primaryColor || '1a73e8';
const fontFamily = theme.fontFamily || 'Arial';

/**
 * Parse HTML and extract text content with basic styling
 */
function parseHtmlContent(html) {
  const elements = [];

  // Simple regex-based HTML parsing for common elements
  // This handles: h1, h2, h3, p, ul/li, strong, em

  // Extract title (h1)
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    elements.push({
      type: 'title',
      text: stripHtml(h1Match[1]),
      fontSize: 44,
      bold: true
    });
  }

  // Extract subtitles (h2)
  const h2Matches = html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  for (const match of h2Matches) {
    elements.push({
      type: 'subtitle',
      text: stripHtml(match[1]),
      fontSize: 32,
      bold: true
    });
  }

  // Extract h3
  const h3Matches = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi);
  for (const match of h3Matches) {
    elements.push({
      type: 'heading',
      text: stripHtml(match[1]),
      fontSize: 24,
      bold: true
    });
  }

  // Extract paragraphs
  const pMatches = html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of pMatches) {
    elements.push({
      type: 'paragraph',
      text: stripHtml(match[1]),
      fontSize: 18
    });
  }

  // Extract bullet lists
  const ulMatches = html.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
  for (const match of ulMatches) {
    const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    const bullets = [];
    for (const li of liMatches) {
      bullets.push(stripHtml(li[1]));
    }
    if (bullets.length > 0) {
      elements.push({
        type: 'bullets',
        items: bullets,
        fontSize: 18
      });
    }
  }

  // Extract ordered lists
  const olMatches = html.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/gi);
  for (const match of olMatches) {
    const liMatches = match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    const items = [];
    for (const li of liMatches) {
      items.push(stripHtml(li[1]));
    }
    if (items.length > 0) {
      elements.push({
        type: 'numbered',
        items: items,
        fontSize: 18
      });
    }
  }

  return elements;
}

/**
 * Strip HTML tags and decode entities
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extract inline styles from HTML element
 */
function extractStyles(styleAttr) {
  const styles = {};
  if (!styleAttr) return styles;

  const styleString = styleAttr.match(/style="([^"]*)"/i);
  if (!styleString) return styles;

  const declarations = styleString[1].split(';');
  for (const decl of declarations) {
    const [prop, value] = decl.split(':').map(s => s.trim());
    if (prop && value) {
      styles[prop] = value;
    }
  }
  return styles;
}

/**
 * Convert color to pptxgenjs format (without #)
 */
function normalizeColor(color) {
  if (!color) return null;
  return color.replace('#', '');
}

// Process each slide
for (const slideData of inputData.slides || []) {
  const slide = pptx.addSlide();

  // Parse HTML content
  const elements = parseHtmlContent(slideData.html || '');

  let yPosition = 0.5; // Start position in inches

  for (const element of elements) {
    switch (element.type) {
      case 'title':
        slide.addText(element.text, {
          x: 0.5,
          y: yPosition,
          w: 9,
          h: 1,
          fontSize: element.fontSize,
          fontFace: fontFamily,
          bold: true,
          color: normalizeColor(primaryColor),
          align: 'center'
        });
        yPosition += 1.2;
        break;

      case 'subtitle':
        slide.addText(element.text, {
          x: 0.5,
          y: yPosition,
          w: 9,
          h: 0.8,
          fontSize: element.fontSize,
          fontFace: fontFamily,
          bold: true,
          color: '333333'
        });
        yPosition += 0.9;
        break;

      case 'heading':
        slide.addText(element.text, {
          x: 0.5,
          y: yPosition,
          w: 9,
          h: 0.6,
          fontSize: element.fontSize,
          fontFace: fontFamily,
          bold: true,
          color: '444444'
        });
        yPosition += 0.7;
        break;

      case 'paragraph':
        slide.addText(element.text, {
          x: 0.5,
          y: yPosition,
          w: 9,
          h: 0.5,
          fontSize: element.fontSize,
          fontFace: fontFamily,
          color: '555555'
        });
        yPosition += 0.6;
        break;

      case 'bullets':
        const bulletItems = element.items.map(item => ({
          text: item,
          options: { bullet: true, indentLevel: 0 }
        }));
        slide.addText(bulletItems, {
          x: 0.5,
          y: yPosition,
          w: 9,
          h: element.items.length * 0.4,
          fontSize: element.fontSize,
          fontFace: fontFamily,
          color: '555555'
        });
        yPosition += element.items.length * 0.4 + 0.2;
        break;

      case 'numbered':
        const numberedItems = element.items.map((item, idx) => ({
          text: `${idx + 1}. ${item}`,
          options: { indentLevel: 0 }
        }));
        slide.addText(numberedItems, {
          x: 0.5,
          y: yPosition,
          w: 9,
          h: element.items.length * 0.4,
          fontSize: element.fontSize,
          fontFace: fontFamily,
          color: '555555'
        });
        yPosition += element.items.length * 0.4 + 0.2;
        break;
    }
  }
}

// Save presentation
try {
  await pptx.writeFile({ fileName: outputPath });
  console.log(`Successfully created: ${outputPath}`);
} catch (error) {
  console.error(`Error saving presentation: ${error.message}`);
  process.exit(1);
}
