import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, CheckCircle, FileText, ArrowRight, Unlock, Eye, EyeOff, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { unlockPdfDocument, checkIsPdfProtected } from '../../utils/pdfProcessor';
import './UnlockPdf.css';

export const UnlockPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    };
  }, [resultPdfUrl]);

  const loadFile = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert("Please upload a valid PDF document.");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert("This file exceeds the maximum allowed size of 50MB.");
      return;
    }
    
    try {
      const isProtected = await checkIsPdfProtected(selectedFile);
      if (!isProtected) {
        alert("This PDF is not password protected. You do not need to unlock it.");
        return;
      }
    } catch (err) {
      const error = err as Error;
      if (error.message === 'CORRUPTED_OR_UNSUPPORTED') {
        alert("We couldn't read this PDF. The file might be corrupted or in an unsupported format.");
        return;
      }
    }
    
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setResultPdfUrl(null);
    setResultSize(0);
    setPassword('');
    setValidationError('');
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFile(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUnlock = async () => {
    if (!file) return;
    setValidationError('');

    if (!password) {
      setValidationError("Please enter a valid password.");
      return;
    }

    setIsUnlocking(true);
    try {
      const { url, size } = await unlockPdfDocument(file, password);
      setResultPdfUrl(url);
      setResultSize(size);
    } catch (err) {
      const error = err as Error;
      console.error('Error unlocking PDF:', error);
      if (error.message === 'INCORRECT_PASSWORD') {
        setValidationError("The password provided is incorrect. Please try again.");
      } else if (error.message === 'CORRUPTED_OR_UNSUPPORTED') {
        alert("We couldn't read this PDF. The file might be corrupted or in an unsupported format.");
      } else {
        alert("An error occurred while unlocking the PDF. Please try again.");
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleReset = () => {
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setFile(null);
    setResultPdfUrl(null);
    setResultSize(0);
    setPassword('');
    setValidationError('');
  };

  return (
    <div className="unlock-page">
      {!file && !resultPdfUrl && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">Unlock PDF</h1>
            <p className="hero-subtitle">
              Remove PDF password security, giving you the freedom to use your PDFs as you want.
            </p>
          </div>

          <div 
            className={`upload-container ${isDragging ? 'drag-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
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

      {file && !resultPdfUrl && (
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
              <Unlock size={20} />
              <h3>Enter Password</h3>
            </div>
            
            <div className="password-form">
              <div className="input-group">
                <label>Document Password</label>
                <div className="password-input-wrapper">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter the password to unlock"
                    className="password-input text-input"
                  />
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {validationError && (
                <div className="validation-error">
                  {validationError}
                </div>
              )}
            </div>
          </div>

          <div className="action-bar">
            <button 
              className="btn-primary" 
              onClick={handleUnlock}
              disabled={isUnlocking}
            >
              {isUnlocking ? 'Unlocking...' : 'Unlock PDF'}
              {!isUnlocking && <ArrowRight size={20} />}
            </button>
          </div>
        </div>
      )}

      {resultPdfUrl && (
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF Unlocked Successfully!</h2>
          <p className="success-subtitle">The password security has been permanently removed.</p>
          
          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">File Size</span>
              <span className="stat-value highlight">{formatBytes(resultSize)}</span>
            </div>
          </div>

          <a 
            href={resultPdfUrl} 
            download={`unlocked_${file?.name}`}
            className="btn-download"
          >
            <Download size={24} />
            Download Unlocked PDF
          </a>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button className="btn-secondary" onClick={handleReset}>
              Unlock another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
