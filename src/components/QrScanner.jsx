import { useEffect, useRef, useState } from 'react'
import { Camera, Check, X } from 'lucide-react'
import jsQR from 'jsqr'
import { describeCameraError } from '../lib/camera'

const SLOT_TITLES = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' }
const SCAN_MS = 250 // частота разбора кадра
// Разбор в 900 px: на распечатанном A4 коды крупные, но на телефоне кадр
// всё равно приходит с шумом — в 360 px модули слипались и код не читался
const SCAN_WIDTH = 900
const HINT_MS = 5000 // через сколько секунд без результата показать подсказку

// Короткая вибрация — телефон подтвердит, что код пойман
function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
}

// Сканер у входа: три статичных QR (завтрак/обед/ужин). Кадр разбирается
// jsQR каждые 250 мс; приём пищи определяется по содержимому кода
// ("mealqr:lunch"), а не по тому, с какой карточки открыли сканер.
export default function QrScanner({ streamPromise, onRetry, onClose, onConfirm }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const watchdogRef = useRef(null)
  const [state, setState] = useState('requesting') // requesting | live | error
  const [error, setError] = useState('')
  const [stalled, setStalled] = useState(false)
  const [detected, setDetected] = useState(null) // 'breakfast' | 'lunch' | 'dinner'
  const [foreign, setForeign] = useState(false) // в кадре QR не столовой
  const [hint, setHint] = useState(false) // долго не распознаёт — подсказать как навести

  // Поток создаёт и останавливает родитель (внутри клика). Здесь поток только
  // подключается к <video>: прежняя остановка потока в этом эффекте на двойном
  // монтировании StrictMode убивала камеру — на экране оставалась заглушка.
  useEffect(() => {
    let cancelled = false
    setState('requesting')
    setError('')
    setStalled(false)
    setDetected(null)
    setForeign(false)
    watchdogRef.current = setTimeout(() => setStalled(true), 6000)

    streamPromise.then(
      (stream) => {
        if (cancelled) return
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.play().catch(() => {})
      },
      (err) => {
        if (cancelled) return
        clearTimeout(watchdogRef.current)
        setState('error')
        setError(describeCameraError(err))
      }
    )

    return () => {
      cancelled = true
      clearTimeout(watchdogRef.current)
    }
  }, [streamPromise])

  // ── Расшифровка кадра ───────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'live' || detected) return undefined

    let busy = false // разбор в 900 px может длиться дольше тика — не накладываем

    const tick = () => {
      if (busy) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) return

      busy = true
      try {
        // Уменьшаем кадр: разбор быстрее, опознаёт всё равно надёжно
        const w = Math.min(SCAN_WIDTH, video.videoWidth || SCAN_WIDTH)
        const h = Math.round((video.videoHeight / video.videoWidth) * w) || Math.round(w * 0.75)
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(video, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        // attemptBoth ловит и тёмные модули на светлой бумаге, и блики на листе
        const code = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' })
        if (!code?.data) return

        const match = /^mealqr:(breakfast|lunch|dinner)$/.exec(code.data.trim())
        if (match) {
          vibrate([40, 40, 40])
          setDetected(match[1])
        } else setForeign(true)
      } finally {
        busy = false
      }
    }

    const id = setInterval(tick, SCAN_MS)
    return () => clearInterval(id)
  }, [state, detected])

  // Если несколько секунд ничего не опознано — подсказать, как правильно навести
  useEffect(() => {
    if (state !== 'live' || detected) {
      setHint(false)
      return undefined
    }
    const id = setTimeout(() => setHint(true), HINT_MS)
    return () => clearTimeout(id)
  }, [state, detected])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // «Живая» камера = пошёл реальный кадр, а не просто резолв промиса
  const markLive = () => {
    clearTimeout(watchdogRef.current)
    setStalled(false)
    setState('live')
  }

  const showRetry = state === 'error' || (state === 'requesting' && stalled)

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900">
      <div className="relative mx-auto h-full w-[390px] max-w-full overflow-hidden">
        {/* Видеопоток с камеры */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onPlaying={markLive}
          onCanPlay={() => videoRef.current?.play().catch(() => {})}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Кадр для расшифровки — невидимый, нужны только пиксели canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Заглушка, пока реального кадра нет */}
        {state !== 'live' && (
          <div className="absolute inset-0 bg-neutral-800 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />
        )}

        {/* Затемнение поверх видео */}
        <div className="absolute inset-0 bg-neutral-900/30" />

        {/* Верхняя панель */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-5 pt-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть сканер"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-100"
          >
            <X size={18} strokeWidth={2} />
          </button>
          <p className="text-sm font-medium text-neutral-100">Отметка в столовой</p>
          <span className="shrink-0 rounded-full bg-neutral-800/80 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
            {typeof isSecureContext !== 'undefined' && isSecureContext ? 'https' : 'http'}
          </span>
        </div>

        {/* Рамка-прицел */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`relative h-[220px] w-[220px] ${detected ? 'opacity-0' : ''}`}>
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-neutral-100" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-neutral-100" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-neutral-100" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-neutral-100" />
            {state === 'live' && (
              <span className="absolute inset-x-3 h-[2px] animate-scanline rounded-full bg-neutral-100/80" />
            )}
          </div>
        </div>

        {/* Подсказка / результат / ошибка */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-10">
          <p className="mb-5 min-h-[54px] text-center text-[13px] leading-snug text-neutral-300">
            {state === 'live' && !detected && !foreign && !hint &&
              'Наведите камеру на QR-код приёма пищи у входа'}
            {state === 'live' && !detected && !foreign && hint &&
              'Держите телефон ровно и поднесите камеру ближе к коду — так он распознается быстрее'}
            {state === 'live' && foreign && !detected &&
              'Это чужой QR-код — найдите табличку завтрака, обеда или ужина'}
            {detected && (
              <span className="text-[16px] font-semibold text-white">
                Обнаружен: {SLOT_TITLES[detected]}
              </span>
            )}
            {state === 'error' && error}
            {state === 'requesting' &&
              (stalled
                ? 'Камера не отдаёт кадр. Проверьте, что адрес начинается с https:// (или localhost), и обновите страницу.'
                : 'Запрашиваем доступ к камере…')}
          </p>

          {/* Повторный запрос камеры — тоже из обработчика клика (требование iOS) */}
          {showRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-500 py-4 text-[15px] font-medium text-neutral-100 active:bg-neutral-800"
            >
              <Camera size={18} strokeWidth={2} />
              Включить камеру
            </button>
          )}

          {detected && (
            <button
              type="button"
              onClick={() => onConfirm(detected)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-100 py-4 text-[15px] font-medium text-neutral-900 active:bg-white"
            >
              <Check size={18} strokeWidth={2.2} />
              Отметить «{SLOT_TITLES[detected]}»
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full py-2 text-center text-[13px] text-neutral-400"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
