import assert from 'node:assert/strict'
import {
  formatCep,
  formatWhatsapp,
  maskCep,
  maskWhatsappInput,
  normalizeWhatsapp,
  whatsappToEmail,
} from '../src/lib/identity.ts'

assert.equal(normalizeWhatsapp('(87) 98888-7777'), '5587988887777')
assert.equal(normalizeWhatsapp('+55 87 98888-7777'), '5587988887777')
assert.equal(normalizeWhatsapp('87988887777'), '5587988887777')
assert.equal(normalizeWhatsapp('8733334444'), '558733334444')
assert.equal(normalizeWhatsapp('123'), null)
assert.equal(normalizeWhatsapp(''), null)
assert.equal(
  whatsappToEmail('87 98888-7777'),
  '5587988887777@customers.smashburguerafogados.app',
)
assert.equal(maskCep('01001000'), '01001-000')
assert.equal(formatCep('01001000'), '01001-000')
assert.equal(maskWhatsappInput('87988887777'), '(87) 98888-7777')
assert.equal(formatWhatsapp('5587988887777'), '+55 (87) 98888-7777')

console.log('identity ok')
