import { useEffect, useState } from 'react'
import { Check, ChevronDown, Download, EyeOff } from 'lucide-react'
import { getAttendanceReport } from '../lib/api'

const SLOT_TITLES = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' }

// ISO-дата из API -> «09.11» (сначала день, потом месяц)
function isoToRu(iso) {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}
const SLOTS = ['breakfast', 'lunch', 'dinner']

// Отчёт для бухгалтерии: кто кушал, а кто пропустил, по каждому приёму пищи.
// Пропуски отдаются списком дат по каждому приёму (дд.мм) — на экране и в CSV.
// Выгрузка CSV (Excel) — по классам, для отправки классным руководителям.
// Класс выбирается кнопкой «Выбрать класс»: таблица видна только для него,
// пункт «Скрыть» в списке убирает таблицу с экрана.
export default function Attendance() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setReport(null)
    setError('')
    getAttendanceReport(month)
      .then((data) => alive && setReport(data))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [month])

  // Список дат пропуска приёма пищи в человекочитаемом виде
  const missedText = (row, slot) => {
    const dates = row.missedBySlot?.[slot] ?? []
    return dates.length > 0 ? dates.map(isoToRu).join(', ') : '—'
  }

  const classes = report?.classes ?? []
  // Выбранный класс может пропасть после смены месяца — тогда отчёт скрыт
  const active = classes.some((c) => c.class === picked) ? picked : null
  const visible = active ? classes.filter((c) => c.class === active) : []

  const downloadCsv = () => {
    const header = [
      'Класс',
      'ФИО',
      ...SLOTS.flatMap((s) => [`${SLOT_TITLES[s]}: посетил`, `${SLOT_TITLES[s]}: пропуски`]),
      ...SLOTS.map((s) => `${SLOT_TITLES[s]}: даты пропусков`)
    ]
    const lines = [header.join(';')]
    for (const cls of visible) {
      for (const row of cls.rows) {
        const cells = [cls.class, row.fio]
        for (const slot of SLOTS) {
          cells.push(row.slots[slot].attended, row.slots[slot].missed)
        }
        for (const slot of SLOTS) {
          cells.push(missedText(row, slot))
        }
        lines.push(cells.join(';'))
      }
    }
    // BOM — чтобы Excel открыл кириллицу без настройки кодировки
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `посещаемость_${active}_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">Посещаемость</h1>
      <p className="mt-1.5 text-sm text-neutral-400">
        Отметки по QR за месяц — для бухгалтерии и классных руководителей
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[14px] text-neutral-900 outline-none focus:border-[#E89B2D]"
        />
        {report && active && (
          <button
            type="button"
            onClick={downloadCsv}
            className="flex items-center gap-2 rounded-full bg-[#F5F5F5] px-4 py-2 text-[13px] font-medium text-neutral-700 active:bg-neutral-200"
          >
            <Download size={14} strokeWidth={2.2} /> Выгрузить CSV
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}
      {!report && !error && <p className="mt-6 text-sm text-neutral-400">Загрузка…</p>}

      {report && (
        <p className="mt-3 text-[13px] text-neutral-400">
          Учебных дней в периоде (пн–сб): {report.weekdays}
        </p>
      )}

      {/* Выбор класса: отчёт показывается только для выбранного класса */}
      {report && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
            className="flex w-full items-center justify-between rounded-2xl bg-[#F5F5F5] px-4 py-3 text-[15px] font-medium text-neutral-900 active:bg-neutral-200"
          >
            <span>{active ? `${active} класс` : 'Выбрать класс'}</span>
            <ChevronDown
              size={18}
              strokeWidth={2.2}
              className={`shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {pickerOpen && (
            <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
              {classes.map((cls, i) => (
                <button
                  key={cls.class}
                  type="button"
                  onClick={() => {
                    setPicked(cls.class)
                    setPickerOpen(false)
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-neutral-900 active:bg-neutral-100 ${
                    i > 0 ? 'border-t border-neutral-100' : ''
                  }`}
                >
                  {cls.class} класс
                  {active === cls.class && (
                    <Check size={16} strokeWidth={2.4} style={{ color: '#E89B2D' }} />
                  )}
                </button>
              ))}

              {/* Скрыть таблицу выбранного класса */}
              {active && (
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null)
                    setPickerOpen(false)
                  }}
                  className="flex w-full items-center justify-between border-t border-neutral-100 px-4 py-3 text-left text-[15px] text-neutral-500 active:bg-neutral-100"
                >
                  Скрыть
                  <EyeOff size={16} strokeWidth={2.2} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {visible.map((cls) => (
        <section key={cls.class} className="mt-6">
          <h2 className="text-[17px] font-semibold text-neutral-900">{cls.class} класс</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl bg-[#F5F5F5]">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="text-neutral-500">
                  <th className="px-3 py-2 text-left font-medium">ФИО</th>
                  {SLOTS.map((s) => (
                    <th
                      key={s}
                      className="px-2 py-2 text-center font-medium"
                      title={`${SLOT_TITLES[s]}: посещено из учебных дней`}
                    >
                      {SLOT_TITLES[s]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium">Даты пропусков</th>
                </tr>
              </thead>
              <tbody>
                {cls.rows.map((row) => (
                  <tr key={row.fio} className="border-t border-white align-top">
                    <td className="px-3 py-1.5 text-neutral-900">{row.fio}</td>
                    {SLOTS.map((s) => {
                      const cell = row.slots[s]
                      return (
                        <td key={s} className="px-2 py-1.5 text-center tabular-nums">
                          <div className="text-neutral-700">
                            {cell.attended} из {report.weekdays}
                          </div>
                          {cell.missed > 0 ? (
                            <div className="text-[11px] font-medium" style={{ color: '#C0392B' }}>
                              −{cell.missed}
                            </div>
                          ) : (
                            <div className="text-[11px]" style={{ color: '#2E7D32' }}>
                              без пропусков
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-neutral-500">
                      {SLOTS.map((s) => (
                        <div key={s} className="tabular-nums leading-snug">
                          <span className="text-neutral-400">{SLOT_TITLES[s]}: </span>
                          {missedText(row, s)}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="mt-4 mb-2 text-[12px] text-neutral-400">
        В ячейке — сколько приёмов посетил из числа учебных дней (пн–сб), ниже — число пропусков.
        Пропуск — учебный день без отметки по QR и без отказа.
      </p>
    </div>
  )
}
