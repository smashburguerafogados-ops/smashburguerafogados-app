# Smash Burguer Afogados

Static Vite + React + TypeScript app for GitHub Pages. Stage 1 is the splash, customer registration, and sign-in. The interface is in Portuguese.

The original mark is `public/logo.jpg`. The interface uses `public/logo.png`, the same drawing with the flat background removed.

Pages URL (after merge and the Pages source is GitHub Actions):

https://smashburguerafogados-ops.github.io/smashburguerafogados-app/

## Scripts

```bash
npm install
npm run dev
npm run build
npm run check:identity
```

Dev server: http://127.0.0.1:5173/smashburguerafogados-app/

The Firebase web config in `.env.development` and `.env.production` is the public client config. It is not a server secret. Do not add private keys or a service account to those files.

## Sign-in: WhatsApp + senha

Register and login both ask for **WhatsApp** and **senha**. There is no separate passwordless flow.

Firebase Auth is email/password. The email is synthetic and is not shown on the form:

`{whatsappNormalizado}@customers.smashburguerafogados.app`

Normalization, digits only:

- National number with DDD, 10 or 11 digits, gains the country code `55`.
- A number that already starts with `55` and has 12 or 13 digits stays as it is.
- `(87) 98888-7777` and `+55 87 98888-7777` both become `5587988887777@customers.smashburguerafogados.app`.

The senha is the Firebase password (minimum 6 characters). It is stored by Firebase Auth, not in the Firestore document, not in `localStorage`, and not in `sessionStorage`. The session uses Firebase local persistence, so a refresh keeps the person signed in. The next visit loads `users/{uid}`.

On register the app creates the Auth user and the document `users/{uid}` with `uid`, `nome`, `whatsapp`, `address`, and `role: "customer"`.

Address: the CEP is looked up at `https://viacep.com.br/ws/{cep}/json/`. When it exists, street, neighborhood, and city are filled and número is still required. Ponto de referência is optional. When it does not exist, endereço, número, bairro, and cidade are typed. Referência stays optional.

## Admin

Admin is not a password in this repo. There is no admin password and no hidden login string in the source.

Admin is a Firebase Auth user whose `users/{uid}` document has `role: "admin"`. The route `/admin` renders an empty panel only for that role. Anyone else sees "Acesso restrito".

Jameson: create that user in the Firebase console. Do not put the password in the repository or in chat.

1. Authentication → Add user.
2. Email: the synthetic address for the WhatsApp he will type in the app, using the rule above.
3. Password: one he chooses and keeps outside the repo.
4. Copy the UID.
5. Firestore → collection `users` → document ID = that UID.
6. Fields: `uid` (string, same UID) and `role` (string) `admin`.

Do not register that WhatsApp through the app. The app always writes `role: "customer"`, and `firestore.rules` reject any other role on create. The console bypasses those rules.

The same rules only allow a signed-in user to read and write `users/{their uid}`. The admin screen does not list customers.

## Firebase console, still required

1. Authentication → Sign-in method → enable **Email/Password**.
2. Authentication → Settings → Authorized domains → add `smashburguerafogados-ops.github.io`. `localhost` is already there for dev.
3. Create the Firestore database if it does not exist.
4. Publish `firestore.rules` (Firestore → Rules, or `firebase deploy --only firestore:rules` from this folder). Until this is published, customer profiles cannot be saved under the locked rules, and a database left in test mode is open.
5. Create the admin user as described above.
6. GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions**. The workflow `.github/workflows/pages.yml` builds and deploys on push to `main`. It does not print config values.

## Connection check

`npm run check:firebase` is a one-time dev script. It writes a document in `connection_tests` and deletes it. It is not part of the UI.

Create the Firestore database first. Then run the script once, while the database is still open, and only after that publish `firestore.rules`. After the rules are published, `connection_tests` is denied and the script fails with `permission-denied`. That failure is the locked state. Do not reopen the collection.

As of this stage, the Firestore API was not enabled on `smashburguerafogados-ae50a`, so the write could not be completed from here. The script reports that case instead of treating it as a rules lock.

## Out of scope

Menu, orders, sending WhatsApp messages, and the refrigeração repository.
