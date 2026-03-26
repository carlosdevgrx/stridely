import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './MiniCalendar.scss';

interface Props {
  value: string;     // 'YYYY-MM-DD' or ''
  min?: string;      // 'YYYY-MM-DD' — days before this are disabled
  onChange: (ymd: string) => void;
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function toYMD(y: number, m0: number, d: number) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }

export default function MiniCalendar({ value, min, onChange }: Props) {
  const today = new Date();
  const todayYMD = toYMD(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState<number>(() => {
    if (value) return parseInt(value.split('-')[0], 10);
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value) return parseInt(value.split('-')[1], 10) - 1;
    return today.getMonth();
  });

  function navigate(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  // Build 42-cell grid (6 rows × 7 cols), Monday-first
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  type Cell = { ymd: string; day: number; other: boolean };
  const cells: Cell[] = [];

  // Trailing days from previous month
  for (let i = startOffset; i > 0; i--) {
    const d = new Date(viewYear, viewMonth, 1 - i);
    cells.push({ ymd: toYMD(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), other: true });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ ymd: toYMD(viewYear, viewMonth, d), day: d, other: false });
  }
  // Leading days from next month
  let nextD = 1;
  while (cells.length < 42) {
    const d = new Date(viewYear, viewMonth + 1, nextD++);
    cells.push({ ymd: toYMD(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), other: true });
  }

  return (
    <div className="mini-cal">
      <div className="mini-cal__header">
        <button type="button" className="mini-cal__nav" onClick={() => navigate(-1)}>
          <ChevronLeft size={15} strokeWidth={2.5} />
        </button>
        <span className="mini-cal__month-title">
          {MONTH_NAMES[viewMonth]} de {viewYear}
        </span>
        <button type="button" className="mini-cal__nav" onClick={() => navigate(1)}>
          <ChevronRight size={15} strokeWidth={2.5} />
        </button>
      </div>

      <div className="mini-cal__grid">
        {DOW_LABELS.map(l => (
          <div key={l} className="mini-cal__dow">{l}</div>
        ))}
        {cells.map((cell, i) => {
          const isSelected = cell.ymd === value;
          const isToday    = cell.ymd === todayYMD;
          const isDisabled = min ? cell.ymd < min : cell.ymd < todayYMD;
          const cls = [
            'mini-cal__day',
            isSelected             ? 'mini-cal__day--selected' : '',
            isToday && !isSelected ? 'mini-cal__day--today'    : '',
            isDisabled             ? 'mini-cal__day--disabled' : '',
            cell.other             ? 'mini-cal__day--other'    : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={isDisabled}
              onClick={() => {
                onChange(cell.ymd);
                if (cell.other) {
                  setViewYear(parseInt(cell.ymd.split('-')[0], 10));
                  setViewMonth(parseInt(cell.ymd.split('-')[1], 10) - 1);
                }
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
