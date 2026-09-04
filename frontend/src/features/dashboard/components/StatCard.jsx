// src/features/dashboard/components/StatCard.jsx

export default function StatCard({ title, value, subtitle, icon: Icon, colorClass, loading }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-800">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-100 rounded-lg animate-pulse" /> : value}
          </h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-2xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
