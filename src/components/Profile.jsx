import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getDishes, getMyDishes, saveMyDishes } from '../lib/api'

const ACCENT = '#E89B2D'

// Супы определяем по названию: отдельного признака курса в каталоге нет.
// Вместо \b — явная проверка «дальше не буква»: в JS \b не работает с кириллицей.
const SOUP_RE = /^\s*(борщ|щи|рассольник|солянка|бульон|уха|суп)(?![а-яё])/i

// Выпадающие списки по приёмам пищи. Обед разбит на первое (супы) и второе
// (все остальные блюда) — вместо одной кнопки у обеда две.
const MEALS = [
  {
    id: 'breakfast',
    title: 'Завтрак',
    courses: [{ id: 'breakfast', title: 'Завтрак', match: (d) => d.slot === 'breakfast' }]
  },
  {
    id: 'lunch',
    title: 'Обед',
    courses: [
      {
        id: 'first',
        title: 'Первое',
        hint: 'супы',
        match: (d) => d.slot === 'lunch' && SOUP_RE.test(d.title)
      },
      {
        id: 'second',
        title: 'Второе',
        hint: 'все остальное',
        match: (d) => d.slot === 'lunch' && !SOUP_RE.test(d.title)
      }
    ]
  },
  {
    id: 'dinner',
    title: 'Ужин',
    courses: [{ id: 'dinner', title: 'Ужин', match: (d) => d.slot === 'dinner' }]
  }
]

// Миниатюра блюда: фото из public/menu, серый плейсхолдер если картинки нет
function DishThumb({ dish, size = 'h-10 w-10' }) {
  return dish.image ? (
    <img
      src={dish.image}
      alt=""
      draggable={false}
      className={`${size} shrink-0 rounded-xl object-cover`}
    />
  ) : (
    <span className={`${size} shrink-0 rounded-xl bg-[#EAEAEA]`} />
  )
}

// Личный кабинет: данные ученика + перечень блюд, которые он ест.
// Отмеченные блюда уходят в БД и влияют на разбивку порций на кухне.
export default function Profile({ user, onLogout }) {
  const [dishes, setDishes] = useState([])
  const [selected, setSelected] = useState([])
  const [saved, setSaved] = useState([])
  const [openCourse, setOpenCourse] = useState(null)
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

  // Блюда каждого курса — по общему признаку (слот, для обеда — курс)
  const byCourse = useMemo(() => {
    const groups = {}
    for (const meal of MEALS) for (const course of meal.courses) {
      groups[course.id] = dishes.filter(course.match)
    }
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

  const avatar = user?.role === 'staff' ? '/avatar-staff.svg' : '/avatar-student.svg'

  const identity = (
    <div className="mt-6 flex items-center gap-4">
      <img
        src={avatar}
        alt=""
        className="h-[72px] w-[72px] shrink-0 rounded-full object-cover"
      />
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
      <p className="mt-1 text-[13px] text-neutral-400">
        Отметь блюда, которые ты ешь — по ним столовая считает разбивку порций.
      </p>

      {error && <p className="mt-4 text-[13px] font-medium text-red-500">{error}</p>}

      {status === 'loading' && <p className="mt-6 text-sm text-neutral-400">Загрузка меню…</p>}

      {status !== 'loading' &&
        MEALS.map((meal) => (
          <section key={meal.id} className="mt-6">
            {/* Заголовок приёма нужен только когда курсов несколько —
                иначе его роль выполняет кнопка курса */}
            {meal.courses.length > 1 && (
              <h3 className="text-[15px] font-semibold text-neutral-900">{meal.title}</h3>
            )}

            <div className="mt-2 space-y-2">
              {meal.courses.map((course) => {
                const options = byCourse[course.id] ?? []
                const chosen = options.filter((d) => selected.includes(d.id))
                const isOpen = openCourse === course.id

                return (
                  <div key={course.id} className="rounded-2xl bg-[#F5F5F5] p-3">
                    {/* Кнопка курса — раскрывает список его блюд */}
                    <button
                      type="button"
                      onClick={() => setOpenCourse(isOpen ? null : course.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-[15px] font-semibold text-neutral-900">
                            {course.title}
                          </span>
                          {course.hint && (
                            <span className="text-[12px] text-neutral-400">{course.hint}</span>
                          )}
                        </span>
                        {/* В свёрнутом виде показываем фото выбранных блюд */}
                        <span className="mt-1.5 flex items-center gap-1.5">
                          {chosen.length > 0 ? (
                            chosen.map((dish) => (
                              <DishThumb key={dish.id} dish={dish} size="h-7 w-7" />
                            ))
                          ) : (
                            <span className="block truncate text-[13px] text-neutral-400">
                              Блюда не выбраны
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2.2}
                        className={`shrink-0 text-neutral-500 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="mt-3 space-y-1.5">
                        {options.map((dish) => {
                          const on = selected.includes(dish.id)
                          return (
                            <button
                              key={dish.id}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => toggle(dish.id)}
                              className="flex w-full items-center gap-3 rounded-xl bg-white p-2.5 text-left"
                            >
                              <DishThumb dish={dish} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] text-neutral-900">
                                  {dish.title}
                                </span>
                                <span className="block text-[12px] text-neutral-400">
                                  {dish.kcal} ккал · Б {dish.protein} · Ж {dish.fat} · У{' '}
                                  {dish.carb}
                                </span>
                              </span>
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
                            </button>
                          )
                        })}

                        {options.length === 0 && (
                          <p className="px-1 py-2 text-[13px] text-neutral-400">
                            Блюд пока нет
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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
