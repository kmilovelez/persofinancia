import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['hgvgjwvwiycuxcebqfvx.supabase.co'],
  },
}

export default withPWA(nextConfig)
