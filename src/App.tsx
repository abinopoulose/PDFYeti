import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { CompressPdf } from './pages/CompressPdf';
import { MergePdf } from './pages/MergePdf';
import { SplitPdf } from './pages/SplitPdf';
import { PdfToJpg } from './pages/PdfToJpg';
import { JpgToPdf } from './pages/JpgToPdf';
import { ProtectPdf } from './pages/ProtectPdf';
import { UnlockPdf } from './pages/UnlockPdf';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="compress" element={<CompressPdf />} />
          <Route path="merge" element={<MergePdf />} />
          <Route path="split" element={<SplitPdf />} />
          <Route path="pdf-to-jpg" element={<PdfToJpg />} />
          <Route path="jpg-to-pdf" element={<JpgToPdf />} />
          <Route path="protect" element={<ProtectPdf />} />
          <Route path="unlock" element={<UnlockPdf />} />
          {/* Add more routes here as tools are implemented */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
