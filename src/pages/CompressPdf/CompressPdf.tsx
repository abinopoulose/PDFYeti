import React, { useState, useRef, useEffect } from 'react';
import { FileDown, UploadCloud, X, CheckCircle, FileText, ArrowRight, Settings, StopCircle } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { compressPdfDocument, type CompressionLevel, type CompressionOptions } from '../../utils/pdfProcessor';
import './CompressPdf.css';

export const CompressPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedPdfUrl, setCompressedPdfUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);

  // Compression Options State
  const [level, setLevel] = useState<CompressionLevel>('lossless');
  const [targetSize, setTargetSize] = useState<string>('');
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB' | 'GB'>('MB');
  const [runForEternity, setRunForEternity] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const [activeTargetBytes, setActiveTargetBytes] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Advance Mode Progress State
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [currentBestSize, setCurrentBestSize] = useState<number>(0);
  const [currentAttemptSize, setCurrentAttemptSize] = useState<number>(0);
  const shouldStopRef = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      if (file.size >= 1024 * 1024 * 1024) {
        setTargetUnit('GB');
      } else if (file.size >= 1024 * 1024) {
        setTargetUnit('MB');
      } else {
        setTargetUnit('KB');
      }
      setTargetSize('');
      setValidationError('');
    }
  }, [file]);

  useEffect(() => {
    let interval: any;
    if (isCompressing && level === 'advance') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isCompressing, level]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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
        setFile(droppedFile);
        setOriginalSize(droppedFile.size);
      } else {
        alert('Please drop a PDF file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setOriginalSize(selectedFile.size);
      } else {
        alert('Please select a PDF file.');
      }
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setValidationError('');
    
    let targetSizeBytes: number | undefined;

    if (level === 'advance') {
      const parsedTargetSize = parseFloat(targetSize);
      if (isNaN(parsedTargetSize) || parsedTargetSize <= 0) {
        setValidationError("Please enter a valid target size.");
        return;
      }
      
      let multiplier = 1;
      if (targetUnit === 'KB') multiplier = 1024;
      if (targetUnit === 'MB') multiplier = 1024 * 1024;
      if (targetUnit === 'GB') multiplier = 1024 * 1024 * 1024;
      
      targetSizeBytes = parsedTargetSize * multiplier;

      if (targetSizeBytes >= file.size) {
        setValidationError("Target size must be strictly less than the original file size.");
        return;
      }
      
      if (targetSizeBytes <= 1024) {
        setValidationError("Target size must be larger than 1 KB.");
        return;
      }
      
      setActiveTargetBytes(targetSizeBytes);
    }

    setIsCompressing(true);
    shouldStopRef.current = false;
    setAttemptCount(0);
    setCurrentBestSize(0);
    setCurrentAttemptSize(0);

    const options: CompressionOptions = {
      level,
      targetSizeBytes,
      runForEternity,
      onProgress: (attempt, bestSize, currentSize) => {
        setAttemptCount(attempt);
        setCurrentBestSize(bestSize);
        setCurrentAttemptSize(currentSize);
      },
      shouldStop: () => shouldStopRef.current
    };

    try {
      const { url, newSize } = await compressPdfDocument(file, options);
      setCompressedSize(newSize);
      setCompressedPdfUrl(url);
    } catch (error) {
      console.error('Error compressing PDF:', error);
      alert('Failed to compress PDF. Please try another file.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleStop = () => {
    shouldStopRef.current = true;
  };

  const handleReset = () => {
    setFile(null);
    setCompressedPdfUrl(null);
    setOriginalSize(0);
    setCompressedSize(0);
    setLevel('lossless');
    setRunForEternity(false);
    setValidationError('');
    setAttemptCount(0);
    setCurrentBestSize(0);
    setCurrentAttemptSize(0);
    setElapsedTime(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const availableUnits: ('KB' | 'MB' | 'GB')[] = [];
  if (file) {
    if (file.size >= 1024 * 1024 * 1024) availableUnits.push('GB', 'MB', 'KB');
    else if (file.size >= 1024 * 1024) availableUnits.push('MB', 'KB');
    else availableUnits.push('KB');
  }

  return (
    <div className="compress-page">
      {!file && !isCompressing && !compressedPdfUrl && (
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

      {file && !isCompressing && !compressedPdfUrl && (
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

              <label className="radio-label">
                <input 
                  type="radio" 
                  name="level" 
                  value="advance" 
                  checked={level === 'advance'} 
                  onChange={() => setLevel('advance')} 
                />
                <span className="radio-text">Advance (Exact Max Target Size)</span>
              </label>
            </div>

            {level === 'advance' && (
              <div className="advance-settings">
                <div className="target-size-group">
                  <label>Absolute Max Target Size:</label>
                  <div className="target-input-row">
                    <input 
                      type="number" 
                      min="0.002"
                      step="0.1"
                      value={targetSize} 
                      onChange={(e) => setTargetSize(e.target.value)}
                      className="target-input"
                    />
                    <select 
                      className="unit-select"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value as any)}
                    >
                      {availableUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <small className="help-text">We will run multiple compression passes to get as close as possible to this strict maximum size limit without exceeding it.</small>
                  {validationError && (
                    <div className="validation-error">
                      {validationError}
                    </div>
                  )}
                </div>
                
                <label className="checkbox-label" style={{ marginTop: '16px' }}>
                  <input 
                    type="checkbox" 
                    checked={runForEternity} 
                    onChange={(e) => setRunForEternity(e.target.checked)} 
                  />
                  <span className="checkbox-text" style={{ fontSize: '14px' }}>Run for eternity (Infinite search loop until you manually stop)</span>
                </label>
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

      {isCompressing && (
        <div className="loading-container">
          <div className="spinner"></div>
          <div className="loading-text">Compressing PDF...</div>
          
          {level === 'advance' ? (
            <div className="progress-details">
              <div className="progress-stats">
                <div className="progress-stat">
                  <span>Time Elapsed:</span>
                  <strong>{formatTime(elapsedTime)}</strong>
                </div>
                <div className="progress-stat">
                  <span>Compression Passes:</span>
                  <strong>{attemptCount}</strong>
                </div>
                <div className="progress-stat">
                  <span>Current Best Size:</span>
                  <strong style={{ color: 'var(--success-color)' }}>
                    {currentBestSize > 0 ? formatBytes(currentBestSize) : 'Calculating...'}
                  </strong>
                </div>
                <div className="progress-stat">
                  <span>Latest Attempt:</span>
                  <strong>{currentAttemptSize > 0 ? formatBytes(currentAttemptSize) : 'Calculating...'}</strong>
                </div>
              </div>

              <div className="size-bar-container">
                <div className="size-bar-track">
                  <div 
                    className="size-bar-target-marker" 
                    style={{ left: `${Math.min(100, (activeTargetBytes / file!.size) * 100)}%` }}
                  ></div>
                  <div 
                    className="size-bar-best-arrow" 
                    style={{ 
                      left: `${currentBestSize ? Math.min(100, (currentBestSize / file!.size) * 100) : 100}%`,
                      opacity: currentBestSize ? 1 : 0 
                    }}
                  >
                    ▼
                  </div>
                </div>
                <div className="size-bar-labels">
                  <span className="label-zero">0 KB</span>
                  <span 
                    className="label-target" 
                    style={{ left: `${Math.min(100, (activeTargetBytes / file!.size) * 100)}%` }}
                  >
                    Target: {formatBytes(activeTargetBytes)}
                  </span>
                  <span className="label-original">Original: {formatBytes(file!.size)}</span>
                </div>
              </div>

              <p className="progress-help">Finding the perfect compression ratio...</p>
              
              <button className="btn-stop" onClick={handleStop}>
                <StopCircle size={18} />
                Stop & Download Best Available
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Working entirely offline in your browser.</p>
          )}
        </div>
      )}

      {compressedPdfUrl && (
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF has been compressed!</h2>
          
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
