export default function Header({ user, onProfile }) {
  const name = (user?.fio ?? '').split(' ')[1] ?? ''
  const today = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })

  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-8">
      <div>
        <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.01em] text-neutral-900">
          Добрый день{name ? `, ${name}` : ''}!
        </h1>
        <p className="mt-1.5 text-sm text-neutral-400">Сегодня {today}.</p>
      </div>

      {/* Плейсхолдер аватарки: открывает вкладку профиля */}
      <button
        type="button"
        onClick={onProfile}
        aria-label="Профиль"
        className="mt-1 h-11 w-11 shrink-0 rounded-full bg-neutral-300 ring-1 ring-neutral-200 transition-transform active:scale-95"
      />
    </header>
  )
}
