// src/features/aulas/components/AulasTabs.jsx
// Tab bar de navegación entre Aulas y Sedes (E22).

const AulasTabs = ({ activeTab, setActiveTab, setSearchTerm }) => (
  <div className="flex gap-2 border-b border-slate-200 pb-px">
    <button
      onClick={() => { setActiveTab('aulas'); setSearchTerm(''); }}
      className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px ${
        activeTab === 'aulas'
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      Aulas e Infraestructura
    </button>
    <button
      onClick={() => { setActiveTab('sedes'); setSearchTerm(''); }}
      className={`px-6 py-3 font-semibold text-sm transition-all duration-300 border-b-2 -mb-px ${
        activeTab === 'sedes'
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      Sedes Físicas
    </button>
  </div>
);

export default AulasTabs;
