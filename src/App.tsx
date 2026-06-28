import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { CompressPdf } from './pages/CompressPdf';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="compress" element={<CompressPdf />} />
          {/* Add more routes here as tools are implemented */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
