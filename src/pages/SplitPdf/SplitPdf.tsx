import React, { useState, useRef } from 'react';
import { UploadCloud, X, CheckCircle, FileText, ArrowRight, Split, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { splitPdfDocument, getPdfInfo, parseRanges, type SplitResult, type SplitRange } from '../../utils/pdfProcessor';
import './SplitPdf.css';

export const SplitPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [results, setResults] = useState<SplitResult[]>([]);
  
  const [splitMode, setSplitMode] = useState<'all' | 'custom'>('all');
  const [rangeInput, setRangeInput] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const loadFile = async (selectedFile: File) => {
    setFile(selectedFile);
    try {
      const info = await getPdfInfo(selectedFile);
      setNumPages(info.numPages);
      setValidationError('');
    } catch (error) {
      console.error("Failed to read PDF:", error);
      alert("Failed to read PDF file. It might be corrupted or encrypted.");
      setFile(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        await loadFile(droppedFile);
      } else {
        alert('Please drop a PDF file.');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        await loadFile(selectedFile);
      } else {
        alert('Please select a PDF file.');
      }
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    setValidationError('');

    let ranges: SplitRange[] = [];
    if (splitMode === 'custom') {
      ranges = parseRanges(rangeInput, numPages);
      if (ranges.length === 0) {
        setValidationError("Please enter a valid page range (e.g., 1-3, 5).");
        return;
      }
    }

    setIsSplitting(true);
    try {
      const splitFiles = await splitPdfDocument(file, ranges);
      setResults(splitFiles);
    } catch (error) {
      console.error('Error splitting PDF:', error);
      alert('Failed to split PDF. The file might be corrupted or encrypted.');
    } finally {
      setIsSplitting(false);
    }
  };

  const downloadAll = async () => {
    for (let i = 0; i < results.length; i++) {
      const link = document.createElement('a');
      link.href = results[i].url;
      link.download = results[i].filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Small delay to prevent browser from blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  const handleReset = () => {
    setFile(null);
    setResults([]);
    setNumPages(0);
    setSplitMode('all');
    setRangeInput('');
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="split-page">
      {!file && results.length === 0 && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">Split PDF files</h1>
            <p className="hero-subtitle">
              Separate one page or a whole set for easy conversion into independent PDF files.
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

      {file && results.length === 0 && (
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
              <div className="file-size">{formatBytes(file.size)} • {numPages} pages</div>
            </div>
          </div>

          <div className="compression-options">
            <div className="options-header">
              <Split size={20} />
              <h3>Split Options</h3>
            </div>
            
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="splitMode" 
                  value="all" 
                  checked={splitMode === 'all'} 
                  onChange={() => setSplitMode('all')} 
                />
                <span className="radio-text">Extract all pages (creates {numPages} separate PDF files)</span>
              </label>
              
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="splitMode" 
                  value="custom" 
                  checked={splitMode === 'custom'} 
                  onChange={() => setSplitMode('custom')} 
                />
                <span className="radio-text">Custom page ranges</span>
              </label>
            </div>

            {splitMode === 'custom' && (
              <div className="advance-settings">
                <div className="target-size-group">
                  <label>Enter page ranges (e.g., 1-3, 5, 8-10):</label>
                  <input 
                    type="text" 
                    value={rangeInput} 
                    onChange={(e) => setRangeInput(e.target.value)}
                    className="target-input text-input"
                    placeholder="1-3, 5, 8-10"
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                  <small className="help-text">We will create a separate PDF file for each range you specify.</small>
                  {validationError && (
                    <div className="validation-error">
                      {validationError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="action-bar">
            <button 
              className="btn-primary" 
              onClick={handleSplit}
              disabled={isSplitting}
            >
              {isSplitting ? 'Splitting...' : 'Split PDF'}
              {!isSplitting && <ArrowRight size={20} />}
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="success-container split-success">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF split successfully!</h2>
          <p className="success-subtitle">Created {results.length} independent PDF {results.length === 1 ? 'file' : 'files'}.</p>
          
          <div className="split-results-list">
            {results.map((result, idx) => (
              <div key={idx} className="split-result-item">
                <div className="split-result-info">
                  <FileText size={24} className="split-result-icon" />
                  <span className="split-result-name">{result.filename}</span>
                  <span className="split-result-size">{formatBytes(result.size)}</span>
                </div>
                <a href={result.url} download={result.filename} className="btn-download-small">
                  <Download size={16} />
                  Download
                </a>
              </div>
            ))}
          </div>

          {results.length > 1 && (
            <button className="btn-primary" onClick={downloadAll} style={{ width: '100%', marginBottom: '16px' }}>
              <Download size={20} />
              Download All Files
            </button>
          )}
          
          <button className="btn-secondary" onClick={handleReset} style={{ width: '100%' }}>
            Split another file
          </button>
        </div>
      )}
    </div>
  );
};
