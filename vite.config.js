import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// relative base + docs/ output so GitHub Pages can serve main:/docs
export default defineConfig({ plugins: [react()], base: './', build: { outDir: 'docs' } })
