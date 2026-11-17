// Поиск фото блюд в Wikimedia Commons: печатает кандидатов с лицензией.
// Запуск: node scripts/find-dish-photos.mjs
const QUERIES = [
  ['Каша овсяная на молоке', 'oatmeal porridge milk bowl'],
  ['Сырники со сметаной', 'syrniki'],
  ['Омлет с помидором', 'omelette tomato'],
  ['Борщ со сметаной', 'borscht sour cream'],
  ['Плов с курицей', 'pilaf chicken rice'],
  ['Пюре с котлетой', 'mashed potatoes cutlet'],
  ['Рыба запечённая с овощами', 'baked fish vegetables'],
  ['Салат с курицей', 'chicken salad'],
  ['Блины с творогом', 'blini'],
  ['Творожная запеканка', 'творожная запеканка'],
  ['Каша рисовая молочная', 'rice porridge'],
  ['Щи из свежей капусты', 'shchi'],
  ['Гречка с куриной котлетой', 'buckwheat chicken'],
  ['Макароны с сыром', 'pasta cheese'],
  ['Салат из свежих овощей', 'vegetable salad'],
  ['Куриная запеканка с картофелем', 'chicken casserole'],
  ['Овощное рагу с рисом', 'vegetable stew rice'],
  ['Творожный пудинг', 'curd pudding']
]

const API = 'https://commons.wikimedia.org/w/api.php'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Commons ограничивает частоту запросов: идём с паузой и повтором при отказе
async function search(query, attempt = 1) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '800'
  })

  const res = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': 'MealQR/1.0 (school project; dish photo search)' }
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (attempt < 4) {
      await sleep(5000 * attempt)
      return search(query, attempt + 1)
    }
    throw new Error(`Commons ответил не JSON: ${text.slice(0, 80)}`)
  }
}

// Фильтр по названию блюда: node scripts/find-dish-photos.mjs Блины
const only = process.argv[2]
const queries = only ? QUERIES.filter(([title]) => title.includes(only)) : QUERIES

for (const [title, query] of queries) {
  const data = await search(query)
  const pages = Object.values(data.query?.pages ?? {})

  console.log(`\n=== ${title} ===`)
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    const meta = info.extmetadata ?? {}
    const license = meta.LicenseShortName?.value ?? '?'
    console.log(`- ${page.title}`)
    console.log(`  license: ${license}`)
    console.log(`  thumb:   ${info.thumburl}`)
  }
  await sleep(2500)
}
