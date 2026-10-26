import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        parceiro: resolve(__dirname, 'parceiro.html'),
        curso: resolve(__dirname, 'curso.html'),
        profissional: resolve(__dirname, 'profissional.html'),
      },
    },
  },
})
