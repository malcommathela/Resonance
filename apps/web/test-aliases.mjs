// Node-only alias shim so *.check.js can import the REAL store/commands.
// Mirrors vite.config aliases: `@/` → src, `@shared` → packages/shared.
// Never bundled (node --import only). Run checks from apps/web:
//   node --import ./register-aliases.mjs src/features/canvas/core/commands.check.js
const webRoot = new URL('./', import.meta.url)
const sharedRoot = new URL('../../packages/shared/', import.meta.url)

function withExt(base, rel) {
  return /\.(js|jsx|mjs|cjs)$/.test(rel) ? base + rel : `${base}${rel}.js`
}

export async function resolve(specifier, context, next) {
  if (specifier === '@shared' || specifier.startsWith('@shared/')) {
    const rel = specifier === '@shared' ? 'index.js' : specifier.slice('@shared/'.length)
    return { url: new URL(withExt('', rel), sharedRoot).href, shortCircuit: true }
  }
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2)
    return { url: new URL(withExt('./src/', rel), webRoot).href, shortCircuit: true }
  }
  // Vite resolves extensionless relative imports; node doesn't. Retry with .js.
  if (specifier.startsWith('.') && !/\.(js|jsx|mjs|cjs|json)$/.test(specifier)) {
    try {
      return await next(specifier, context)
    } catch {
      return { url: new URL(specifier + '.js', context.parentURL).href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
