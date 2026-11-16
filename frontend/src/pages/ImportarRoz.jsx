import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const ImportarRoz = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/importacion/roz`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Importar archivo .roz</h2>
        <p className="text-slate-500">Importa datos desde aSc Timetables 2017 (.roz) hacia UPT.</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-slate-400" />
          <input
            type="file"
            accept=".roz"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          <span>{loading ? 'Importando...' : 'Importar'}</span>
        </button>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle className="w-5 h-5" />
              <span>Importación completada</span>
            </div>
            <ul className="text-sm space-y-1 ml-7">
              <li>Materias: {result.materias}</li>
              <li>Docentes: {result.docentes}</li>
              <li>Aulas: {result.aulas}</li>
              <li>Grupos: {result.grupos}</li>
              <li>Lecciones: {result.lecciones}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportarRoz;