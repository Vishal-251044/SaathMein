'use client';

/**
 * WeekBars — one-series bar chart for the last 7 days (e.g. purchases per day). Thin bars
 * with rounded tops on a recessive baseline, a hover / focus tooltip per bar and a
 * screen-reader table with the same numbers. One series, so no legend: the title names it.
 */
import { useState } from 'react';
import { cn } from '@/utils/genericFunctions';

const HEIGHT = 140;

/**
 * @param {Object} props
 * @param {string} props.title - Names the series
 * @param {{ day: string, value: number }[]} props.data - Oldest first
 * @param {(value: number) => string} [props.format] - Value formatter
 * @returns {JSX.Element}
 */
export default function WeekBars({ title, data, format = String }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...data.map((row) => row.value));
  const label = (day) =>
    new Date(`${day}T00:00:00+05:30`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
    });

  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      <div className="relative mt-3" style={{ height: HEIGHT + 24 }}>
        <div
          className="absolute inset-x-0 top-0 flex items-end gap-2 border-b border-line"
          style={{ height: HEIGHT }}
        >
          {data.map((row, index) => {
            const height = row.value
              ? Math.max(4, Math.round((row.value / max) * (HEIGHT - 8)))
              : 0;
            return (
              <button
                key={row.day}
                type="button"
                className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${label(row.day)}: ${format(row.value)}`}
              >
                <span
                  className={cn(
                    'w-full max-w-7 rounded-t-[4px] bg-primary transition-opacity duration-150',
                    active !== null && active !== index && 'opacity-50',
                  )}
                  style={{ height }}
                  aria-hidden="true"
                />
                {active === index ? (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-button border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink shadow-pop">
                    {label(row.day)} · <span className="font-mono">{format(row.value)}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex gap-2">
          {data.map((row) => (
            <span key={row.day} className="flex-1 truncate text-center text-[11px] text-muted">
              {label(row.day)}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((row) => (
            <tr key={row.day}>
              <th scope="row">{row.day}</th>
              <td>{format(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
