interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

const buttonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded border border-outline-variant bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: PaginationProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentPage === 1}
        className={buttonClassName}
        aria-label="Previous page"
      >
        <span className="material-symbols-outlined text-[18px]">
          chevron_left
        </span>
      </button>
      <div className="inline-flex items-center gap-2 rounded border border-outline-variant bg-surface-container px-3 py-1 font-code text-[11px] text-on-surface">
        <span>{currentPage}</span>
        <span className="text-on-surface-variant">/</span>
        <span className="text-on-surface-variant">{totalPages}</span>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={currentPage === totalPages}
        className={buttonClassName}
        aria-label="Next page"
      >
        <span className="material-symbols-outlined text-[18px]">
          chevron_right
        </span>
      </button>
    </div>
  );
}
