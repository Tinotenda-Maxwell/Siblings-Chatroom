import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The Supabase client and the chat route are loaded with dynamic import(), so
// by default the browser only discovers them after the entry chunk has been
// downloaded, parsed and executed. Advertise them in index.html with
// <link rel="modulepreload"> so they download in parallel with the entry.
function preloadChunks(names: string[]): Plugin {
  let base = '/'
  return {
    name: 'preload-chunks',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return
        return Object.values(ctx.bundle)
          .filter(
            (chunk) =>
              chunk.type === 'chunk' && chunk.isDynamicEntry && names.includes(chunk.name),
          )
          .map((chunk) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: true, href: base + chunk.fileName },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadChunks(['supabase', 'ChatPage'])],
  build: {
    rolldownOptions: {
      output: {
        // Keep framework code in its own chunk. It changes far less often
        // than app code, so returning visitors keep it cached across deploys.
        advancedChunks: {
          groups: [{ name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-router)/ }],
        },
      },
    },
  },
})
