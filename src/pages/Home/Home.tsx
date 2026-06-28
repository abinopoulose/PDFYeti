import React from 'react';
import { 
  Minimize2, 
  Files, 
  Split, 
  Image, 
  FileText, 
  Lock, 
  Unlock 
} from 'lucide-react';
import { APP_NAME, APP_DESCRIPTION } from '../../constants/appConstants';
import { ToolCard } from '../../components/common/ToolCard';
import './Home.css';

export const Home: React.FC = () => {
  const tools = [
    {
      title: 'Compress PDF',
      description: 'Reduce file size while optimizing for maximal PDF quality.',
      icon: Minimize2,
      path: '/compress',
      disabled: false,
    },
    {
      title: 'Merge PDF',
      description: 'Combine PDFs in the order you want with the easiest PDF merger available.',
      icon: Files,
      path: '/merge',
      disabled: false,
    },
    {
      title: 'Split PDF',
      description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
      icon: Split,
      path: '/split',
      disabled: false,
    },
    {
      title: 'PDF to JPG',
      description: 'Convert each PDF page into a JPG or extract all images contained in a PDF.',
      icon: Image,
      path: '/pdf-to-jpg',
      disabled: false,
    },
    {
      title: 'JPG to PDF',
      description: 'Convert your JPG images to a beautiful PDF document perfectly.',
      icon: FileText,
      path: '/jpg-to-pdf',
      disabled: false,
    },
    {
      title: 'Protect PDF',
      description: 'Encrypt your PDF with a password to prevent unauthorized access.',
      icon: Lock,
      path: '/protect',
      disabled: false,
    },
      {
      title: 'Unlock PDF',
      description: 'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
      icon: Unlock,
      path: '/unlock',
      disabled: false,
    },
  ];

  return (
    <div className="home-container">
      <div className="home-hero">
        <h1 className="home-title">{APP_NAME}</h1>
        <p className="home-subtitle">{APP_DESCRIPTION}</p>
      </div>

      <div className="tools-grid">
        {tools.map((tool, index) => (
          <ToolCard
            key={index}
            title={tool.title}
            description={tool.description}
            icon={tool.icon}
            path={tool.path}
            disabled={tool.disabled}
          />
        ))}
      </div>
    </div>
  );
};
