import { BarChart2, CalendarCheck, ChefHat, Donut, Home, User, UtensilsCrossed } from 'lucide-react'

const TABS = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'stats', label: 'КБЖУ', icon: BarChart2 },
  { id: 'menu', label: 'Выпечка', icon: Donut },
  { id: 'profile', label: 'Профиль', icon: User }
]

// У работника столовой свои вкладки: сводка порций, публикация меню и
// выпечки, отчёт посещаемости для бухгалтерии
const STAFF_TABS = [
  { id: 'home', label: 'Порции', icon: ChefHat },
  { id: 'menu', label: 'Меню', icon: UtensilsCrossed },
  { id: 'baking', label: 'Выпечка', icon: Donut },
  { id: 'attendance', label: 'Посещаемость', icon: CalendarCheck },
  { id: 'profile', label: 'Профиль', icon: User }
]

const ORANGE = '#E89B2D'

export default function BottomNav({ active, onChange, role = 'student' }) {
  const tabs = role === 'staff' ? STAFF_TABS : TABS

  return (
    <nav className="fixed bottom-6 left-1/2 z-40 w-[390px] max-w-full -translate-x-1/2 px-4">
      <ul
        className="flex items-center justify-between rounded-full px-3 py-2 shadow-[0_14px_34px_rgba(200,130,40,0.35)]"
        style={{ background: ORANGE }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === active
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                title={tab.label}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(tab.id)}
                className="flex w-full flex-col items-center gap-1"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                  style={
                    isActive
                      ? { background: '#FFFFFF', color: ORANGE }
                      : { color: 'rgba(255,255,255,0.85)' }
                  }
                >
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                <span
                  className="text-[9px] leading-none"
                  style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.7)' }}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
