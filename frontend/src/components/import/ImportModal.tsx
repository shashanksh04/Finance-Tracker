import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, FileText, X, ChevronRight, Check, AlertTriangle, Download } from 'lucide-react';
import { importApi } from '../../services/api';
import { cn } from '../../utils/format';
import { useAuthStore } from '../../store/authStore';

type Step = 'upload' | 'mapping' | 'preview' | 'result';

interface PreviewRow {
  row_number: number;
  date?: string;
  amount?: number;
  description?: string;
  type?: string;
  category?: string;
  account?: string;
  merchant?: string;
  errors: string[];
}

interface ColumnMapping {
  date?: string;
  amount?: string;
  description?: string;
  type?: string;
  category?: string;
  account?: string;
  merchant?: string;
}

const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  amount: 'Amount',
  description: 'Description',
  type: 'Type (income/expense)',
  category: 'Category',
  account: 'Account',
  merchant: 'Merchant',
};

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[]; total_rows: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.(csv|txt|xlsx|xls)$/i)) {
      setError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }
    setError('');
    setFile(f);
    setLoading(true);
    try {
      const { data } = await importApi.preview(f);
      setColumns(data.columns || []);
      setMapping(data.detected_mapping || {});
      setPreview(data.rows || []);
      setStep('mapping');
    } catch {
      setError('Failed to preview file. Check the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExecute = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await importApi.execute(file, {
        column_mapping: mapping,
        skip_first_row: true,
        create_missing_accounts: true,
        create_missing_categories: true,
      });
      setResult(data);
      setStep('result');
    } catch {
      setError('Import failed. Check your file format and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const updateMapping = (field: string, value: string) => {
    const newMapping = { ...mapping } as ColumnMapping & Record<string, string | undefined>;
    if (value === '') {
      delete newMapping[field as keyof ColumnMapping];
    } else {
      (newMapping as Record<string, string | undefined>)[field] = value;
    }
    setMapping(newMapping);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">
            {step === 'upload' && 'Import Transactions'}
            {step === 'mapping' && 'Column Mapping'}
            {step === 'preview' && 'Review & Confirm'}
            {step === 'result' && 'Import Complete'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl">
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {['upload', 'mapping', 'preview', 'result'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                  step === s ? 'bg-primary-500 text-white' :
                  ['upload', 'mapping', 'preview', 'result'].indexOf(step) > i ? 'bg-emerald-500 text-white' :
                  'bg-surface-200 dark:bg-surface-700 text-surface-500'
                )}>
                  {['upload', 'mapping', 'preview', 'result'].indexOf(step) > i ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={cn('text-xs font-medium hidden sm:inline', step === s ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400')}>
                  {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Columns' : s === 'preview' ? 'Review' : 'Done'}
                </span>
                {i < 3 && <ChevronRight className="w-4 h-4 text-surface-300 dark:text-surface-600" />}
              </div>
            ))}
          </div>

          {/* Step: Upload */}
          {step === 'upload' && (
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                Upload a CSV or Excel file with your transactions. We'll auto-detect the columns.
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
                  dragOver
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 bg-surface-50 dark:bg-surface-800/50',
                )}
              >
                <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <Upload className="w-10 h-10 text-surface-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Drag & drop your file here, or click to browse</p>
                <p className="text-xs text-surface-400 mt-1">Supports .csv, .xlsx, .xls</p>
              </div>
              {loading && (
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-surface-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600" />
                  Parsing file...
                </div>
              )}
            </div>
          )}

          {/* Step: Mapping */}
          {step === 'mapping' && (
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                We detected these columns. Adjust the mapping if needed — match each field to the correct column.
              </p>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300 w-28 flex-shrink-0">{label}</label>
                    <select
                      value={(mapping as Record<string, string | undefined>)[field] || ''}
                      onChange={(e) => updateMapping(field, e.target.value)}
                      className="input-field flex-1"
                    >
                      <option value="">— Skip —</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
                <button onClick={() => setStep('preview')} className="btn-primary">Preview Data</button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                Showing {preview.length} rows. Review the data and confirm to import.
              </p>
              {preview.filter(r => r.errors.length > 0).length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {preview.filter(r => r.errors.length > 0).length} rows have errors and will be skipped.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-surface-50 dark:bg-surface-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-surface-500">#</th>
                      <th className="px-3 py-2 text-left text-surface-500">Date</th>
                      <th className="px-3 py-2 text-left text-surface-500">Description</th>
                      <th className="px-3 py-2 text-right text-surface-500">Amount</th>
                      <th className="px-3 py-2 text-left text-surface-500">Type</th>
                      <th className="px-3 py-2 text-left text-surface-500">Category</th>
                      <th className="px-3 py-2 text-left text-surface-500">Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.row_number} className={cn('border-t border-surface-100 dark:border-surface-800', row.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/10' : '')}>
                        <td className="px-3 py-2 text-surface-500">{row.row_number}</td>
                        <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{row.date || '-'}</td>
                        <td className="px-3 py-2 text-surface-700 dark:text-surface-300 max-w-40 truncate">{row.description || '-'}</td>
                        <td className="px-3 py-2 text-right font-mono text-surface-700 dark:text-surface-300">{row.amount?.toFixed(2) ?? '-'}</td>
                        <td className="px-3 py-2">
                          <span className={cn('badge', row.type === 'income' ? 'badge-success' : 'badge-warning')}>{row.type || '-'}</span>
                        </td>
                        <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{row.category || '-'}</td>
                        <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{row.account || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-6">
                <p className="text-sm text-surface-500">
                  {preview.filter(r => r.errors.length === 0).length} valid / {preview.filter(r => r.errors.length > 0).length} with errors
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setStep('mapping')} className="btn-secondary">Back</button>
                  <button onClick={handleExecute} disabled={loading} className="btn-primary">
                    {loading ? 'Importing...' : `Import ${preview.filter(r => r.errors.length === 0).length} Transactions`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && result && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-2">Import Complete</h3>
              <div className="flex justify-center gap-8 my-6">
                <div>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{result.imported}</p>
                  <p className="text-xs text-surface-500">Imported</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{result.skipped}</p>
                  <p className="text-xs text-surface-500">Skipped</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="text-left max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/10 rounded-xl p-3 mb-4">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Errors:</p>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-red-500 mb-1">{err}</p>
                  ))}
                </div>
              )}
              <button onClick={onClose} className="btn-primary">Done</button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
