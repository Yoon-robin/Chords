import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages(/Chords/)에서도 경로가 맞도록 상대 경로로 빌드
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
