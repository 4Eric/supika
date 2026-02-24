import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const certDir = path.resolve(__dirname, '../backend/certs')

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        host: true,
        https: fs.existsSync(path.join(certDir, 'key.pem')) ? {
            key: fs.readFileSync(path.join(certDir, 'key.pem')),
            cert: fs.readFileSync(path.join(certDir, 'cert.pem'))
        } : true
    }
})
