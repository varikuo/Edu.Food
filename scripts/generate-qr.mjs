// Генерация трёх статичных QR-кодов для отметки у входа в столовую.
// Запуск: npm run qr
// Результат: public/qr/breakfast.png, lunch.png, dinner.png + лист A4 print.html

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const root = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(root, '..', 'public', 'qr')
fs.mkdirSync(outDir, { recursive: true })

const SLOTS = [
  { key: 'breakfast', label: 'Завтрак', time: '09:45 — 10:15' },
  { key: 'lunch', label: 'Обед', time: '13:35 — 14:35' },
  { key: 'dinner', label: 'Ужин', time: '18:00 — 18:30' }
]

for (const slot of SLOTS) {
  const data = `mealqr:${slot.key}`
  const file = path.join(outDir, `${slot.key}.png`)
  await QRCode.toFile(file, data, { width: 1024, margin: 2 })
  console.log(`[qr] ${slot.label} → ${path.relative(root, file)}  (${data})`)
}

// Лист A4 для печати у входа в столовую
const printHtml = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QR-коды для отметки — Edu.Food</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: sans-serif; text-align: center; margin: 0; padding: 10mm; }
  h1 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0 0 16px; font-size: 13px; color: #555; }
  .row { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
  .item { width: 300px; }
  .item img { width: 240px; height: 240px; display: block; margin: 0 auto; }
  .item h2 { margin: 8px 0 4px; font-size: 16px; }
  .item p { margin: 0; font-size: 12px; color: #777; }
</style>
</head>
<body>
  <h1>Отметка у входа в столовую</h1>
  <p>Наведите камеру телефона на QR-код приёма пищи</p>
  <div class="row">
    ${SLOTS.map((s) => `
    <div class="item">
      <img src="${s.key}.png" alt="${s.label}">
      <h2>${s.label}</h2>
      <p>${s.time}</p>
    </div>`).join('')}
  </div>
</body>
</html>`

fs.writeFileSync(path.join(outDir, 'print.html'), printHtml, 'utf8')
console.log('[qr] print.html — лист A4 для печати')
