import React from 'react';
import { APP_NAME } from '../../constants/appConstants';
import './Layout.css';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} {APP_NAME}. 100% Offline and Secure. No data leaves your browser.</p>
    </footer>
  );
};
