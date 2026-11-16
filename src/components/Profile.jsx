import { useEffect, useMemo, useState } from 'react'
import { getDishes, getMyDishes, saveMyDishes } from '../lib/api'

const ACCENT = '#E89B2D'

const SLOT_TITLES = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' }
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner']

// Личный кабинет: данные ученика + перечень блюд, которые он ест.
// Отмеченные блюда уходят в БД и влияют на разбивку порций на кухне.
export default function Profile({ user, onLogout }) {
  const [dishes, setDishes] = useState([])
  const [selected, setSelected] = useState([])
  const [saved, setSaved] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([getDishes(), getMyDishes()])
      .then(([d, m]) => {
        if (!alive) return
        setDishes(d.dishes)
        setSelected(m.dishIds)
        setSaved(m.dishIds)
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

  const bySlot = useMemo(() => {
    const groups = { breakfast: [], lunch: [], dinner: [] }
    for (const dish of dishes) groups[dish.slot]?.push(dish)
    return groups
  }, [dishes])

  const dirty =
    selected.length !== saved.length ||
    selected.some((id) => !saved.includes(id))

  const toggle = (id) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  const submit = async () => {
    setStatus('saving')
    try {
      const { dishIds } = await saveMyDishes(selected)
      setSaved(dishIds)
      setStatus('ready')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const kcal = useMemo(
    () =>
      dishes
        .filter((d) => selected.includes(d.id))
        .reduce((sum, d) => sum + d.kcal, 0),
    [dishes, selected]
  )

  const identity = (
    <div className="mt-6 flex items-center gap-4">
      <div className="h-[72px] w-[72px] shrink-0 rounded-full bg-[#D9D9D9]" />
      <div>
        <p className="text-[18px] font-semibold text-neutral-900">{user?.fio}</p>
        {user?.class && <p className="mt-1 text-[14px] text-neutral-500">Класс: {user.class}</p>}
        <p className="text-[14px] text-neutral-500">Логин: {user?.login}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-1 text-[13px] font-medium text-neutral-900 underline underline-offset-2"
        >
          Выйти
        </button>
      </div>
    </div>
  )

  // Работнику столовой перечень блюд не нужен — у него сводка порций
  if (user?.role === 'staff') {
    return (
      <div className="px-5 pt-8">
        <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">
          Личный кабинет
        </h1>
        {identity}
        <p className="mt-8 text-[15px] leading-relaxed text-neutral-500">
          Вы вошли как сотрудник столовой. Сводку порций по всем ученикам смотрите на вкладке
          «Порции».
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 pt-8">
      <h1 className="text-[28px] font-bold tracking-[-0.01em] text-neutral-900">
        Личный кабинет
      </h1>

      {/* Аватар + инфо */}
      {identity}

      {/* Мой рацион */}
      <h2 className="mt-8 text-[24px] font-bold text-neutral-900">Мой рацион</h2>
      <div className="mt-2 flex items-baseline justify-between">
        <p className="text-[18px] font-medium text-neutral-900">
          {selected.length} {selected.length === 1 ? 'блюдо' : 'блюд'}
        </p>
        <p className="text-[13px] font-medium" style={{ color: ACCENT }}>
          {kcal} ккал
        </p>
      </div>
      <p className="mt-1 text-[13px] text-neutral-400">
        Отметьте блюда, которые вы едите — по ним столовая считает разбивку порций.
      </p>

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}

      {status === 'loading' && <p className="mt-6 text-sm text-neutral-400">Загрузка меню…</p>}

      {status !== 'loading' &&
        SLOT_ORDER.map((slot) => (
          <section key={slot} className="mt-6">
            <h3 className="text-[15px] font-semibold text-neutral-900">{SLOT_TITLES[slot]}</h3>
            <div className="mt-2 space-y-2">
              {bySlot[slot].map((dish) => {
                const on = selected.includes(dish.id)
                return (
                  <button
                    key={dish.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(dish.id)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[#F5F5F5] p-3 text-left"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                      style={{ borderColor: on ? ACCENT : '#C9C9C9' }}
                    >
                      {on && <span className="h-3 w-3 rounded-full" style={{ background: ACCENT }} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-neutral-900">{dish.title}</span>
                      <span className="block text-[12px] text-neutral-500">
                        {dish.kcal} ккал · Б {dish.protein} · Ж {dish.fat} · У {dish.carb}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

      <button
        type="button"
        onClick={submit}
        disabled={!dirty || status === 'saving'}
        className="mt-7 w-full rounded-full py-3.5 text-[15px] font-semibold text-white shadow-sm active:brightness-95 disabled:opacity-40"
        style={{ background: ACCENT }}
      >
        {status === 'saving' ? 'Сохраняем…' : dirty ? 'Сохранить рацион' : 'Рацион сохранён'}
      </button>
    </div>
  )
}
