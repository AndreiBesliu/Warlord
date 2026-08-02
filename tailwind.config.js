/** @type {import('tailwindcss').Config} */
import { warlordColors } from './tailwind.warlord.js'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: { extend: { colors: warlordColors } },
  plugins: [],
}
