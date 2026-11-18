#!/usr/bin/env node
// Dev-only connectivity check. Not imported by the app and not shown in the UI.
// Writes connection_tests/{id}, then deletes it.
// After firestore.rules are published, this collection is denied and the
// script fails with permission-denied. That is the locked state.
// Do not log Firebase config values.

import { readFileSync } from 'node:fs'
import { initializeApp, setLogLevel } from 'firebase/app'
import { deleteDoc, doc, getFirestore, setDoc } from 'firebase/firestore/lite'

setLogLevel('silent')

function loadEnv(path) {
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1)
  }
  return env
}

function safe(error) {
  const message = error instanceof Error ? `${error.code ?? ''} ${error.message}` : String(error)
  return message.replace(/AIza[0-9A-Za-z_-]+/g, '[redacted]')
}

if (process.env.NODE_ENV === 'production') {
  console.error('connection check is dev-only')
  process.exit(1)
}

const env = loadEnv(new URL('../.env.development', import.meta.url))
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

const db = getFirestore(app)
const id = `dev-${Date.now()}`
const ref = doc(db, 'connection_tests', id)

try {
  await setDoc(ref, {
    ok: true,
    purpose: 'dev-connection-check',
    createdAt: new Date().toISOString(),
  })
  await deleteDoc(ref)
  console.log(`connection_tests/${id} written and deleted`)
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const message = safe(error)
  if (/has not been used|is disabled|firestore\.googleapis\.com|denied on the service/i.test(message)) {
    console.error(
      'Firestore is not enabled for this project yet. Create the database in the Firebase console, run this check once before publishing firestore.rules, then publish the rules.',
    )
    process.exit(1)
  }
  if (code === 'permission-denied') {
    console.error('connection_tests is locked. That is expected after firestore.rules are published.')
    process.exit(1)
  }
  console.error(message)
  try {
    await deleteDoc(ref)
  } catch {
    // The write may never have landed.
  }
  process.exit(1)
}
