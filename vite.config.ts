import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The port comes from the environment when something else assigns it. `npm run dev` used to
// pin `--port 5173`, which meant two sessions working on two projects in this tree fought
// over the same socket and the second one silently served nothing.
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: Number(process.env.PORT) || 5173 },
})
