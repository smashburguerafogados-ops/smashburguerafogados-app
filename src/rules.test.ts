import { describe, expect, it } from 'vitest'
import rules from '../firestore.rules?raw'

const sources = import.meta.glob(['./**/*.{ts,tsx,css}', '../scripts/*', '../*.{json,html,ts,md}', '../.github/**/*.yml'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function block(name: string): string {
  const start = rules.indexOf(`match /${name}/`)
  expect(start, name).toBeGreaterThan(-1)
  return rules.slice(start, rules.indexOf('\n    }', start))
}

describe('firestore.rules', () => {
  it('lets the public read available products and only admins write them', () => {
    const products = block('products')
    expect(products).toContain('allow read: if resource.data.available == true || isAdmin();')
    expect(products).toContain('allow write: if isAdmin();')
    const categories = block('categories')
    expect(categories).toContain('allow read: if true;')
    expect(categories).toContain('allow write: if isAdmin();')
    expect(rules).toContain(".data.role == 'admin'")
  })

  it('keeps orders private to their customer and the admin', () => {
    const orders = block('orders')
    const reads = orders.match(/allow read:.*;/g) ?? []
    expect(reads).toEqual([
      'allow read: if isAdmin();',
      'allow read: if request.auth != null && resource.data.customerId == request.auth.uid;',
    ])
    expect(reads[0]).not.toContain('resource.data')
    expect(orders).toContain('allow create: if orderCreate();')
    expect(orders).toContain('allow update: if isAdmin() || customerFinishes();')
    expect(orders).toContain('allow delete: if isAdmin();')
    expect(rules).toContain('data.customerId == request.auth.uid')
    expect(rules).toContain("data.status == 'novo'")
    expect(rules).toContain("resource.data.status == 'enviado'")
    expect(rules).toContain("request.resource.data.status == 'finalizado'")
    expect(rules).toContain("affectedKeys().hasOnly(['status', 'updatedAt'])")
  })

  it('still denies everything else', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
  })
})

describe('source', () => {
  it('holds no admin password or admin login name', () => {
    const banned = ['s', 'm', 'a', 's', 'h', 'a', 'd', 'm'].join('')
    const files = Object.entries(sources).filter(([path]) => !path.endsWith('rules.test.ts'))
    expect(files.length).toBeGreaterThan(20)
    for (const [path, code] of files) {
      expect(code.toLowerCase(), path).not.toContain(banned)
      expect(code, path).not.toMatch(/(password|senha)\s*[:=]\s*['"][^'"]{3,}['"]/i)
    }
  })
})
