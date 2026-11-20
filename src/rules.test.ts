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
    const reads = products.match(/allow read:.*;/g) ?? []
    expect(reads).toEqual([
      'allow read: if isAdmin();',
      'allow read: if resource.data.available == true;',
    ])
    expect(reads[0]).not.toContain('resource.data')
    expect(products).toContain('allow write: if isAdmin();')
    expect(products).not.toMatch(/allow delete: if (?!isAdmin)/)
    const categories = block('categories')
    expect(categories).toContain('allow read: if true;')
    expect(categories).toContain('allow write: if isAdmin();')
    const addons = block('addons')
    expect(addons).toContain('allow read: if true;')
    expect(addons).toContain('allow create, update: if addonWrite();')
    expect(addons).toContain('allow delete: if isAdmin();')
    expect(addons).not.toContain('||')
    expect(rules).toContain("data.keys().hasOnly(['name', 'price'])")
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

  it('lets an admin list customers on its own rule', () => {
    const users = block('users')
    const reads = users.match(/allow read:.*;/g) ?? []
    expect(reads).toEqual(['allow read: if isAdmin();', 'allow read: if signedInAs(userId);'])
    expect(reads[0]).not.toContain('resource.data')
    expect(users).not.toContain('allow read: if isAdmin() ||')
  })

  it('lets everyone read the shop flag and only an admin change it', () => {
    const settings = block('settings')
    expect(settings).toContain("allow read: if settingId == 'shop' || settingId == 'theme' || settingId == 'raffle';")
    expect(settings).toContain(
      "allow write: if (settingId == 'shop' || settingId == 'theme' || settingId == 'raffle') && isAdmin();",
    )
    expect(settings).toContain("allow read: if settingId == 'catalog' && isAdmin();")
    expect(settings).toContain("allow write: if settingId == 'catalog' && isAdmin();")
    expect(settings).not.toContain('isAdmin() ||')
    const dismissals = block('raffleDismissals')
    expect(dismissals).toContain('allow read: if isAdmin();')
    expect(dismissals).toContain('resource.data.customerId == request.auth.uid')
    expect(dismissals).toContain("dismissalId == request.auth.uid + '_' + request.resource.data.day")
    expect(dismissals).toContain('allow update, delete: if false;')
    expect(settings).not.toMatch(/allow write: if true/)
  })

  it('keeps a finalized amount even if the order status changes later', () => {
    const revenue = block('faturamento')
    expect(revenue).toContain('allow read: if isAdmin();')
    expect(revenue).toContain('allow create: if revenueCreate(orderId);')
    expect(revenue).toContain('allow update, delete: if false;')
    expect(rules).toContain("order.status == 'finalizado'")
    expect(rules).toContain('data.totalCents == order.totalCents')
    expect(rules).toContain('order.customerId == request.auth.uid')
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
