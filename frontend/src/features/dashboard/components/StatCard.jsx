// src/features/dashboard/components/StatCard.jsx

export default function StatCard({ title, value, subtitle, icon: Icon, colorClass, loading }) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 leading-snug mb-1.5">{title}</p>
          <h3 className="text-3xl font-bold text-slate-800 leading-none">
            {loading ? <span className="inline-block w-10 h-8 bg-slate-100 rounded-lg animate-pulse" /> : value}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1.5 truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-2xl shrink-0 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
