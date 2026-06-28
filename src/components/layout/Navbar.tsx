import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { APP_NAME } from '../../constants/appConstants';
import './Layout.css';

export const Navbar: React.FC = () => {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <FileText size={28} />
        {APP_NAME}
      </Link>
    </nav>
  );
};
