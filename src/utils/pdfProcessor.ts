import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { jsPDF } from 'jspdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type CompressionLevel = 'lossless' | 'high' | 'medium' | 'low' | 'advance';

export interface CompressionOptions {
  level: CompressionLevel;
  targetSizeBytes?: number;
  runForEternity?: boolean;
  forceRasterize?: boolean;
  dpi?: number;
  onProgress?: (attempt: number, bestSize: number, currentAttemptSize: number) => void;
  onAnalyzeProgress?: (currentPage: number, totalPages: number) => void;
  shouldStop?: () => boolean;
}


// Helper to rasterize the entire PDF and return a Blob
async function rasterizePdf(
  pdf: pdfjsLib.PDFDocumentProxy,
  scale: number,
  quality: number,
  onAnalyzeProgress?: (current: number, total: number) => void,
  shouldStop?: () => boolean
): Promise<Blob> {
  const numPages = pdf.numPages;
  let doc: jsPDF | null = null;

  for (let i = 1; i <= numPages; i++) {
    if (shouldStop && shouldStop()) throw new Error("Aborted by user");
    if (onAnalyzeProgress) onAnalyzeProgress(i, numPages);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: context, viewport, canvas } as any).promise;

    const imgData = canvas.toDataURL('image/jpeg', quality);
    doc!.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    
    if (i % 2 === 0) await new Promise(r => setTimeout(r, 10));
  }

  return doc!.output('blob');
}

// Targeted Downsampling of Embedded Images
async function downsamplePdfImages(pdfDoc: PDFDocument, quality: number, scale: number) {
  const context = pdfDoc.context;
  const indirectObjects = context.enumerateIndirectObjects();

  for (const [, pdfObject] of indirectObjects) {
    if (!(pdfObject instanceof PDFRawStream)) continue;
    
    const dict = pdfObject.dict;
    const subtype = dict.lookup(PDFName.of('Subtype'));
    
    if (subtype === PDFName.of('Image')) {
      const filter = dict.lookup(PDFName.of('Filter'));
      
      let isJpeg = false;
      if (filter === PDFName.of('DCTDecode')) {
        isJpeg = true;
      } else if (filter && typeof filter === 'object' && 'array' in filter) {
        const arr = (filter as any).array;
        if (arr.length > 0 && arr[0] === PDFName.of('DCTDecode')) {
          isJpeg = true;
        }
      }

      // We ONLY target JPEGs for browser-side structural re-compression
      if (isJpeg) {
        try {
          const imageBytes = pdfObject.contents;
          const blob = new Blob([imageBytes], { type: 'image/jpeg' });
          const imgUrl = URL.createObjectURL(blob);
          
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
          });
          
          const newWidth = Math.max(1, Math.floor(img.width * scale));
          const newHeight = Math.max(1, Math.floor(img.height * scale));
          
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const base64Data = dataUrl.split(',')[1];
            const binaryStr = atob(base64Data);
            const compressedBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              compressedBytes[i] = binaryStr.charCodeAt(i);
            }
            
            pdfObject.contents = compressedBytes;
            dict.set(PDFName.of('Length'), context.obj(compressedBytes.length));
            dict.set(PDFName.of('Width'), context.obj(newWidth));
            dict.set(PDFName.of('Height'), context.obj(newHeight));
            dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
          }
          
          URL.revokeObjectURL(imgUrl);
        } catch (e) {
          console.warn("Failed to downsample image stream", e);
        }
      }
    }
  }
}

export const compressPdfDocument = async (
  file: File,
  options: CompressionOptions
): Promise<{ url: string; newSize: number; warning?: string }> => {
  const arrayBuffer = await file.arrayBuffer();

  // Lossless option
  if (options.level === 'lossless') {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), newSize: blob.size };
  }

  // Fake analysis progress so the UI loader still runs gracefully
  if (options.onAnalyzeProgress) {
      options.onAnalyzeProgress(1, 1);
  }

  // Preset Lossy options
  if (options.level !== 'advance') {
    let scale = 1.0;
    let quality = 0.5;

    if (options.level === 'high') {
      scale = 0.5;
      quality = 0.3;
    } else if (options.level === 'medium') {
      scale = 0.8;
      quality = 0.6;
    } else if (options.level === 'low') {
      scale = 1.0;
      quality = 0.8;
    }

    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('PDFYeti');
    pdfDoc.setCreator('PDFYeti');
    
    const pages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach(p => pdfDoc.addPage(p));
    
    await downsamplePdfImages(pdfDoc, quality, scale);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), newSize: blob.size };
  }

  // Advance Mode: Deterministic single-pass compression
  const targetBytes = options.targetSizeBytes || 1024;
  const ratio = Math.max(0.01, Math.min(1.0, targetBytes / file.size));
  
  // Scale and quality map linearly to the ratio
  const currentScale = Math.max(0.05, 0.1 + (ratio * 0.9));
  const currentQ = Math.max(0.1, 0.1 + (ratio * 0.7));
  
  let pdfjsDoc: any = null;
  if (options.forceRasterize) {
    pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  }
  
  let bestBlob: Blob | null = null;
  let warningMessage: string | undefined = undefined;

  try {
    if (options.forceRasterize && pdfjsDoc) {
      // High-DPI Rasterizer Path
      const baseScale = (options.dpi || 144) / 72;
      bestBlob = await rasterizePdf(pdfjsDoc, baseScale * currentScale, currentQ, options.onAnalyzeProgress, options.shouldStop);
    } else {
      // Structural Vector Path
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const loopDoc = await PDFDocument.create();
      loopDoc.setTitle('');
      loopDoc.setAuthor('');
      loopDoc.setSubject('');
      loopDoc.setKeywords([]);
      
      const pages = await loopDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach(p => loopDoc.addPage(p));
      
      await downsamplePdfImages(loopDoc, currentQ, currentScale);
      const loopBytes = await loopDoc.save({ useObjectStreams: true });
      bestBlob = new Blob([loopBytes as any], { type: 'application/pdf' });
    }
  } catch (e: any) {
    if (e.message === "Aborted by user") {
      throw e; // Bubble it up to the caller so they know it was aborted
    }
    warningMessage = "An internal error occurred during the compression pass. We've safely returned the original file.";
  }

  if (!bestBlob) {
    return { url: URL.createObjectURL(file), newSize: file.size, warning: warningMessage };
  }

  return { 
    url: URL.createObjectURL(bestBlob), 
    newSize: bestBlob.size,
    warning: warningMessage
  };
}

export const mergePdfDocuments = async (files: File[]): Promise<{ url: string; size: number }> => {
  if (files.length === 0) throw new Error("No files to merge");
  
  const mergedPdf = await PDFDocument.create();
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  const pdfBytes = await mergedPdf.save();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), size: blob.size };
};

export interface SplitRange {
  start: number;
  end: number;
}

export interface SplitResult {
  url: string;
  size: number;
  filename: string;
}

export const getPdfInfo = async (file: File): Promise<{ numPages: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
  const pdf = await loadingTask.promise;
  return { numPages: pdf.numPages };
};

export const parseRanges = (rangeStr: string, maxPages: number): SplitRange[] => {
  if (!rangeStr.trim()) return [];
  const parts = rangeStr.split(',').map(s => s.trim());
  const ranges: SplitRange[] = [];
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end && start > 0) {
        ranges.push({ start, end: Math.min(end, maxPages) });
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page > 0) {
        ranges.push({ start: page, end: Math.min(page, maxPages) });
      }
    }
  }
  return ranges;
};

export const splitPdfDocument = async (file: File, ranges: SplitRange[]): Promise<SplitResult[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const totalPages = sourcePdf.getPageCount();

  const results: SplitResult[] = [];
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  if (ranges.length === 0) {
    for (let i = 0; i < totalPages; i++) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
      newPdf.addPage(copiedPage);
      const pdfBytes = await newPdf.save();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      results.push({
        url: URL.createObjectURL(blob),
        size: blob.size,
        filename: `${baseName}_page_${i + 1}.pdf`
      });
    }
  } else {
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const startIdx = Math.max(0, range.start - 1);
      const endIdx = Math.min(totalPages - 1, range.end - 1);

      if (startIdx > endIdx || startIdx >= totalPages) continue;

      const newPdf = await PDFDocument.create();
      const indicesToCopy = Array.from({ length: endIdx - startIdx + 1 }, (_, k) => startIdx + k);
      const copiedPages = await newPdf.copyPages(sourcePdf, indicesToCopy);
      copiedPages.forEach(page => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      
      const rangeStr = startIdx === endIdx ? `${startIdx + 1}` : `${startIdx + 1}-${endIdx + 1}`;
      results.push({
        url: URL.createObjectURL(blob),
        size: blob.size,
        filename: `${baseName}_pages_${rangeStr}.pdf`
      });
    }
  }

  return results;
};

export interface JpgResult {
  url: string;
  blob: Blob;
  size: number;
  filename: string;
  width: number;
  height: number;
}

export const convertPdfToJpgs = async (
  file: File, 
  quality: number = 0.9, 
  scale: number = 2.0
): Promise<JpgResult[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    pdf = await loadingTask.promise;
  } catch (err) {
    if ((err as Error).name === 'PasswordException') {
      throw new Error('PASSWORD_PROTECTED', { cause: err });
    }
    throw new Error('CORRUPTED_OR_UNSUPPORTED', { cause: err });
  }

  const numPages = pdf.numPages;
  if (numPages > 50) {
    throw new Error(`TOO_MANY_PAGES:${numPages}`);
  }

  const results: JpgResult[] = [];
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Canvas context failed");

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: context, viewport, canvas } as any).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error("Blob conversion failed");

    results.push({
      url: URL.createObjectURL(blob),
      blob,
      size: blob.size,
      filename: `${baseName}_page_${i}.jpg`,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return results;
};

export const convertJpgsToPdf = async (files: File[]): Promise<{ url: string; size: number }> => {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    let image;
    try {
      image = await pdfDoc.embedJpg(arrayBuffer);
    } catch (err) {
      throw new Error(`CORRUPTED_IMAGE:${file.name}`, { cause: err });
    }

    const { width, height } = image.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), size: blob.size };
};

export const protectPdfDocument = async (file: File, password: string): Promise<{ url: string; size: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    await loadingTask.promise;
  } catch (err) {
    if ((err as Error).name === 'PasswordException') {
      throw new Error('ALREADY_PROTECTED', { cause: err });
    }
    throw new Error('CORRUPTED_OR_UNSUPPORTED', { cause: err });
  }

  const pdfBytes = new Uint8Array(arrayBuffer);
  
  const encryptedBytes = await encryptPDF(pdfBytes, password, {
    algorithm: 'AES-256'
  });

  const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), size: blob.size };
};

export const checkIsPdfProtected = async (file: File): Promise<boolean> => {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    await loadingTask.promise;
    return false; // Not protected
  } catch (err) {
    if ((err as Error).name === 'PasswordException') {
      return true; // Protected
    }
    throw new Error('CORRUPTED_OR_UNSUPPORTED', { cause: err });
  }
};

export const unlockPdfDocument = async (file: File, password: string): Promise<{ url: string; size: number }> => {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    // Attempt to load and decrypt with pdf-lib
    const pdfDoc = await PDFDocument.load(arrayBuffer, { 
      password: password,
      ignoreEncryption: false 
    });
    
    // Save it (this strips encryption)
    const pdfBytes = await pdfDoc.save();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    return { url: URL.createObjectURL(blob), size: blob.size };
  } catch (err) {
    const errorMsg = (err as Error).message || '';
    if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('encrypted')) {
      throw new Error('INCORRECT_PASSWORD', { cause: err });
    }
    throw new Error('CORRUPTED_OR_UNSUPPORTED', { cause: err });
  }
};
