import { motion, useReducedMotion } from 'framer-motion'

// Заставка при запуске: жёлтый фон и фирменный силуэт бегущего с ложкой.
// Силуэт берётся готовым файлом public/figure.svg — это исходник дизайнера,
// поэтому форма точь-в-точь как в макете. Двигается он целиком, единым телом:
// лёгкая волна-покачивание вместо перерисовки по частям.
// Растворяется через AnimatePresence в App, когда профиль загружен
// и минимальное время показа вышло.

const FIGURE_SRC = '/figure.svg'

export default function SplashScreen() {
  // Системная настройка «уменьшить движение» — оставляем статичный силуэт
  const reduced = useReducedMotion()

  // Два независимых цикла разной длины: по отдельности каждый простой,
  // вместе они не совпадают по фазе и движение читается живым, а не механическим
  const bob = reduced ? { y: 0 } : { y: [-5, 5] }
  const sway = reduced
    ? { rotate: 0, skewX: 0 }
    : { rotate: [-2.2, 2.2], skewX: [-2.5, 2.5] }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(180deg, #FCC24E 0%, #FCD87E 100%)' }}
    >
      {/* Появление заставки */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-[78%] max-w-[300px]"
      >
        {/* Волна: вертикальное покачивание всего тела */}
        <motion.div
          animate={bob}
          transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
        >
          {/* Волна: наклон и перекос вокруг точки у ног — «шаг на месте» */}
          <motion.div
            animate={sway}
            transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
            style={{ transformOrigin: '50% 92%' }}
          >
            <img
              src={FIGURE_SRC}
              alt="Edu.Food"
              draggable={false}
              className="w-full select-none"
            />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Подпись в тон фона */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="mt-2 text-[26px] font-bold tracking-[-0.02em]"
        style={{ color: 'rgba(140, 88, 10, 0.75)' }}
      >
        Edu.Food
      </motion.p>
    </motion.div>
  )
}
