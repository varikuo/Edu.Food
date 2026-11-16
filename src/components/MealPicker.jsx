import { useEffect, useState } from 'react'
import { getChoices, saveChoices } from '../lib/api'

const ACCENT = '#E89B2D'

// Сервер отдаёт choices как { slot: { attend, auto } } — сводим к булевым
const toBooleans = (choices) =>
  Object.fromEntries(Object.entries(choices ?? {}).map(([k, v]) => [k, Boolean(v.attend)]))

// Выбор приёмов пищи на день. Значения приходят с сервера предвыбранными:
// дети едят всегда, но слот автоматически снят, если в опубликованном меню
// нет ни одного блюда из рациона ученика (остаётся кликабельным). Отказом
// считается только собственное решение, подтверждённый кнопкой.
export default function MealPicker({ meals, onSaved }) {
  const [selected, setSelected] = useState({})
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | saving | saved | error
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getChoices()
      .then((data) => {
        if (!alive) return
        setMeta(data)
        setSelected(toBooleans(data.choices))
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

  const locked = status === 'loading' || status === 'saving' || meta?.open === false

  const pick = (id) => {
    if (locked || status === 'saved') return
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  const confirm = async () => {
    if (locked || status === 'saved') return
    setStatus('saving')
    try {
      const data = await saveChoices(selected)
      setMeta(data)
      setSelected(toBooleans(data.choices))
      setStatus('saved')
      onSaved?.(data.choices)
      setTimeout(() => setStatus('ready'), 3000)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const hint =
    status === 'error'
      ? error
      : meta?.open === false
        ? `Доступ закрыт с ${meta.deadline}`
        : `Выбрать до ${meta?.deadline ?? '8:15'}`

  return (
    <div className="rounded-[22px] bg-[#F5F5F5] p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-semibold text-neutral-900">Выбрать:</h2>
        <span className="text-[13px] font-medium" style={{ color: ACCENT }}>
          {hint}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {meals.map((meal) => {
          const checked = Boolean(selected[meal.id])
          return (
            <button
              key={meal.id}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => pick(meal.id)}
              disabled={locked}
              className="flex w-full items-center gap-3 py-1 text-left disabled:opacity-60"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                style={{ borderColor: checked ? ACCENT : '#C9C9C9' }}
              >
                {checked && (
                  <span className="h-3 w-3 rounded-full" style={{ background: ACCENT }} />
                )}
              </span>
              <span className="text-[16px] text-neutral-900">{meal.title}</span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={confirm}
        disabled={locked || status === 'saved'}
        className="mx-auto mt-4 block w-4/5 rounded-full bg-white py-2.5 text-center text-[14px] font-medium text-neutral-900 shadow-sm active:bg-neutral-100 disabled:opacity-60"
      >
        {status === 'saving' ? 'Сохраняем…' : status === 'saved' ? 'Отправлено' : 'Подтвердить'}
      </button>
    </div>
  )
}
