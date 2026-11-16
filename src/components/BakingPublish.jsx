import { useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { getBaking, publishBaking } from '../lib/api'

const ACCENT = '#E89B2D'

// Публикация выпечки: работник задаёт количество штук и актуальную цену.
// Новую позицию можно добавить; фото подвешивается позже полем image.
export default function BakingPublish() {
  const [items, setItems] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    getBaking()
      .then((data) => {
        if (!alive) return
        setItems(data.items.map((i) => ({ title: i.title, qty: i.qty, price: i.price })))
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

  const setField = (i, key, value) => {
    setSaved(false)
    setItems((list) =>
      list.map((item, j) =>
        j === i ? { ...item, [key]: Math.max(0, Math.round(Number(value) || 0)) } : item
      )
    )
  }

  const addItem = () => {
    const title = newTitle.trim()
    if (!title) return
    if (items.some((i) => i.title.toLowerCase() === title.toLowerCase())) {
      setNewTitle('')
      return
    }
    setSaved(false)
    setItems((list) => [...list, { title, qty: 0, price: 0 }])
    setNewTitle('')
  }

  const publish = async () => {
    setStatus('saving')
    try {
      const { items: fresh } = await publishBaking(items)
      setItems(fresh.map((i) => ({ title: i.title, qty: i.qty, price: i.price })))
      setStatus('ready')
      setSaved(true)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">
        Публикация выпечки
      </h1>
      <p className="mt-1.5 text-sm text-neutral-400">
        Укажите количество штук и цену — ученики увидят это на вкладке «Выпечка»
      </p>

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}
      {status === 'loading' && <p className="mt-6 text-sm text-neutral-400">Загрузка…</p>}

      <div className="mt-4 space-y-2.5">
        {(items ?? []).map((item, i) => (
          <div key={item.title} className="flex items-center gap-2 rounded-2xl bg-[#F5F5F5] p-3">
            <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-900">
              {item.title}
            </span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={item.qty}
              onChange={(e) => setField(i, 'qty', e.target.value)}
              className="w-16 rounded-xl border border-neutral-200 bg-white px-2 py-2 text-center text-[15px] font-medium text-neutral-900 outline-none focus:border-[#E89B2D]"
            />
            <span className="w-5 text-[13px] text-neutral-400">шт</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={item.price}
              onChange={(e) => setField(i, 'price', e.target.value)}
              className="w-16 rounded-xl border border-neutral-200 bg-white px-2 py-2 text-center text-[15px] font-medium text-neutral-900 outline-none focus:border-[#E89B2D]"
            />
            <span className="w-4 text-[13px] text-neutral-400">₽</span>
          </div>
        ))}
      </div>

      {items && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Новая позиция, например Ватрушка"
            className="min-w-0 flex-1 rounded-2xl bg-[#F5F5F5] px-4 py-3 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <button
            type="button"
            onClick={addItem}
            aria-label="Добавить позицию"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm active:bg-neutral-100"
          >
            <Plus size={18} strokeWidth={2.2} style={{ color: ACCENT }} />
          </button>
        </div>
      )}

      {items && (
        <button
          type="button"
          onClick={publish}
          disabled={status === 'saving'}
          className="mt-7 mb-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold text-white shadow-sm active:brightness-95 disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          {saved ? (
            <>
              <Check size={18} strokeWidth={2.4} /> Обновлено
            </>
          ) : status === 'saving' ? (
            'Публикуем…'
          ) : (
            'Опубликовать'
          )}
        </button>
      )}
    </div>
  )
}
