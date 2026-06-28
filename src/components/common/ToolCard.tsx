import React from 'react';
import { Link } from 'react-router-dom';
import './ToolCard.css';

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  disabled?: boolean;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  title,
  description,
  icon: Icon,
  path,
  disabled = false,
}) => {
  if (disabled) {
    return (
      <div className="tool-card disabled">
        <div className="tool-icon-wrapper">
          <Icon size={32} className="tool-icon" />
        </div>
        <h3 className="tool-title">{title}</h3>
        <p className="tool-description">{description}</p>
        <span className="tool-badge">Coming Soon</span>
      </div>
    );
  }

  return (
    <Link to={path} className="tool-card">
      <div className="tool-icon-wrapper">
        <Icon size={32} className="tool-icon" />
      </div>
      <h3 className="tool-title">{title}</h3>
      <p className="tool-description">{description}</p>
    </Link>
  );
};
