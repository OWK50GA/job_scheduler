interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

const btnBase: React.CSSProperties = {
  padding: "0.375rem 0.875rem",
  borderRadius: "0.375rem",
  border: "1px solid #1e293b",
  backgroundColor: "#0f172a",
  color: "#f8fafc",
  fontSize: "0.875rem",
  cursor: "pointer",
  transition: "opacity 0.15s",
};

const btnDisabled: React.CSSProperties = {
  ...btnBase,
  opacity: 0.4,
  cursor: "not-allowed",
};

export function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: PaginationProps) {
  const isPrevDisabled = currentPage === 1;
  const isNextDisabled = currentPage === totalPages;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <button
        onClick={onPrev}
        disabled={isPrevDisabled}
        style={isPrevDisabled ? btnDisabled : btnBase}
        aria-label="Previous page"
      >
        Previous
      </button>
      <span
        style={{
          fontSize: "0.875rem",
          color: "#94a3b8",
          minWidth: "6ch",
          textAlign: "center",
        }}
      >
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={isNextDisabled}
        style={isNextDisabled ? btnDisabled : btnBase}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}
