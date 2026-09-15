"use client";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  /** When false/undefined with total ≤ pageSize, nothing renders. */
  show?: boolean;
};

export function TablePagination({
  page,
  totalPages,
  total,
  pageSize = 10,
  onPageChange,
  show,
}: Props) {
  const visible = show ?? total > pageSize;
  if (!visible || totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="table-pagination" aria-label="Table pagination">
      <p className="table-pagination-meta">
        Showing {from}–{to} of {total}
      </p>
      <div className="table-pagination-controls">
        <button
          type="button"
          className="btn ghost btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            className={`btn btn-sm ${n === page ? "lime" : "ghost"}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="btn ghost btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
