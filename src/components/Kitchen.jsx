import { useCallback, useEffect, useState } from 'react'
import { Minus, RefreshCw, UtensilsCrossed } from 'lucide-react'
import { getPortions } from '../lib/api'

const ACCENT = '#E89B2D'
const POLL_MS = 15_000 // сводка обновляется сама, чтобы смены порций были видны живьём

export default function Kitchen({ user }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await getPortions())
      setError('')
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">
        Сводка порций
      </h1>
      <p className="mt-1.5 text-sm text-neutral-400">
        {data ? `На ${formatDate(data.date)} · ${data.students} учеников` : 'Загрузка…'}
      </p>

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}

      <button
        type="button"
        onClick={load}
        className="mt-4 flex items-center gap-2 rounded-full bg-[#F5F5F5] px-4 py-2 text-[13px] font-medium text-neutral-700 active:bg-neutral-200"
      >
        <RefreshCw size={14} strokeWidth={2.2} />
        Обновить{updatedAt ? ` · ${formatTime(updatedAt)}` : ''}
      </button>

      <div className="mt-5 space-y-4">
        {(data?.slots ?? []).map((slot) => (
          <article key={slot.slot} className="rounded-[22px] bg-[#F5F5F5] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px] font-semibold text-neutral-900">{slot.title}</h2>
              <span className="text-[13px] font-medium" style={{ color: ACCENT }}>
                до {data.deadline}
              </span>
            </div>

            {slot.published ? (
              <>
                <div className="mt-3 flex items-end gap-2">
                  <UtensilsCrossed size={20} strokeWidth={2} style={{ color: ACCENT }} />
                  <span className="text-[38px] font-bold leading-none" style={{ color: ACCENT }}>
                    {slot.portions}
                  </span>
                  <span className="pb-1 text-[13px] text-neutral-500">порций</span>
                </div>

                {/* Разбивка: от базы отнимаем тех, кто не ест выбранное, и отказников */}
                <ul className="mt-2 space-y-0.5 text-[13px] text-neutral-500">
                  <li>база: {slot.base}</li>
                  <li className="flex items-center gap-1.5">
                    <Minus size={13} strokeWidth={2.4} />
                    не ест выбранное: {slot.skipped}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Minus size={13} strokeWidth={2.4} />
                    отказались: {slot.declined}
                  </li>
                </ul>

                <ul className="mt-4 space-y-2 border-t border-white pt-3">
                  {slot.dishes.map((dish) => (
                    <li key={dish.id} className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] text-neutral-800">{dish.title}</span>
                      <span className="shrink-0 text-[14px] font-semibold text-neutral-900">
                        {dish.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-[14px] text-neutral-400">
                Меню на сегодня не опубликовано — порции не считаются
              </p>
            )}
          </article>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-neutral-400">
        Числа пересчитываются автоматически каждые {Math.round(POLL_MS / 1000)} секунд
      </p>
    </div>
  )
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
