import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS включается отдельным режимом (npm run dev:https): iOS Safari
// разрешает getUserMedia только в защищённом контексте.
// Ключи лежат в .certs и генерируются скриптом с SAN по локальным IP.

const root = path.dirname(fileURLToPath(import.meta.url))
const keyFile = path.join(root, '.certs', 'dev-key.pem')
const certFile = path.join(root, '.certs', 'dev-cert.pem')
const hasLocalCert = fs.existsSync(keyFile) && fs.existsSync(certFile)

export default defineConfig(({ mode }) => {
  const https = mode === 'https'

  return {
    base: './', // для GitHub Pages: относительные пути вместо корневых
    plugins: https && !hasLocalCert ? [react(), basicSsl()] : [react()],
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      // Бэкенд живёт на :8787. Прокси нужен, чтобы телефон ходил в API
      // по тому же HTTPS-адресу, что и фронт, — без CORS и правок адресов.
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true
        }
      },
      https:
        https && hasLocalCert
          ? {
              key: fs.readFileSync(keyFile, 'utf8'),
              cert: fs.readFileSync(certFile, 'utf8')
            }
          : undefined
    }
  }
})

