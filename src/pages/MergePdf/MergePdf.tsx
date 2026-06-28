import React, { useState, useRef } from 'react';
import { FileDown, UploadCloud, X, CheckCircle, FileText, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { mergePdfDocuments } from '../../utils/pdfProcessor';
import './MergePdf.css';

interface PdfFile {
  id: string;
  file: File;
}

export const MergePdf: React.FC = () => {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [mergedSize, setMergedSize] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length > 0) {
      setFiles(prev => [
        ...prev,
        ...pdfFiles.map(file => ({ id: Math.random().toString(36).substr(2, 9), file }))
      ]);
    } else {
      alert('Please select valid PDF files.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    // reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newFiles = [...files];
    const temp = newFiles[index - 1];
    newFiles[index - 1] = newFiles[index];
    newFiles[index] = temp;
    setFiles(newFiles);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    const temp = newFiles[index + 1];
    newFiles[index + 1] = newFiles[index];
    newFiles[index] = temp;
    setFiles(newFiles);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }

    setIsMerging(true);
    try {
      const { url, size } = await mergePdfDocuments(files.map(f => f.file));
      setMergedPdfUrl(url);
      setMergedSize(size);
    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert('Failed to merge PDFs. One of the files might be corrupted or encrypted.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setMergedPdfUrl(null);
    setMergedSize(0);
  };

  const handleMergeMore = () => {
    setMergedPdfUrl(null);
    setMergedSize(0);
  };

  return (
    <div className="merge-page">
      {!mergedPdfUrl && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">Merge PDF files</h1>
            <p className="hero-subtitle">
              Combine PDFs in the order you want with the easiest PDF merger available.
            </p>
          </div>

          <div 
            className={`upload-container ${isDragging ? 'drag-active' : ''} ${files.length > 0 ? 'compact' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => files.length === 0 && fileInputRef.current?.click()}
          >
            <UploadCloud size={files.length > 0 ? 32 : 64} className="upload-icon" />
            <button className="upload-button" onClick={(e) => {
              if (files.length > 0) {
                e.stopPropagation();
                fileInputRef.current?.click();
              }
            }}>
              {files.length > 0 ? 'Add more files' : 'Select PDF files'}
            </button>
            {files.length === 0 && <p className="upload-text">or drop PDFs here</p>}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="application/pdf" 
              multiple
              className="file-input"
            />
          </div>

          {files.length > 0 && (
            <div className="workspace">
              <div className="files-list">
                {files.map((fileObj, index) => (
                  <div key={fileObj.id} className="file-list-item">
                    <div className="file-order-controls">
                      <button className="order-btn" onClick={() => moveUp(index)} disabled={index === 0} title="Move Up">
                        <ChevronUp size={20} />
                      </button>
                      <button className="order-btn" onClick={() => moveDown(index)} disabled={index === files.length - 1} title="Move Down">
                        <ChevronDown size={20} />
                      </button>
                    </div>
                    <div className="file-icon-wrapper">
                      <FileText size={32} color="var(--primary-color)" />
                    </div>
                    <div className="file-info">
                      <div className="file-name">{fileObj.file.name}</div>
                      <div className="file-size">{formatBytes(fileObj.file.size)}</div>
                    </div>
                    <button className="file-remove-list" onClick={() => removeFile(fileObj.id)} title="Remove file">
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="action-bar">
                <button 
                  className="btn-primary" 
                  onClick={handleMerge}
                  disabled={isMerging || files.length < 2}
                >
                  {isMerging ? 'Merging...' : 'Merge PDF'}
                  {!isMerging && <ArrowRight size={20} />}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mergedPdfUrl && (
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDFs have been merged!</h2>
          
          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">Combined Size</span>
              <span className="stat-value highlight">{formatBytes(mergedSize)}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Files Merged</span>
              <span className="stat-value">{files.length}</span>
            </div>
          </div>

          <a 
            href={mergedPdfUrl} 
            download="merged_document.pdf"
            className="btn-download"
          >
            <FileDown size={24} />
            Download merged PDF
          </a>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button className="btn-secondary" onClick={handleMergeMore}>
              Back to files
            </button>
            <button className="btn-secondary" onClick={handleReset}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
