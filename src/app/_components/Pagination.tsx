"use client";

export default function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className="row"
      style={{
        justifyContent: "space-between",
        marginTop: 12,
        alignItems: "center",
      }}
    >
      <button
        className="btn"
        disabled={!canPrev}
        onClick={() => onPage(page - 1)}
      >
        ← Trước
      </button>

      <span className="muted">
        Trang <b>{page}</b> / <b>{totalPages}</b> · Tổng <b>{total || 0}</b>
      </span>

      <button
        className="btn"
        disabled={!canNext}
        onClick={() => onPage(page + 1)}
      >
        Sau →
      </button>
    </div>
  );
}
