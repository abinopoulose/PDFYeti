import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, CheckCircle, FileText, ArrowRight, Download, Settings } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { convertPdfToJpgs, type JpgResult } from '../../utils/pdfProcessor';
import JSZip from 'jszip';
import './PdfToJpg.css';

export const PdfToJpg: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [results, setResults] = useState<JpgResult[]>([]);
  
  const [quality, setQuality] = useState<number>(0.9);
  const [scale, setScale] = useState<number>(2.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const loadFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert("Please upload a valid PDF document.");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert("This file exceeds the maximum allowed size of 50MB. Please choose a smaller file.");
      return;
    }
    setFile(selectedFile);
  };

  useEffect(() => {
    return () => {
      // Clean up object URLs on unmount or when results change to prevent memory leaks
      results.forEach(res => URL.revokeObjectURL(res.url));
    };
  }, [results]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        loadFile(droppedFile);
      } else {
        alert('Please drop a PDF file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        loadFile(selectedFile);
      } else {
        alert('Please select a PDF file.');
      }
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    try {
      const jpgFiles = await convertPdfToJpgs(file, quality, scale);
      setResults(jpgFiles);
    } catch (err) {
      const error = err as Error;
      console.error('Error converting PDF:', error);
      if (error.message === 'PASSWORD_PROTECTED') {
        alert("This PDF is password protected. Please unlock it before converting.");
      } else if (error.message && error.message.startsWith('TOO_MANY_PAGES:')) {
        const pages = error.message.split(':')[1];
        alert(`This PDF has too many pages (${pages}). The maximum allowed is 50 pages to prevent browser crashing.`);
      } else if (error.message === 'CORRUPTED_OR_UNSUPPORTED') {
        alert("We couldn't read this PDF. The file might be corrupted or in an unsupported format.");
      } else {
        alert("An error occurred while converting the PDF. Please try again.");
      }
    } finally {
      setIsConverting(false);
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    results.forEach((res) => {
      zip.file(res.filename, res.blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `${file?.name.replace(/\.[^/.]+$/, "")}_images.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(zipUrl);
  };

  const handleReset = () => {
    setFile(null);
    setResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="pdf-to-jpg-page">
      {!file && results.length === 0 && !isConverting && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">PDF to JPG</h1>
            <p className="hero-subtitle">
              Convert each PDF page into a high-quality JPG image directly in your browser.
            </p>
          </div>

          <div 
            className={`upload-container ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={64} className="upload-icon" />
            <button className="upload-button">Select PDF file</button>
            <p className="upload-text">or drop PDF here</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="application/pdf" 
              className="file-input"
            />
          </div>
        </>
      )}

      {file && results.length === 0 && !isConverting && (
        <div className="workspace">
          <div className="file-card">
            <button className="file-remove" onClick={handleReset} title="Remove file">
              <X size={18} />
            </button>
            <div className="file-icon-wrapper">
              <FileText size={40} color="var(--primary-color)" />
            </div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{formatBytes(file.size)}</div>
            </div>
          </div>

          <div className="compression-options">
            <div className="options-header">
              <Settings size={20} />
              <h3>Conversion Settings</h3>
            </div>
            
            <div className="radio-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
                Image Quality ({(quality * 100).toFixed(0)}%)
                <input 
                  type="range" 
                  min="0.1" 
                  max="1.0" 
                  step="0.1" 
                  value={quality} 
                  onChange={(e) => setQuality(parseFloat(e.target.value))} 
                  style={{ width: '100%', accentColor: 'var(--primary-color)' }}
                />
              </label>
            </div>
            <div className="radio-group">
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
                Resolution Scale ({scale.toFixed(1)}x)
                <input 
                  type="range" 
                  min="1.0" 
                  max="4.0" 
                  step="0.5" 
                  value={scale} 
                  onChange={(e) => setScale(parseFloat(e.target.value))} 
                  style={{ width: '100%', accentColor: 'var(--primary-color)' }}
                />
                <small className="help-text">Higher scale produces sharper images but takes longer to process.</small>
              </label>
            </div>
          </div>

          <div className="action-bar">
            <button 
              className="btn-primary" 
              onClick={handleConvert}
              disabled={isConverting}
            >
              Convert to JPG
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {isConverting && (
        <div className="loading-container">
          <div className="spinner"></div>
          <div className="loading-text">Converting pages to JPG...</div>
          <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Working entirely offline in your browser.</p>
        </div>
      )}

      {results.length > 0 && !isConverting && (
        <div className="success-container split-success" style={{ maxWidth: '800px', width: '100%' }}>
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF converted successfully!</h2>
          <p className="success-subtitle">Extracted {results.length} high-quality {results.length === 1 ? 'image' : 'images'}.</p>
          
          <div className="image-preview-grid">
            {results.map((result, idx) => (
              <div key={idx} className="image-preview-card">
                <div className="image-preview-img-wrapper">
                  <img src={result.url} alt={result.filename} loading="lazy" />
                </div>
                <div className="image-preview-info">
                  <span className="image-preview-name">{result.filename}</span>
                  <span className="image-preview-size">{formatBytes(result.size)} • {result.width}x{result.height}</span>
                </div>
                <a href={result.url} download={result.filename} className="btn-download-small">
                  <Download size={16} />
                  Download
                </a>
              </div>
            ))}
          </div>

          <div className="action-row" style={{ display: 'flex', gap: '16px', width: '100%', marginTop: '24px' }}>
            {results.length > 1 && (
              <button className="btn-primary" onClick={downloadZip} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Download size={20} />
                Download All as ZIP
              </button>
            )}
            
            <button className="btn-secondary" onClick={handleReset} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              Convert another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
