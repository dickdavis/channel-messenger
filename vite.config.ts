import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { sessionHub } from './src/vite-plugin-session-hub'

export default defineConfig({
  plugins: [sveltekit(), sessionHub()]
})
