import { AltArrowLeftIcon, AltArrowRightIcon } from "@solar-icons/react/linear";
import { Button } from "@/components/ui/button";
import { formatFull } from "@/lib/format";

interface BoardPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPrefetch?: (page: number) => void;
}

export function BoardPagination({ page, pageSize, total, onPageChange, onPrefetch }: BoardPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-3">
      <Button
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        onMouseEnter={() => page > 1 && onPrefetch?.(page - 1)}
        onTouchStart={() => page > 1 && onPrefetch?.(page - 1)}
      >
        <AltArrowLeftIcon className="size-3.5" aria-hidden="true" />
        Previous
      </Button>
      <span className="text-xs text-t3 tabular" aria-live="polite">
        {formatFull(first)} to {formatFull(last)} of {formatFull(total)}
      </span>
      <Button
        size="sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        onMouseEnter={() => page < pages && onPrefetch?.(page + 1)}
        onTouchStart={() => page < pages && onPrefetch?.(page + 1)}
      >
        Next
        <AltArrowRightIcon className="size-3.5" aria-hidden="true" />
      </Button>
    </nav>
  );
}
