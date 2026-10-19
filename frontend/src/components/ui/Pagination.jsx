import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function generatePages(current, total, siblings = 1) {
  if (total <= 1) return [];

  const pages = [];
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);

  pages.push(1);

  if (left > 2) pages.push('...');

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  if (right < total - 1) pages.push('...');

  if (total > 1) pages.push(total);

  return pages;
}

export default function Pagination({ currentPage, totalPages, onPageChange, siblingsCount = 1 }) {
  if (totalPages <= 1) return null;

  const pages = generatePages(currentPage, totalPages, siblingsCount);

  return (
    <nav className="flex items-center justify-between px-1 py-3" aria-label="Paginación">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2.5 md:p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Primera página"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2.5 md:p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-h-[40px] min-w-[40px] px-2 rounded-lg text-sm font-medium transition-colors md:h-8 md:min-w-[32px] ${
                page === currentPage
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2.5 md:p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2.5 md:p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Última página"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      <span className="text-sm text-slate-500 dark:text-slate-400">
        Página {currentPage} de {totalPages}
      </span>
    </nav>
  );
}
