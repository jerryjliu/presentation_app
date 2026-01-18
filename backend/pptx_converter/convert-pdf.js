/**
 * PDF Converter - Converts HTML slides to PDF using Puppeteer
 *
 * Usage: node convert-pdf.js <input.json> <output.pdf>
 *
 * This renders each slide as HTML in a headless browser and exports to PDF,
 * giving pixel-perfect output that matches the web preview.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node convert-pdf.js <input.json> <output.pdf>');
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

// Slide dimensions (16:9 aspect ratio)
const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

/**
 * Generate full HTML page for a slide
 */
function generateSlideHtml(slideHtml) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slide-container {
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      overflow: hidden;
    }
    /* Ensure slide content fills container */
    .slide-container > div {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="slide-container">
    ${slideHtml}
  </div>
</body>
</html>
`;
}

async function convertToPdf() {
  const slides = inputData.slides || [];

  if (slides.length === 0) {
    console.error('No slides to convert');
    process.exit(1);
  }

  // Launch browser - use PUPPETEER_EXECUTABLE_PATH if set (for Docker/production)
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();

    // Set viewport to slide dimensions
    await page.setViewport({
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      deviceScaleFactor: 2 // Higher quality
    });

    // Generate PDF with all slides
    const pdfPages = [];

    for (let i = 0; i < slides.length; i++) {
      const slideHtml = generateSlideHtml(slides[i].html);

      // Set content and wait for DOM to be ready (networkidle0 can hang with inline HTML)
      await page.setContent(slideHtml, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Small delay to ensure CSS is fully applied
      await new Promise(resolve => setTimeout(resolve, 100));

      // Take screenshot as PDF page
      const pdfBuffer = await page.pdf({
        width: `${SLIDE_WIDTH}px`,
        height: `${SLIDE_HEIGHT}px`,
        printBackground: true,
        pageRanges: '1'
      });

      pdfPages.push(pdfBuffer);
      console.log(`Rendered slide ${i + 1}/${slides.length}`);
    }

    // For single-page PDFs, just use the buffer directly
    // For multi-page, we need to merge them
    if (pdfPages.length === 1) {
      fs.writeFileSync(outputPath, pdfPages[0]);
    } else {
      // Create a combined HTML with all slides for a single PDF
      const allSlidesHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    @page {
      size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px;
      margin: 0;
    }
    html, body {
      width: ${SLIDE_WIDTH}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .slide {
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      overflow: hidden;
      page-break-after: always;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slide:last-child {
      page-break-after: auto;
    }
    .slide > div {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  ${slides.map(s => `<div class="slide">${s.html}</div>`).join('\n')}
</body>
</html>
`;

      await page.setContent(allSlidesHtml, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const finalPdf = await page.pdf({
        width: `${SLIDE_WIDTH}px`,
        height: `${SLIDE_HEIGHT}px`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      fs.writeFileSync(outputPath, finalPdf);
    }

    console.log(`Created: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

convertToPdf().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
