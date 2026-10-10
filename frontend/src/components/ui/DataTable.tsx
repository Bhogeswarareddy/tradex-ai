import React from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Skeleton } from "./Skeleton";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalCount?: number;
    pageSize?: number;
  };
  sortState?: {
    columnKey: string;
    direction: "asc" | "desc";
    onSort: (columnKey: string) => void;
  };
  selectable?: boolean;
  selectedIds?: string[];
  onSelectRow?: (id: string) => void;
  onSelectAll?: () => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = "No records found.",
  pagination,
  sortState,
  selectable = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  className = "",
}: DataTableProps<T>): React.ReactElement {
  const allSelected =
    data.length > 0 && data.every((item) => selectedIds.includes(keyExtractor(item)));

  return (
    <div className={`w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              {selectable && (
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    aria-label="Select all"
                    className="w-4 h-4 rounded text-[#2563EB] border-slate-300 focus:ring-[#2563EB]"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortState?.columnKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`p-4 ${
                      col.sortable ? "cursor-pointer select-none hover:text-slate-900 transition-colors" : ""
                    }`}
                    onClick={() => col.sortable && sortState?.onSort(col.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="flex flex-col">
                          <ChevronUp
                            className={`w-3 h-3 -mb-1 ${
                              isSorted && sortState?.direction === "asc"
                                ? "text-[#2563EB] font-bold"
                                : "text-slate-300"
                            }`}
                          />
                          <ChevronDown
                            className={`w-3 h-3 ${
                              isSorted && sortState?.direction === "desc"
                                ? "text-[#2563EB] font-bold"
                                : "text-slate-300"
                            }`}
                          />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  {selectable && (
                    <td className="p-4 text-center">
                      <Skeleton variant="rectangular" width={16} height={16} className="mx-auto" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={`skeleton-cell-${col.key}`} className="p-4">
                      <Skeleton variant="text" width="70%" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="p-12 text-center text-slate-400"
                >
                  <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = keyExtractor(item);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? "bg-blue-50/50" : ""
                    }`}
                  >
                    {selectable && (
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onSelectRow && onSelectRow(id)}
                          aria-label={`Select row ${id}`}
                          className="w-4 h-4 rounded text-[#2563EB] border-slate-300 focus:ring-[#2563EB]"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={`${id}-${col.key}`} className="p-4 text-slate-700">
                        {col.render
                          ? col.render(item)
                          : ((item as Record<string, unknown>)[col.key] as React.ReactNode)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 gap-3">
          <div className="text-xs text-slate-500">
            {pagination.totalCount !== undefined ? (
              <span>
                Page <strong className="font-semibold text-slate-700">{pagination.currentPage}</strong> of{" "}
                <strong className="font-semibold text-slate-700">{Math.max(1, pagination.totalPages)}</strong>{" "}
                ({pagination.totalCount} total records)
              </span>
            ) : (
              <span>
                Page <strong className="font-semibold text-slate-700">{pagination.currentPage}</strong> of{" "}
                <strong className="font-semibold text-slate-700">{Math.max(1, pagination.totalPages)}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.currentPage <= 1 || isLoading}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={pagination.currentPage >= pagination.totalPages || isLoading}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
