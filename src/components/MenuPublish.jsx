import { useEffect, useState } from 'react'
import { Check, ChevronDown, Search, UtensilsCrossed } from 'lucide-react'
import { getDishes, getMenu, publishMenu } from '../lib/api'

const ACCENT = '#E89B2D'

const SLOT_ORDER = [
  { id: 'breakfast', title: 'Завтрак' },
  { id: 'lunch', title: 'Обед' },
  { id: 'dinner', title: 'Ужин' }
]

// Поиск внутри слота включаем только на длинном списке — иначе он мешает
const SEARCH_MIN = 5

// Публикация меню на сегодня: работник отмечает блюда каждого приёма пищи.
// Блюда слота открываются выпадающим списком; на длинных списках есть поиск.
// Ученики сразу видят их на карточках стопки, а сводка порций пересчитывается.
export default function MenuPublish({ onPublished }) {
  const [dishes, setDishes] = useState([])
  const [selected, setSelected] = useState({ breakfast: [], lunch: [], dinner: [] })
  const [openSlot, setOpenSlot] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([getDishes(), getMenu()])
      .then(([d, m]) => {
        if (!alive) return
        setDishes(d.dishes)
        setSelected(
          Object.fromEntries(
            SLOT_ORDER.map(({ id }) => [id, m.slots[id].dishes.map((x) => x.id)])
          )
        )
        setStatus('ready')
      })
      .catch((err) => {
        if (!alive) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [])

  const toggle = (slot, id) =>
    setSelected((s) => ({
      ...s,
      [slot]: s[slot].includes(id) ? s[slot].filter((x) => x !== id) : [...s[slot], id]
    }))

  const publish = async () => {
    setStatus('saving')
    try {
      await publishMenu(selected)
      setStatus('saved')
      onPublished?.()
      setTimeout(() => setStatus('ready'), 2500)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">Меню на сегодня</h1>
      <p className="mt-1.5 text-sm text-neutral-400">
        Отметьте блюда каждого приёма пищи и опубликуйте
      </p>

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}
      {status === 'loading' && <p className="mt-6 text-sm text-neutral-400">Загрузка…</p>}

      {status !== 'loading' &&
        SLOT_ORDER.map(({ id, title }, i) => {
          const options = dishes.filter((d) => d.slot === id)
          const chosen = options.filter((d) => selected[id].includes(d.id))
          const isOpen = openSlot === id
          const needle = query.trim().toLowerCase()
          const filtered = needle
            ? options.filter((d) => d.title.toLowerCase().includes(needle))
            : options

          return (
            <section key={id} className={i === 0 ? 'mt-6' : 'mt-3'}>
              <div className="rounded-2xl bg-[#F5F5F5] p-3">
                {/* Заголовок слота — раскрывает список блюд */}
                <button
                  type="button"
                  onClick={() => {
                    setOpenSlot(isOpen ? null : id)
                    setQuery('')
                  }}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-neutral-900">
                      {title}
                    </span>
                    <span className="block truncate text-[13px] text-neutral-400">
                      {chosen.length > 0
                        ? chosen.map((d) => d.title).join(', ')
                        : 'Блюда не выбраны'}
                    </span>
                  </span>
                  {chosen.length > 0 && (
                    <span
                      className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold"
                      style={{ color: ACCENT }}
                    >
                      {chosen.length}
                    </span>
                  )}
                  <ChevronDown
                    size={18}
                    strokeWidth={2.2}
                    className={`shrink-0 text-neutral-500 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-3">
                    {options.length > SEARCH_MIN && (
                      <div className="relative">
                        <Search
                          size={16}
                          strokeWidth={2.2}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                        />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Поиск блюда"
                          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-[#E89B2D]"
                        />
                      </div>
                    )}

                    <div className="mt-2 space-y-1.5">
                      {filtered.map((dish) => {
                        const on = selected[id].includes(dish.id)
                        return (
                          <button
                            key={dish.id}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => toggle(id, dish.id)}
                            className="flex w-full items-center gap-3 rounded-xl bg-white p-2.5 text-left"
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                              style={{ borderColor: on ? ACCENT : '#C9C9C9' }}
                            >
                              {on && (
                                <span
                                  className="h-3 w-3 rounded-full"
                                  style={{ background: ACCENT }}
                                />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] text-neutral-900">
                                {dish.title}
                              </span>
                              <span className="block text-[12px] text-neutral-400">
                                {dish.kcal} ккал
                              </span>
                            </span>
                          </button>
                        )
                      })}

                      {filtered.length === 0 && (
                        <p className="px-1 py-2 text-[13px] text-neutral-400">Ничего не найдено</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )
        })}

      {status !== 'loading' && (
        <button
          type="button"
          onClick={publish}
          disabled={status === 'saving' || status === 'saved'}
          className="mt-7 mb-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white shadow-sm active:brightness-95 disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          {status === 'saved' ? (
            <>
              <Check size={18} strokeWidth={2.4} /> Опубликована
            </>
          ) : status === 'saving' ? (
            'Публикуем…'
          ) : (
            <>
              <UtensilsCrossed size={18} strokeWidth={2.2} /> Опубликовать на сегодня
            </>
          )}
        </button>
      )}
    </div>
  )
}
