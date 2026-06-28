import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, CheckCircle, FileText, ArrowRight, Lock, Eye, EyeOff, Download } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { protectPdfDocument } from '../../utils/pdfProcessor';
import './ProtectPdf.css';

export const ProtectPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProtecting, setIsProtecting] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    };
  }, [resultPdfUrl]);

  const loadFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert("Please upload a valid PDF document.");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert("This file exceeds the maximum allowed size of 50MB.");
      return;
    }
    
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setResultPdfUrl(null);
    setResultSize(0);
    setPassword('');
    setConfirmPassword('');
    setValidationError('');
    setFile(selectedFile);
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
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFile(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProtect = async () => {
    if (!file) return;
    setValidationError('');

    const cleanPassword = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanPassword) {
      setValidationError("Please enter a valid password.");
      return;
    }
    if (cleanPassword !== cleanConfirm) {
      setValidationError("The passwords do not match. Please try again.");
      return;
    }

    setIsProtecting(true);
    try {
      const { url, size } = await protectPdfDocument(file, cleanPassword);
      setResultPdfUrl(url);
      setResultSize(size);
    } catch (err) {
      const error = err as Error;
      console.error('Error protecting PDF:', error);
      if (error.message === 'ALREADY_PROTECTED') {
        alert("This PDF is already password protected. You cannot add another layer of protection to it.");
      } else if (error.message === 'CORRUPTED_OR_UNSUPPORTED') {
        alert("We couldn't read this PDF. The file might be corrupted.");
      } else {
        alert("An error occurred while protecting your PDF. Please try again.");
      }
    } finally {
      setIsProtecting(false);
    }
  };

  const handleReset = () => {
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setFile(null);
    setResultPdfUrl(null);
    setResultSize(0);
    setPassword('');
    setConfirmPassword('');
    setValidationError('');
  };

  return (
    <div className="protect-page">
      {!file && !resultPdfUrl && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">Protect PDF</h1>
            <p className="hero-subtitle">
              Encrypt your PDF with a password to prevent unauthorized access.
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
              <Lock size={20} />
              <h3>Set Password</h3>
            </div>
            
            <div className="password-form">
              <div className="input-group">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="password-input text-input"
                  />
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Confirm Password</label>
                <div className="password-input-wrapper">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="password-input text-input"
                  />
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
              onClick={handleProtect}
              disabled={isProtecting}
            >
              {isProtecting ? 'Protecting...' : 'Protect PDF'}
              {!isProtecting && <ArrowRight size={20} />}
            </button>
          </div>
        </div>
      )}

      {resultPdfUrl && (
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF Protected Successfully!</h2>
          <p className="success-subtitle">Your document is now secured with AES-256 encryption.</p>
          
          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">File Size</span>
              <span className="stat-value highlight">{formatBytes(resultSize)}</span>
            </div>
          </div>

          <a 
            href={resultPdfUrl} 
            download={`protected_${file?.name}`}
            className="btn-download"
          >
            <Download size={24} />
            Download Protected PDF
          </a>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button className="btn-secondary" onClick={handleReset}>
              Protect another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
