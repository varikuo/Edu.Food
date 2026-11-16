import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import forge from 'node-forge'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const certDir = path.join(root, '.certs')
const certFile = path.join(certDir, 'dev-cert.pem')
const keyFile = path.join(certDir, 'dev-key.pem')

const DAY = 24 * 60 * 60 * 1000

function localIPv4() {
  const addresses = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal && !addresses.includes(item.address)) {
        addresses.push(item.address)
      }
    }
  }
  return addresses
}

function covers(cert) {
  const ext = cert.getExtension('subjectAltName')
  const names = new Set((ext?.altNames ?? []).map((a) => (a.type === 7 ? a.ip : a.value)))
  return ['localhost', ...localIPv4()].every((name) => names.has(name))
}

function longLived(cert) {
  return cert.validity.notAfter.getTime() - Date.now() > 30 * DAY
}

if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  const existing = forge.pki.certificateFromPem(fs.readFileSync(certFile, 'utf8'))
  if (longLived(existing) && covers(existing)) {
    console.log(`[cert] сертификат актуален: ${certFile}`)
    process.exit(0)
  }
}

const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048)
const cert = forge.pki.createCertificate()

const attrs = [{ name: 'commonName', value: 'localhost' }]
cert.publicKey = publicKey
cert.serialNumber = Date.now().toString(16)
cert.validity.notBefore = new Date(Date.now() - DAY)
cert.validity.notAfter = new Date(Date.now() + 825 * DAY)
cert.setSubject(attrs)
cert.setIssuer(attrs)

const altNames = [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }]
for (const ip of localIPv4()) altNames.push({ type: 7, ip })

cert.setExtensions([
  { name: 'basicConstraints', cA: false },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
  { name: 'extKeyUsage', serverAuth: true },
  { name: 'subjectAltName', altNames }
])
cert.sign(privateKey, forge.md.sha256.create())

fs.mkdirSync(certDir, { recursive: true })
fs.writeFileSync(certFile, forge.pki.certificateToPem(cert))
fs.writeFileSync(keyFile, forge.pki.privateKeyToPem(privateKey))

console.log(`[cert] выдан сертификат для: ${['localhost', ...localIPv4()].join(', ')}`)
