import { useEffect, useMemo, useRef, useState } from 'react'

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const ORANGE = '#E89B2D'
const GRAY = '#C9C9C9'

// Детерминированные значения КБЖУ по дню
function dayStats(day, isToday) {
  if (isToday)
    return {
      kcal: 2150,
      protein: 67,
      carbs: 78,
      fat: 33,
      kcalLabel: 'Калорий осталось',
      proteinLabel: 'Белка осталось',
      carbsLabel: 'Углеводов осталось',
      fatLabel: 'Жиров осталось'
    }
  const left = 1600 + (day * 137) % 900
  return {
    kcal: left,
    protein: 40 + (day * 17) % 70,
    carbs: 60 + (day * 23) % 90,
    fat: 20 + (day * 13) % 45,
    kcalLabel: 'Калорий употреблено',
    proteinLabel: 'Белка употреблено',
    carbsLabel: 'Углеводов употреблено',
    fatLabel: 'Жиров употреблено'
  }
}

function Ring({ size, stroke, color, pct, track = '#E9E9E9' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

export default function Kbju() {
  const now = new Date()
  const today = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()

  const days = useMemo(() => {
    const total = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: total }, (_, i) => {
      const d = i + 1
      const date = new Date(year, month, d)
      return {
        date: d,
        weekday: WEEKDAYS[date.getDay()],
        isToday: d === today,
        isFuture: d > today,
        isPast: d < today
      }
    })
  }, [])

  const [selected, setSelected] = useState(today)
  const stripRef = useRef(null)
  const dayRefs = useRef([])

  // Автопрокрутка к сегодняшнему дню при монтировании
  useEffect(() => {
    const el = stripRef.current
    const target = dayRefs.current[today - 1]
    if (!el || !target) return
    el.scrollLeft = target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollTo = (d, behavior = 'auto') => {
    const el = stripRef.current
    const target = dayRefs.current[d - 1]
    if (!el || !target) return
    el.scrollTo({ left: target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2, behavior })
  }

  const pick = (d) => {
    if (d > today) return
    setSelected(d)
    scrollTo(d, 'smooth')
  }

  const stats = dayStats(selected, selected === today)

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">КБЖУ</h1>

      {/* Прокручиваемая полоска дней */}
      <div
        ref={stripRef}
        className="no-scrollbar mt-5 flex gap-1 overflow-x-auto overscroll-x-contain"
      >
        {days.map((d) => {
          const isSelected = d.date === selected
          const ringColor = isSelected
            ? ORANGE
            : d.isPast
              ? '#C9C9C9'
              : '#E9E9E9'
          const ringPct = isSelected
            ? 1
            : d.isPast
              ? 1
              : 0

          return (
            <button
              key={d.date}
              type="button"
              onClick={() => pick(d.date)}
              disabled={d.isFuture}
              className="flex flex-col items-center gap-1.5 shrink-0"
              style={{ opacity: d.isFuture ? 0.3 : 1 }}
              ref={(el) => { dayRefs.current[d.date - 1] = el }}
            >
              <span className="text-[18px] font-medium text-neutral-900">{d.date}</span>
              <span className="text-[11px] uppercase text-neutral-400">{d.weekday}</span>
              <Ring
                size={22}
                stroke={2.5}
                color={ringColor}
                pct={ringPct}
                track={ringColor === ORANGE ? '#FDE8C8' : '#E9E9E9'}
              />
            </button>
          )
        })}
      </div>

      {/* Калории */}
      <div className="mt-5 rounded-[22px] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-5">
          <div>
            <p className="text-[40px] font-bold tracking-tight text-neutral-900">{stats.kcal}</p>
            <p className="mt-1 text-[13px] text-neutral-500">{stats.kcalLabel}</p>
          </div>
          <Ring size={110} stroke={10} color="#2A2A2A" pct={1 - stats.kcal / 2600} track="#E9E9E9" />
        </div>
      </div>

      {/* Б/Ж/У */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { value: `${stats.protein}g`, label: stats.proteinLabel, color: '#58C26D', pct: stats.protein / 120 },
          { value: `${stats.carbs}g`, label: stats.carbsLabel, color: '#F5A623', pct: stats.carbs / 180 },
          { value: `${stats.fat}g`, label: stats.fatLabel, color: '#D93025', pct: stats.fat / 70 }
        ].map((item) => (
          <div key={item.label} className="rounded-[18px] bg-white p-4 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <p className="text-[22px] font-bold text-neutral-900">{item.value}</p>
            <p className="mt-1 text-[10px] leading-tight text-neutral-400">{item.label}</p>
            <div className="mx-auto mt-3 flex h-11 w-11">
              <Ring size={56} stroke={7} color={item.color} pct={item.pct} track="#E9E9E9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
