import { useEffect, useState } from 'react'
import { getBaking } from '../lib/api'

// Вкладка «Выпечка» для учеников: что опубликовала столовая сегодня.
// Доступные позиции всплывают наверх, отсутствующие опускаются вниз и гаснут
// с надписью «Нет в наличии». Фото позиции появятся позже — image поддерживается.
export default function Baking() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getBaking()
      .then((data) => alive && setItems(data.items))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  // Стабильная сортировка: есть в наличии — выше, дальше по названию
  const sorted = (items ?? []).slice().sort((a, b) => {
    const out = Number(a.qty <= 0) - Number(b.qty <= 0)
    return out !== 0 ? out : a.title.localeCompare(b.title, 'ru')
  })

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">Выпечка</h1>
      <p className="mt-1.5 text-sm text-neutral-400">Что есть на продажу сегодня</p>

      {/* Фото сверху — часть дизайна вкладки */}
      <img
        src="/sosiski.jpg"
        alt="Выпечка"
        className="mt-4 h-56 w-full rounded-[22px] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
      />

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}
      {!items && !error && <p className="mt-6 text-sm text-neutral-400">Загрузка…</p>}

      <div className="mt-4 space-y-3">
        {sorted.map((item) => {
          const out = item.qty <= 0
          return (
            <div
              key={item.id}
              className={`relative flex items-center gap-4 overflow-hidden rounded-[18px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] ${
                out ? 'bg-[#EDEDED]' : 'bg-white'
              }`}
            >
              {/* Квадрат позиции: фото, когда его приложат, иначе плейсхолдер */}
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  className={`h-[68px] w-[68px] shrink-0 rounded-xl object-cover ${out ? 'grayscale' : ''}`}
                />
              ) : (
                <div className="h-[68px] w-[68px] shrink-0 rounded-xl bg-[#E5E5E5]" />
              )}

              <div className="flex-1">
                <p
                  className={`text-[15px] font-semibold ${out ? 'text-neutral-400' : 'text-neutral-900'}`}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-[13px] text-neutral-400">
                  {out ? '—' : `${item.qty} шт.`}
                </p>
              </div>

              {/* Цена — её задаёт работник при публикации */}
              <span
                className={`shrink-0 text-[15px] font-semibold ${out ? 'text-neutral-400' : 'text-neutral-900'}`}
              >
                {item.price} ₽
              </span>

              {/* Аккуратная плашка поверх отсутствующей позиции */}
              {out && (
                <span className="shrink-0 rounded-full bg-neutral-300 px-3 py-1.5 text-[12px] font-medium text-neutral-600">
                  Нет в наличии
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
