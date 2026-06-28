import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, CheckCircle, ArrowRight, FileDown, ChevronUp, ChevronDown } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { convertJpgsToPdf } from '../../utils/pdfProcessor';
import './JpgToPdf.css';

interface JpgFile {
  id: string;
  file: File;
  previewUrl: string;
}

export const JpgToPdf: React.FC = () => {
  const [files, setFiles] = useState<JpgFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
      if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    };
  }, [files, resultPdfUrl]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const addFiles = (newFiles: FileList | File[]) => {
    let currentTotalSize = files.reduce((acc, f) => acc + f.file.size, 0);
    const validJpgs: JpgFile[] = [];

    for (const file of Array.from(newFiles)) {
      if (file.type !== 'image/jpeg' && file.type !== 'image/jpg' && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
        alert("Please upload only JPG/JPEG images. Other formats are not supported.");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`The image '${file.name}' exceeds the maximum size of 10MB.`);
        continue;
      }
      if (files.length + validJpgs.length >= 30) {
        alert("You can only convert up to 30 images at a time.");
        break;
      }
      if (currentTotalSize + file.size > 50 * 1024 * 1024) {
        alert("The total size of uploaded images exceeds 50MB. Please remove some images.");
        break;
      }
      
      currentTotalSize += file.size;
      validJpgs.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl: URL.createObjectURL(file)
      });
    }

    if (validJpgs.length > 0) {
      setFiles(prev => [...prev, ...validJpgs]);
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
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) URL.revokeObjectURL(fileToRemove.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleConvert = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    try {
      const { url, size } = await convertJpgsToPdf(files.map(f => f.file));
      setResultPdfUrl(url);
      setResultSize(size);
    } catch (err) {
      const error = err as Error;
      console.error('Error generating PDF:', error);
      if (error.message && error.message.startsWith('CORRUPTED_IMAGE:')) {
        const filename = error.message.split(':')[1];
        alert(`We couldn't read '${filename}'. The image might be corrupted.`);
      } else {
        alert("An error occurred while generating your PDF. Please try again.");
      }
    } finally {
      setIsConverting(false);
    }
  };

  const handleReset = () => {
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setFiles([]);
    setResultPdfUrl(null);
    setResultSize(0);
  };

  const handleMoreFiles = () => {
    if (resultPdfUrl) URL.revokeObjectURL(resultPdfUrl);
    setResultPdfUrl(null);
    setResultSize(0);
  };

  return (
    <div className="jpg-to-pdf-page">
      {!resultPdfUrl && (
        <>
          <div className="hero-section">
            <h1 className="hero-title">JPG to PDF</h1>
            <p className="hero-subtitle">
              Convert your JPG images to a beautiful PDF document perfectly.
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
              {files.length > 0 ? 'Add more images' : 'Select JPG images'}
            </button>
            {files.length === 0 && <p className="upload-text">or drop images here</p>}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/jpeg, image/jpg" 
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
                    
                    <div className="file-icon-wrapper" style={{ padding: 0, overflow: 'hidden', background: '#f8fafc', width: '48px', height: '48px' }}>
                      <img src={fileObj.previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                  onClick={handleConvert}
                  disabled={isConverting}
                >
                  {isConverting ? 'Generating PDF...' : 'Convert to PDF'}
                  {!isConverting && <ArrowRight size={20} />}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {resultPdfUrl && (
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">PDF generated successfully!</h2>
          
          <div className="stats-container">
            <div className="stat-box">
              <span className="stat-label">File Size</span>
              <span className="stat-value highlight">{formatBytes(resultSize)}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Images Included</span>
              <span className="stat-value">{files.length}</span>
            </div>
          </div>

          <a 
            href={resultPdfUrl} 
            download="generated_document.pdf"
            className="btn-download"
          >
            <FileDown size={24} />
            Download PDF
          </a>
          
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button className="btn-secondary" onClick={handleMoreFiles}>
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
