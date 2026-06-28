import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type CompressionLevel = 'lossless' | 'high' | 'medium' | 'low' | 'advance';

export interface CompressionOptions {
  level: CompressionLevel;
  targetSizeBytes?: number;
  runForEternity?: boolean;
  onProgress?: (attempt: number, bestSize: number, currentAttemptSize: number) => void;
  shouldStop?: () => boolean;
}

// Helper to rasterize the entire PDF and return a Blob
async function rasterizePdf(
  pdf: pdfjsLib.PDFDocumentProxy,
  scale: number,
  quality: number
): Promise<Blob> {
  const numPages = pdf.numPages;

  let doc: jsPDF | null = null;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    
    const originalViewport = page.getViewport({ scale: 1.0 });
    const pdfWidth = originalViewport.width;
    const pdfHeight = originalViewport.height;
    const orientation = pdfWidth > pdfHeight ? 'l' : 'p';
    
    if (i === 1) {
      doc = new jsPDF({
        orientation,
        unit: 'pt',
        format: [pdfWidth, pdfHeight],
        compress: true
      });
    } else if (doc) {
      doc.addPage([pdfWidth, pdfHeight], orientation);
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Canvas context failed");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    const imgData = canvas.toDataURL('image/jpeg', quality);
    doc!.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  }

  return doc!.output('blob');
}

export const compressPdfDocument = async (
  file: File,
  options: CompressionOptions
): Promise<{ url: string; newSize: number }> => {
  const arrayBuffer = await file.arrayBuffer();

  // Lossless option
  if (options.level === 'lossless') {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), newSize: blob.size };
  }

  // Load the PDF once for any lossy mode to prevent arrayBuffer detachment
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
  const pdf = await loadingTask.promise;

  // Preset Lossy options
  if (options.level !== 'advance') {
    let scale = 1.0;
    let quality = 0.5;

    if (options.level === 'high') {
      scale = 1.5;
      quality = 0.8;
    } else if (options.level === 'medium') {
      scale = 1.0;
      quality = 0.5;
    } else if (options.level === 'low') {
      scale = 0.8;
      quality = 0.2;
    }

    const pdfBlob = await rasterizePdf(pdf, scale, quality);
    return { url: URL.createObjectURL(pdfBlob), newSize: pdfBlob.size };
  }

  // Advance Mode: Multi-pass binary search on the full PDF
  // Advance Mode: Multi-pass binary search on the full PDF
  const targetBytes = options.targetSizeBytes || 1024;
  
  let minQ = 0.01;
  let maxQ = 1.0;
  let currentScale = 1.0;
  
  let bestBlob: Blob | null = null;
  let bestIsUnderTarget = false;
  
  let attemptsAfter5PercentError = 0;

  const startTime = Date.now();
  let attempt = 1;

  while (true) {
    const elapsedMs = Date.now() - startTime;
    const tenMinsMs = 10 * 60 * 1000;
    const twoHoursMs = 2 * 60 * 60 * 1000;

    let timeLimitMs = tenMinsMs;
    // If we've reached 10 minutes but haven't even tried 20 times, extend the timeout to 2 hours
    if (elapsedMs >= tenMinsMs && attempt < 20) {
      timeLimitMs = twoHoursMs;
    }

    if (!options.runForEternity && elapsedMs >= timeLimitMs) {
      break;
    }

    // Check if user requested to stop early
    if (options.shouldStop && options.shouldStop()) {
      break;
    }

    const currentQ = (minQ + maxQ) / 2;
    const pdfBlob = await rasterizePdf(pdf, currentScale, currentQ);
    const size = pdfBlob.size;

    if (size <= targetBytes) {
      // It respects the absolute max size
      if (!bestIsUnderTarget || (bestBlob && size > bestBlob.size)) {
        bestBlob = pdfBlob;
        bestIsUnderTarget = true;
      }
      // Since it's under target, we can try to increase quality to get closer to the target
      minQ = currentQ;
    } else {
      // It exceeds target size
      if (!bestIsUnderTarget) {
        // If we haven't found any valid one yet, keep the smallest one we've seen
        if (!bestBlob || size < bestBlob.size) {
          bestBlob = pdfBlob;
        }
      }
      // We must decrease quality to get the size down
      maxQ = currentQ;
    }

    // If the binary search for quality has converged, we must adjust the rendering scale to break the plateau
    if ((maxQ - minQ) < 0.02) {
      if (currentQ >= 0.95) {
        // Converged at MAX quality. Even at 100% JPEG quality, the file is too small.
        // We MUST increase the physical rendering resolution to push the file size up.
        currentScale = Math.min(4.0, currentScale * 1.1); // increase by 10%
        minQ = 0.01; maxQ = 1.0;
      } else if (currentQ <= 0.05) {
        // Converged at MIN quality. Even at 1% JPEG quality, the file is too big.
        // We MUST decrease the physical rendering resolution to force the file size down.
        currentScale = Math.max(0.1, currentScale * 0.9); // decrease by 10%
        minQ = 0.01; maxQ = 1.0;
      } else {
        // It converged in the middle! This means we found the perfect JPEG quality for THIS specific scale.
        // To keep hunting during eternity mode without getting stuck, we deterministically bump the scale up slightly.
        // A slightly higher scale will force the next loop to find a slightly lower JPEG quality, yielding a new permutation.
        currentScale = Math.min(4.0, currentScale * 1.02); // increase by 2%
        minQ = 0.01; maxQ = 1.0;
      }
    }

    // Report progress
    if (options.onProgress) {
      options.onProgress(attempt, bestBlob!.size, size);
    }
    
    // Exact byte match break - overrides all other loops including eternity
    if (bestIsUnderTarget && bestBlob!.size === targetBytes) {
      break;
    }
    
    // Check 5% error early exit condition
    if (bestIsUnderTarget && bestBlob!.size >= targetBytes * 0.95) {
      attemptsAfter5PercentError++;
      if (!options.runForEternity && attemptsAfter5PercentError >= 10) {
        break;
      }
    } else {
      attemptsAfter5PercentError = 0;
    }
    
    // Yield to the event loop so React UI can update the progress
    await new Promise(r => setTimeout(r, 50));
    attempt++;
  }

  if (!bestBlob) {
    throw new Error("Failed to compress.");
  }

  return { 
    url: URL.createObjectURL(bestBlob), 
    newSize: bestBlob.size 
  };
};
