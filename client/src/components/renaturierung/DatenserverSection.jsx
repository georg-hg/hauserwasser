import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export default function DatenserverSection() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nasInfo, setNasInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(''); // "2 / 5"
  const [uploadResults, setUploadResults] = useState([]); // [{type, message}]
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [importsRes, nasRes] = await Promise.all([
        api.get('/api/monitoring/imports'),
        api.get('/api/monitoring/nas-info'),
      ]);
      setImports(importsRes);
      setNasInfo(nasRes);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const validExts = ['.txt', '.csv', '.xlsx', '.xls', '.zip'];
    const fileList = Array.from(files);

    // Alle Dateien validieren
    const invalid = fileList.filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return !validExts.includes(ext);
    });
    if (invalid.length > 0) {
      setUploadResults([{ type: 'error', message: `Ungültige Dateien: ${invalid.map(f => f.name).join(', ')}. Nur .txt, .csv, .xlsx oder .zip erlaubt.` }]);
      setTimeout(() => setUploadResults([]), 5000);
      return;
    }

    setUploading(true);
    setUploadResults([]);
    const results = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setUploadProgress(`${i + 1} / ${fileList.length}`);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await api.upload('/api/monitoring/upload', formData);
        results.push({
          type: 'success',
          message: `${result.filename}: ${result.inserted} von ${result.total} Messwerten importiert.`,
        });
      } catch (err) {
        results.push({ type: 'error', message: `${file.name}: ${err.message}` });
      }
    }

    setUploadResults(results);
    setUploadProgress('');
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadData();
    setTimeout(() => setUploadResults([]), 8000);
  }, []);

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files?.length) handleUpload(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files?.length) handleUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Gerade eben';
    if (mins < 60) return `vor ${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
    return formatDateShort(dateStr);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* NAS-Zugang */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">{nasInfo?.name || 'Datenserver'}</h3>
              <p className="text-xs text-gray-500">{nasInfo?.folder || 'KremsKematen'}</p>
            </div>
          </div>
          <a
            href={nasInfo?.url || 'https://tbzauner.com:5001/sharing/rHzpr3WXH'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            NAS öffnen
          </a>
        </div>

        <div className="p-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">So funktioniert&apos;s:</p>
                <p>1. Klicke &quot;NAS öffnen&quot; um die Messdaten am Datenserver zu sehen</p>
                <p>2. Lade die gewünschte .txt Datei herunter</p>
                <p>3. Ziehe die Datei in den Bereich unten oder wähle sie aus</p>
                <p>4. Die Messdaten werden automatisch importiert und ausgewertet</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload */}
      {isAdmin && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragOver
              ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
              : 'border-gray-300 bg-white hover:border-gray-400'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
              <p className="text-sm text-gray-600">
                {uploadProgress ? `Datei ${uploadProgress} wird importiert...` : 'Wird importiert...'}
              </p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className={`w-6 h-6 ${dragOver ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {dragOver ? (
                  <span className="text-emerald-600 font-medium">Datei hier ablegen</span>
                ) : (
                  <>Messdaten-Datei hierher ziehen</>
                )}
              </p>
              <p className="text-xs text-gray-400 mb-3">oder</p>
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 cursor-pointer transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Datei auswählen
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.xlsx,.xls,.zip"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">.txt · .csv · .xlsx · .zip</p>
            </>
          )}
        </div>
      )}

      {/* Upload Status */}
      {uploadResults.length > 0 && (
        <div className="space-y-2">
          {uploadResults.map((r, i) => (
            <div key={i} className={`rounded-xl p-3 text-sm flex items-center gap-2 ${
              r.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {r.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                )}
              </svg>
              {r.message}
            </div>
          ))}
        </div>
      )}

      {/* Importierte Dateien */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Importierte Dateien</h3>
          <span className="text-xs text-gray-400">{imports.length} Dateien</span>
        </div>

        {imports.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <p className="text-sm text-gray-400">Noch keine Dateien importiert</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {imports.map((imp) => (
              <div key={imp.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{imp.filename}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{imp.recordsImported} Messwerte</span>
                        <span className="text-gray-300">·</span>
                        <span>Sonde: {imp.probeName}</span>
                        {imp.dataFrom && imp.dataTo && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{formatDateShort(imp.dataFrom)} – {formatDateShort(imp.dataTo)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-xs text-gray-500">{timeAgo(imp.uploadedAt)}</p>
                    {imp.uploadedBy && (
                      <p className="text-xs text-gray-400">{imp.uploadedBy}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
