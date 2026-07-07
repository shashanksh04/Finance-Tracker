import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<T>({ columns, data, keyExtractor, onRowClick, page, totalPages, onPageChange }: DataTableProps<T>) {
  return (
    <div className="table-container">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`table-header ${col.className || ''}`}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${onRowClick ? 'hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`table-cell ${col.className || ''}`}>{col.render(item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="text-center py-12 text-surface-500 dark:text-surface-400 text-sm">No data available</div>
      )}
      {totalPages && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
          <span className="text-sm text-surface-500 dark:text-surface-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => onPageChange?.(page! - 1)} className="btn-ghost p-1 disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page === totalPages} onClick={() => onPageChange?.(page! + 1)} className="btn-ghost p-1 disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
