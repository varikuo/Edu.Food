import { useEffect, useRef, useState } from 'react'
import { Check, QrCode } from 'lucide-react'
import {
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
  animate
} from 'framer-motion'

// ── Палитра ────────────────────────────────────────────────────────────────
const ACCENT = '#E89B2D'
const BTN = '#F7C948'
const SIDE = 18 // отступ карточки от края экрана
const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 }
const SWIPE_RATIO = 0.25 // 25% ширины карточки для переключения
const VELOCITY_THRESHOLD = 0.4 // пикс/мс для быстрого смаха
const AXIS_LOCK_PX = 8 // сдвиг, после которого ясен замысел жеста

// ── Тона карточек ──────────────────────────────────────────────────────────
const SKINS = {
  breakfast: {
    card: 'linear-gradient(180deg, #FDF6EA 0%, #FBE9CC 55%, #F8DCA9 100%)'
  },
  lunch: {
    card: 'linear-gradient(180deg, #FDF3E7 0%, #FBE4C8 55%, #F8D09B 100%)'
  },
  dinner: {
    card: 'linear-gradient(180deg, #FDF1EC 0%, #F9DFCE 55%, #F5CBAE 100%)'
  }
}

// ── Меню приёма пищи на карточке ───────────────────────────────────────────
// Блюда публикует работник столовой на вкладке «Меню»; здесь ученик видит
// актуальный состав. Плейсхолдер под фото вернётся, когда поля image
// наполнятся — строка с картинкой уже предусмотрена.
function MealMenu({ dishes, published }) {
  if (!published || !dishes?.length) {
    return (
      <div
        className="mt-5 flex h-48 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed"
        style={{ borderColor: 'rgba(232, 155, 45, 0.35)', color: 'rgba(232, 155, 45, 0.55)' }}
      >
        <span className="text-[14px] font-medium">Меню ещё не опубликовано</span>
      </div>
    )
  }

  return (
    <div className="mt-5 flex-1 space-y-2.5 overflow-hidden rounded-3xl bg-white/70 p-4">
      {dishes.map((dish) => (
        <div key={dish.id} className="flex items-center gap-3">
          {dish.image ? (
            <img
              src={dish.image}
              alt=""
              draggable={false}
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-xl bg-[#F0E3CC]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-neutral-900">{dish.title}</p>
            {/* Серая строка КБЖУ */}
            <p className="text-[12px] text-neutral-400">
              {dish.kcal} ккал · Б {dish.protein} · Ж {dish.fat} · У {dish.carb}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Карточка приёма пищи ───────────────────────────────────────────────────
// pos = i - index: 0 активная, -1 предыдущая, 1 следующая.
// Drag навешан на обёртку-стопку в MealStack, здесь карточка только
// позиционируется от общего x и интерполирует масштаб/прозрачность.
function MealCard({ pos, x, meal, skin, onScan, isDragging, cardW, spacing }) {
  const done = Boolean(meal.done)

  // Нормализованное расстояние от центра: 0 = активная, 1 = сосед
  const absEp = useTransform(x, (d) => Math.min(Math.abs(pos + d / spacing), 1))

  // Глубина: активная 1/1, соседи плавно уменьшаются и затемняются
  const scale = useTransform(absEp, [0, 1], [1, 0.88])
  const opacity = useTransform(absEp, [0, 1], [1, 0.55])

  return (
    <motion.article
      style={{
        left: '50%',
        width: cardW,
        marginLeft: -cardW / 2 + pos * spacing,
        scale,
        opacity,
        zIndex: 10 - Math.abs(pos),
        background: skin.card
      }}
      className="absolute top-0 h-full overflow-hidden rounded-[28px] shadow-[0_14px_40px_rgba(180,120,40,0.18)]"
    >
      <div className="relative flex h-full flex-col p-6">
        {/* Шапка карточки */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[28px] font-bold leading-none" style={{ color: ACCENT }}>
              {meal.title}
            </h3>
            <p className="mt-2 text-[14px] font-medium" style={{ color: ACCENT }}>
              {meal.time}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium shadow-sm ${
              done ? 'text-white' : 'bg-white'
            }`}
            style={done ? { background: ACCENT } : { color: ACCENT }}
          >
            {done ? 'Получено ✓' : 'Ожидает'}
          </span>
        </div>

        {/* Актуальное меню приёма пищи */}
        <MealMenu dishes={meal.dishes} published={meal.published} />

        {/* Кнопка / статус */}
        <div className="mt-auto pt-2">
          {done ? (
            <div
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/70 py-4 text-[15px] font-semibold"
              style={{ color: ACCENT }}
            >
              <Check size={18} strokeWidth={2.4} />
              Получено ✓
            </div>
          ) : (
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onScan(meal)
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#F7C948] py-4 text-[15px] font-semibold text-white shadow-sm active:brightness-95"
              style={{
                opacity: isDragging ? 0.3 : 1,
                pointerEvents: isDragging ? 'none' : 'auto'
              }}
            >
              <QrCode size={18} strokeWidth={2.2} />
              Отсканировать QR
            </motion.button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

// ── Стопка приёмов пищи ─────────────────────────────────────────────────────
export default function MealStack({ meals, onScan }) {
  const [index, setIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Ширина карточки считается от контейнера, чтобы стопка тянулась
  // до краёв экрана: карточка = ширина минус отступы по бокам,
  // шаг = ширина карточки, поэтому соседи выглядывают ровно на SIDE px.
  const wrapRef = useRef(null)
  const [cardW, setCardW] = useState(0)
  const spacing = cardW

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined

    const measure = () => setCardW(Math.max(el.clientWidth - SIDE * 2, 240))
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Общий MotionValue: 0 = активная в центре, <0 = свайп влево
  const x = useMotionValue(0)

  // ── Обработчики свайпа ──────────────────────────────────────────────────
  // Drag запускаем вручную и только по горизонтали. Иначе вертикальный скролл
  // страницы, начатый пальцем на стопке, дёргал карточки: фреймер завершает
  // drag по pointercancel со накопленной горизонтальной составляющей смаха.
  const controls = useDragControls()
  const gestureRef = useRef(null) // точка касания + выбранная ось

  const onPointerDown = (e) => {
    gestureRef.current = { x: e.clientX, y: e.clientY, axis: null }
  }

  const onPointerMove = (e) => {
    const g = gestureRef.current
    if (!g || g.axis) return

    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return

    // Первое значимое движение задаёт ось всего жеста: вертикаль — прокрутка
    g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (g.axis === 'x') controls.start(e.nativeEvent ?? e)
  }

  const endGesture = () => {
    gestureRef.current = null
  }

  const onDragStart = () => setIsDragging(true)

  const onDragEnd = (_, info) => {
    setIsDragging(false)
    gestureRef.current = null
    if (!info || !spacing) return

    const dx = info.offset.x
    const dy = info.offset.y
    const vx = info.velocity.x
    const threshold = cardW * SWIPE_RATIO

    // Диагональный скролл (палец ушёл вниз сильнее, чем вбок) — не свайп
    if (Math.abs(dy) > Math.abs(dx)) {
      animate(x, 0, SPRING)
      return
    }

    if (dx <= -threshold || vx < -VELOCITY_THRESHOLD) {
      // Свайп влево → следующая карточка
      animate(x, -spacing, { ...SPRING }).then(() => {
        setIndex((i) => Math.min(i + 1, meals.length - 1))
        x.set(0)
      })
    } else if (dx >= threshold || vx > VELOCITY_THRESHOLD) {
      // Свайп вправо → предыдущая карточка
      animate(x, spacing, { ...SPRING }).then(() => {
        setIndex((i) => Math.max(i - 1, 0))
        x.set(0)
      })
    } else {
      // Не дошли до порога — возврат
      animate(x, 0, SPRING)
    }
  }

  return (
    <section>
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        className="relative h-[540px] touch-pan-y select-none overflow-hidden"
      >
        {/* Обёртка-стопка: drag на ней двигает все карточки жёстко,
            а scale/opacity создают эффект глубины. Слушатель фреймера
            выключен (dragListener={false}) — старт решает наш обработчик. */}
        <motion.div
          style={{ x }}
          drag="x"
          dragListener={false}
          dragControls={controls}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragTransition={{ bounceDamping: 18, bounceStiffness: 500 }}
          dragMomentum={true}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="absolute inset-0"
        >
          {cardW > 0 &&
            meals.map((meal, i) => {
              const skin = SKINS[meal.id] ?? SKINS.lunch
              const pos = i - index

              return (
                <MealCard
                  key={meal.id}
                  pos={pos}
                  x={x}
                  meal={meal}
                  skin={skin}
                  onScan={onScan}
                  isDragging={isDragging}
                  cardW={cardW}
                  spacing={spacing}
                />
              )
            })}
        </motion.div>
      </div>
    </section>
  )
}
