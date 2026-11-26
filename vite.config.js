import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// MORPH runs entirely in the browser: no network calls, no third-party scripts.
// The policy below allows only the app's own files, plus data:/blob: URLs for
// exported images, videos and imported pictures.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React sets inline style attributes
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

// Put the policy into the built page too, so it travels with any static host.
const cspMeta = {
  name: 'morph-csp-meta',
  apply: 'build',
  transformIndexHtml(html) {
    // frame-ancestors only works as a header, so the meta copy leaves it out
    const metaPolicy = CSP.replace("; frame-ancestors 'none'", '')
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${metaPolicy}" />`)
  },
}

export default defineConfig({
  plugins: [react(), cspMeta],
  // dev keeps the hardening headers but not the CSP (hot reload needs inline scripts)
  server: { port: 5181, strictPort: true, host: 'localhost', headers: HEADERS },
  preview: { headers: { ...HEADERS, 'Content-Security-Policy': CSP } },
  build: { sourcemap: false },
})
