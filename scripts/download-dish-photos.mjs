// Скачивание фото блюд из Wikimedia Commons в public/menu.
// Все файлы — под свободными лицензиями (Public domain / CC0 / CC BY / CC BY-SA),
// лицензия указана рядом с каждым файлом.
// Запуск: node scripts/download-dish-photos.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(root, '..', 'public', 'menu')

// [файл в проекте, файл на Commons, лицензия]
const PHOTOS = [
  ['oatmeal.jpg', 'File:Oatmeal (1).jpg', 'Public domain'],
  ['syrniki.jpg', 'File:Сирники.JPG', 'CC BY-SA 3.0'],
  ['omelet.jpg', 'File:Tomato Omelette1.JPG', 'Public domain'],
  ['blini.jpg', 'File:Blini Tanya.jpg', 'Public domain'],
  ['zapekanka.jpg', 'File:Запіканка сирна з родзинками 02.jpg', 'CC BY-SA 4.0'],
  ['rice-porridge.jpg', 'File:Rice Porridge in Texas.jpg', 'CC BY-SA 4.0'],
  ['borsch.jpg', 'File:Russian borscht with beef and sour cream.jpg', 'CC BY 2.0'],
  ['plov.jpg', 'File:Spicy Chicken Pilau (4684623071).jpg', 'CC BY-SA 2.0'],
  ['pure.jpg', 'File:Kotlet z piersi kurczaka w panierce z ziemniakami - 2024.01.16.jpg', 'CC BY-SA 4.0'],
  ['shchi.jpg', 'File:Schi.jpg', 'Public domain'],
  ['buckwheat-cutlet.jpg', 'File:Tejfölös csirke hajdinával.jpg', 'CC BY-SA 3.0'],
  ['macaroni-cheese.jpg', 'File:Mac-N-Cheese Pasta.jpg', 'CC BY-SA 4.0'],
  ['vegetable-salad.jpg', 'File:Vegetable Salad Cuisine.jpg', 'CC BY-SA 4.0'],
  ['fish.jpg', 'File:Cajun Grilled Fish, Savoury Rice and Mixed Baked Vegetables (17459785061).jpg', 'CC BY 2.0'],
  ['salad.jpg', 'File:Chicken salad with eggs.jpg', 'CC BY-SA 4.0'],
  ['chicken-potato.jpg', 'File:Roasted Chicken, Butterflied, on Potatoes, Baking Pan 01.jpg', 'CC BY-SA 3.0'],
  ['vegetable-stew-rice.jpg', 'File:White rice with vegetable stew.jpg', 'CC BY-SA 4.0'],
  ['curd-pudding.jpg', 'File:Pudding of curd 001.jpg', 'CC BY-SA 3.0']
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

fs.mkdirSync(outDir, { recursive: true })

for (const [file, commonsFile, license] of PHOTOS) {
  const name = commonsFile.replace(/^File:/, '')
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=800`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MealQR/1.0 (school project; dish photos)' }
  })
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)

  const type = res.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) throw new Error(`${file}: не картинка (${type})`)

  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(path.join(outDir, file), buf)
  console.log(`${file}: ${Math.round(buf.length / 1024)} КБ, ${license}, ${commonsFile}`)

  await sleep(1200)
}
