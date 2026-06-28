import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../../constants/appConstants';
import './Layout.css';

export const Navbar: React.FC = () => {
  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        <img src="/favicon.png" alt="PDFYeti Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} />
        {APP_NAME}
      </Link>
    </nav>
  );
};
