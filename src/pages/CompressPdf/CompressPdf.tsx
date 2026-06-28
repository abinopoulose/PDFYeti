import React, { useState, useRef, useEffect } from 'react';
import { FileDown, UploadCloud, X, CheckCircle, FileText, ArrowRight, Settings } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { compressPdfDocument, type CompressionLevel, type CompressionOptions } from '../../utils/pdfProcessor';
import './CompressPdf.css';

export const CompressPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedPdfUrl, setCompressedPdfUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [analyzingPage, setAnalyzingPage] = useState<number>(0);
  const [totalAnalyzePages, setTotalAnalyzePages] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Compression Options State
  const [level, setLevel] = useState<CompressionLevel>('lossless');

  // Advanced Options State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contentType, setContentType] = useState<"Text/Vectors" | "Color Images" | "Scanned B&W Documents">("Color Images");
  const [algorithm, setAlgorithm] = useState<string>("JPEG");
  const [aggressiveness, setAggressiveness] = useState<number>(50);
  const [actualFinalSize, setActualFinalSize] = useState<number | null>(null);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const currentRunRef = useRef<{ stop: boolean }>({ stop: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      currentRunRef.current.stop = true;
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, []);

  const triggerEstimation = (ct: string, _alg: string, agg: number) => {
    if (!file) return;
    
    setIsCompressing(true);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    
    debounceTimeout.current = setTimeout(async () => {
      // Cancel any ongoing background compression pass
      currentRunRef.current.stop = true;
      const myRun = { stop: false };
      currentRunRef.current = myRun;

      try {
        // Calculate a target size based on aggressiveness (1 to 100)
        // 1 = Original size, 100 = 1024 bytes (1 KB)
        const targetSize = Math.floor(file.size - ((agg - 1) / 99) * (file.size - 1024));

        const options: CompressionOptions = {
          level: 'advance',
          targetSizeBytes: targetSize,
          forceRasterize: ct === 'Text/Vectors' || ct === 'Scanned B&W Documents' || agg > 75,
          dpi: Math.max(10, 144 - agg),
          shouldStop: () => myRun.stop
        };

        const { newSize } = await compressPdfDocument(file, options);

        if (!myRun.stop) {
          setActualFinalSize(newSize);
          setIsCompressing(false);
        }
      } catch (error) {
        console.error('Background compression failed:', error);
        if (!myRun.stop) {
          setIsCompressing(false);
        }
      }
    }, 500);
  };

  const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as any;
    setContentType(newType);
    
    let newAlgorithm = "JPEG";
    if (newType === "Text/Vectors") newAlgorithm = "Flate";
    else if (newType === "Color Images") newAlgorithm = "JPEG";
    else if (newType === "Scanned B&W Documents") newAlgorithm = "JBIG2";
    
    setAlgorithm(newAlgorithm);
    triggerEstimation(newType, newAlgorithm, aggressiveness);
  };

  const getAlgorithmOptions = () => {
    switch (contentType) {
      case "Text/Vectors": return ["Flate", "LZW"];
      case "Color Images": return ["JPEG", "JPEG2000"];
      case "Scanned B&W Documents": return ["JBIG2", "CCITT Group 4"];
      default: return [];
    }
  };

  const initFileState = (newFile: File) => {
    setFile(newFile);
    setOriginalSize(newFile.size);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        initFileState(droppedFile);
      } else {
        alert('Please drop a PDF file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        initFileState(selectedFile);
      } else {
        alert('Please select a PDF file.');
      }
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    
    setIsProcessingPdf(true);
    setAnalyzingPage(0);
    setTotalAnalyzePages(0);
    setWarningMessage(null);

    const targetSize = Math.floor(file.size - ((aggressiveness - 1) / 99) * (file.size - 1024));

    const options: CompressionOptions = showAdvanced ? {
      level: 'advance',
      targetSizeBytes: targetSize,
      forceRasterize: contentType === 'Text/Vectors' || contentType === 'Scanned B&W Documents' || aggressiveness > 75,
      dpi: Math.max(10, 144 - aggressiveness),
      onAnalyzeProgress: (current, total) => {
        setAnalyzingPage(current);
        setTotalAnalyzePages(total);
      }
    } : {
      level,
      onAnalyzeProgress: (current, total) => {
        setAnalyzingPage(current);
        setTotalAnalyzePages(total);
      }
    };

    try {
      const { url, newSize, warning } = await compressPdfDocument(file, options);
      if (warning) setWarningMessage(warning);
      setCompressedSize(newSize);
      setCompressedPdfUrl(url);
    } catch (error) {
      console.error('Error compressing PDF:', error);
      alert('Failed to compress PDF. Please try another file.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handleReset = () => {
    currentRunRef.current.stop = true;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    
    setFile(null);
    setCompressedPdfUrl(null);
    setOriginalSize(0);
    setCompressedSize(0);
    setLevel('lossless');
    setAnalyzingPage(0);
    setTotalAnalyzePages(0);
    setWarningMessage(null);
    setShowAdvanced(false);
    setContentType("Color Images");
    setAlgorithm("JPEG");
    setAggressiveness(50);
    setActualFinalSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="compress-page">
      {!file && !isProcessingPdf && !compressedPdfUrl && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">Compress PDF file</h1>
            <p className="hero-subtitle">
              Reduce file size while optimizing for maximal PDF quality.
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
            <button className="upload-button">
              Select PDF file
            </button>
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

      {file && !isProcessingPdf && !compressedPdfUrl && (
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
              <h3>Compression Level</h3>
            </div>
            
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="level" 
                  value="lossless" 
                  checked={level === 'lossless'} 
                  onChange={() => setLevel('lossless')} 
                />
                <span className="radio-text">Lossless Maximum (Metadata cleaning only)</span>
              </label>
              
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="level" 
                  value="high" 
                  checked={level === 'high'} 
                  onChange={() => setLevel('high')} 
                />
                <span className="radio-text">High (Good quality, less compression)</span>
              </label>
              
              <label className="radio-label">
                <input 
                  type="radio" 
                  name="level" 
                  value="medium" 
                  checked={level === 'medium'} 
                  onChange={() => setLevel('medium')} 
                />
                <span className="radio-text">Medium (Balanced)</span>
              </label>

              <label className="radio-label">
                <input 
                  type="radio" 
                  name="level" 
                  value="low" 
                  checked={level === 'low'} 
                  onChange={() => setLevel('low')} 
                />
                <span className="radio-text">Low (Lower quality, high compression)</span>
              </label>
            </div>

            {/* Advanced Options Toggle */}
            <div className="advanced-toggle" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
              </button>
            </div>

            {/* Advanced Options Content */}
            {showAdvanced && (
              <div className="advanced-options-content" style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: '16px', color: 'var(--text-color)' }}>Advanced Settings</h4>
                
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-color)' }}>Content Type</label>
                  <select 
                    value={contentType} 
                    onChange={handleContentTypeChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                  >
                    <option value="Text/Vectors">Text/Vectors</option>
                    <option value="Color Images">Color Images</option>
                    <option value="Scanned B&W Documents">Scanned B&W Documents</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-color)' }}>Algorithm</label>
                  <select 
                    value={algorithm} 
                    onChange={(e) => {
                      setAlgorithm(e.target.value);
                      triggerEstimation(contentType, e.target.value, aggressiveness);
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                  >
                    {getAlgorithmOptions().map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 500, color: 'var(--text-color)' }}>
                    <span>Aggressiveness</span>
                    <span style={{ color: 'var(--primary-color)' }}>{aggressiveness}</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={aggressiveness}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setAggressiveness(val);
                      triggerEstimation(contentType, algorithm, val);
                    }}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                <div className="estimation-result" style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
                  {isCompressing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary-color)' }}>
                      <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                      <span style={{ fontWeight: 500 }}>Calculating exact size...</span>
                    </div>
                  ) : actualFinalSize !== null ? (
                    <div style={{ fontWeight: 500, color: 'var(--text-color)' }}>
                      Actual Final Size: <span style={{ color: 'var(--primary-color)', fontSize: '1.1em', marginLeft: '8px' }}>{formatBytes(actualFinalSize)}</span>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      Adjust settings to calculate exact size.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="action-bar">
            <button className="btn-primary" onClick={handleCompress}>
              Compress PDF
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {isProcessingPdf && (
        <div className="loading-container">
          <div className="spinner"></div>
          <h2 className="loading-text">
            {totalAnalyzePages > 0 && analyzingPage < totalAnalyzePages
              ? `Analyzing page ${analyzingPage} of ${totalAnalyzePages}...`
              : 'Compressing PDF...'}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Working entirely offline in your browser.</p>
        </div>
      )}

      {compressedPdfUrl && (
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF has been compressed!</h2>
          
          {warningMessage && (
            <div className="warning-banner" style={{ background: '#fef3c7', color: '#92400e', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #fcd34d', fontSize: '14px', lineHeight: '1.5' }}>
              {warningMessage}
            </div>
          )}
          
          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">Original Size</span>
              <span className="stat-value">{formatBytes(originalSize)}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">New Size</span>
              <span className="stat-value highlight">{formatBytes(compressedSize)}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Saved</span>
              <span className="stat-value">
                {Math.floor(((originalSize - compressedSize) / originalSize) * 100)}%
              </span>
            </div>
          </div>

          <a 
            href={compressedPdfUrl} 
            download={`compressed_${file?.name}`}
            className="btn-download"
          >
            <FileDown size={24} />
            Download compressed PDF
          </a>
          
          <button className="btn-secondary" onClick={handleReset}>
            Compress another file
          </button>
        </div>
      )}
    </div>
  );
};
