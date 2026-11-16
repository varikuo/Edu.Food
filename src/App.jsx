import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import Auth from './components/Auth'
import Kitchen from './components/Kitchen'
import MealPicker from './components/MealPicker'
import MealStack from './components/MealStack'
import BottomNav from './components/BottomNav'
import QrScanner from './components/QrScanner'
import Kbju from './components/Kbju'
import Baking from './components/Baking'
import BakingPublish from './components/BakingPublish'
import MenuPublish from './components/MenuPublish'
import Attendance from './components/Attendance'
import Profile from './components/Profile'
import SplashScreen from './components/SplashScreen'
import { getAttendanceToday, getMenu, getToken, me, scanAttendance, setToken } from './lib/api'
import { requestCamera, stopStream } from './lib/camera'

const MEALS = [
  { id: 'breakfast', title: 'Завтрак', time: '09:45 - 10:15' },
  { id: 'lunch', title: 'Обед', time: '13:35 - 14:35' },
  { id: 'dinner', title: 'Ужин', time: '18:00 - 18:30' }
]

// Минимальное время показа заставки: при быстром ответе API она не мелькнёт
const SPLASH_MIN_MS = 1800

export default function App() {
  const [tab, setTab] = useState('home')
  const [scan, setScan] = useState(null)
  const [done, setDone] = useState({})
  const [menu, setMenu] = useState(null)
  const [toast, setToast] = useState('')
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [splash, setSplash] = useState(true)
  const [splashMinDone, setSplashMinDone] = useState(false)
  const streamRef = useRef(null)

  // Минимальное время показа заставки считаем от запуска приложения
  useEffect(() => {
    const id = setTimeout(() => setSplashMinDone(true), SPLASH_MIN_MS)
    return () => clearTimeout(id)
  }, [])

  // Заставка уходит, только когда выполнены оба условия: загрузка профиля
  // закончилась и минимальное время показа вышло
  useEffect(() => {
    if (splash && splashMinDone && !booting) setSplash(false)
  }, [splash, splashMinDone, booting])

  // Проверяем сохранённый токен: если он протух — разлогиниваемся молча
  useEffect(() => {
    if (!getToken()) {
      setBooting(false)
      return
    }
    me()
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false))
  }, [])

  const isStaff = user?.role === 'staff'

  // Ученику при входе нужны опубликованное меню и сегодняшние QR-отметки
  useEffect(() => {
    if (!user || isStaff) return
    getMenu().then(setMenu).catch(() => {})
    getAttendanceToday()
      .then((data) => setDone(Object.fromEntries(data.slots.map((s) => [s, true]))))
      .catch(() => {})
  }, [user, isStaff])

  const logout = () => {
    setToken(null)
    setUser(null)
    setTab('home')
  }

  // getUserMedia запускаем прямо в обработчике клика: iOS Safari отклоняет
  // запрос камеры, сделанный вне пользовательского жеста. Потоком владеет App —
  // иначе размонтирование сканера (или двойной монтаж StrictMode) гасит камеру.
  const startCamera = () =>
    requestCamera().then((stream) => {
      stopStream(streamRef.current)
      streamRef.current = stream
      return stream
    })

  const openScanner = () => setScan({ promise: startCamera() })

  const retryCamera = () =>
    setScan((prev) => (prev ? { ...prev, promise: startCamera() } : prev))

  const closeScanner = () => {
    scan?.promise.then(stopStream).catch(() => {})
    stopStream(streamRef.current)
    streamRef.current = null
    setScan(null)
  }

  // Приём пищи определяет сканер по содержимому QR — не по карточке
  const confirmScan = async (slot) => {
    try {
      const { already } = await scanAttendance(slot)
      setDone((prev) => ({ ...prev, [slot]: true }))
      setToast(already ? 'Ты уже отмечен на этот приём пищи' : 'Отмечено, приятного аппетита!')
    } catch (err) {
      setToast(err.message)
    }
    closeScanner()
  }

  // Меню публикует работник — ученику достаточно переоткрыть вкладку
  const reloadMenu = () => getMenu().then(setMenu).catch(() => {})

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(id)
  }, [toast])

  // Экран по умолчанию: пока профиль не пришёл под заставкой — форма входа.
  // Отдельной заглушки «загружаем» не нужно: её закрывает заставка.
  return (
    <div className="relative min-h-screen w-[390px] max-w-full bg-white mx-auto">
      <AnimatePresence>{splash && <SplashScreen key="splash" />}</AnimatePresence>

      {!user ? (
        <Auth onAuthed={setUser} />
      ) : (
        <>
          {tab === 'home' && isStaff && <Kitchen user={user} />}
          {tab === 'menu' && isStaff && <MenuPublish onPublished={reloadMenu} />}
          {tab === 'baking' && isStaff && <BakingPublish />}
          {tab === 'attendance' && isStaff && <Attendance />}

          {tab === 'home' && !isStaff && (
            <>
              <Header user={user} onProfile={() => setTab('profile')} />
              <main className="px-5 pt-6">
                <MealPicker meals={MEALS} />
                {/* -mx-5 выводит стопку за поля main — карточки до краёв экрана */}
                <div className="mt-7 -mx-5">
                  <MealStack
                    meals={MEALS.map((m) => ({
                      ...m,
                      done: Boolean(done[m.id]),
                      dishes: menu?.slots?.[m.id]?.dishes,
                      published: Boolean(menu?.slots?.[m.id]?.published)
                    }))}
                    onScan={openScanner}
                  />
                </div>
              </main>
            </>
          )}

          {tab === 'stats' && <Kbju />}
          {tab === 'menu' && !isStaff && <Baking />}
          {tab === 'profile' && <Profile user={user} onLogout={logout} />}

          {/* Отступ, чтобы плавающая панель не перекрывала контент */}
          <div className="h-28" />

          <BottomNav active={tab} onChange={setTab} role={user.role} />
        </>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-50 w-[390px] max-w-full -translate-x-1/2 px-6">
          <p className="rounded-2xl bg-neutral-900/90 px-4 py-3 text-center text-[14px] font-medium text-white shadow-lg">
            {toast}
          </p>
        </div>
      )}

      {scan && (
        <QrScanner
          streamPromise={scan.promise}
          onRetry={retryCamera}
          onClose={closeScanner}
          onConfirm={confirmScan}
        />
      )}
    </div>
  )
}
