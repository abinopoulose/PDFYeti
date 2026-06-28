import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';

async function createLandscapePdf() {
  const pdfDoc = await PDFDocument.create();
  // Landscape A4 size: [842, 595]
  const page = pdfDoc.addPage([842, 595]);
  page.drawText('This is a landscape page', { x: 50, y: 500, size: 30 });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('landscape_test.pdf', pdfBytes);
  console.log('Created landscape_test.pdf');
}

createLandscapePdf();
