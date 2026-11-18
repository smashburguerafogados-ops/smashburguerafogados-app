# Smash Burguer Afogados

Static Vite + React + TypeScript app for GitHub Pages. The splash leads straight into the menu. Customer registration stays available from the account button. The interface is in Portuguese.

The original mark is `public/logo.jpg`. The interface uses `public/logo.png`, the same drawing with the flat background removed.

Pages URL (after merge and the Pages source is GitHub Actions):

https://smashburguerafogados-ops.github.io/smashburguerafogados-app/

## Scripts

```bash
npm install
npm test
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

On the menu, a long press on the logo asks for that Firebase email and password. It does not use the customer WhatsApp form, and the password is not stored in this repo. A customer who tries it stays on the cardápio.

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

## Menu

After the splash the cardápio is open. There is no login wall. Category chips filter the list; there is no "Geral" chip. Tapping the active chip returns to every item, and the choice is kept in `sessionStorage` (`smash.category`). Search, a sold-out state, item notes, and the cart are on the same screen.

The sample cardápio in `src/data/catalog.ts` is what visitors see until Firestore has categories and products. Prices in Firestore are reais (a number such as `28`). Public reads use `where('available', '==', true)`, so sold-out products stay hidden from customers once the rules are published.

## Bottom bar

A floating pill sits above the bottom edge: Conta, Carrinho, WhatsApp. The active item is a gold pill with its short label. The other items are icons. The cart always shows the count and the total.

`BUSINESS_WHATSAPP` in `src/lib/whatsapp.ts` is the placeholder `5500000000000`. The button opens `https://wa.me/5500000000000`. Replace that constant with the shop number when it is known. It is not a secret, and the app does not send a message by itself.

## Fire

The splash background is `public/fire.mp4` (958,356 bytes, about 936 KB), a 4.5 second silent H.264 loop at 640×854. The player runs it at half speed (`playbackRate` 0.5) so the flame stays calm. `public/fire-poster.jpg` (23,387 bytes) is the still frame used before playback and when reduced motion is on.

Source: Cary Bass, File:Fire.ogv, own work, 3 March 2007, Wikimedia Commons.
https://commons.wikimedia.org/wiki/File:Fire.ogv

License: public domain (`{{PD-self}}`). The copyright holder released the work into the public domain worldwide and, where that is not legally possible, granted use for any purpose without conditions unless the law requires them. Audio was removed. The file is committed in this repo; the page does not hotlink Commons. See `public/fire-license.txt`.

## Rules to publish

`firestore.rules` still locks each customer to `users/{their uid}` and denies `connection_tests`. It now also allows anyone to read `categories`, and to read `products` only when `available == true` (an admin may read the rest). Writes to those two collections require `users/{uid}.role == 'admin'`. Publish the file before expecting the live menu to replace the sample data. The sample cardápio remains if the read fails.

## Out of scope

Orders, sending WhatsApp messages, and the refrigeração repository.
