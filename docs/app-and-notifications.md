# The GLAMNET app and push notifications

GLAMNET installs straight from the browser as a Progressive Web App (PWA):
there is nothing to publish to an app store. This note covers what the team
sets up once, and what to send customers and vendors.

## For customers and vendors

Send people to **`/install`** (also linked as **Get the app** in the footer and
the account menu). It opens on their own device's steps — iPhone & iPad,
Android, Samsung Internet, Chrome/Edge on a computer, Safari on a Mac — has a
one-tap **Install** button where the browser offers one, lets them turn
notifications on, and answers the common problems.

A short version to paste into an email or WhatsApp:

> **Get the GLAMNET app (1 minute, no app store)**
> - **iPhone:** open glamnetapp.com in Safari → tap **Share** → **Add to Home Screen** → **Add**. Then open GLAMNET from the new icon and sign in.
> - **Android:** open glamnetapp.com in Chrome → tap **Install app** (or ⋮ → **Install app**).
> - Then tap **Turn on notifications** on your account page (vendors: **Settings**). You'll get a test notification straight away.
> - Full guide: glamnetapp.com/install

Vendors should install it: emergency requests go to whoever accepts first,
and a notification is the fastest way to see one.

## How it behaves

- **Install prompt.** After someone has viewed two pages (or spent 25 seconds
  on one), a card offers to install. Chrome, Edge and Samsung Internet get a
  one-tap button; iPhone and iPad get the Share → Add to Home Screen steps,
  because Safari offers no button. "Not now" hides it for 21 days. It never
  appears inside the installed app, mid-booking, or on sign-in pages.
- **Notifications.** Every in-app notification the platform writes is also
  pushed to the person's devices (`src/lib/server/push.ts`). On iPhone they
  work only in the app opened from the home screen (iOS 16.4+). The switch
  has a **Send a test** button for checking a device.
- **App icon.** Shows a count of unread notifications where the phone
  supports badges; it clears when the app is opened. Long-pressing the icon
  offers shortcuts (Find a pro, Book, My bookings, Vendor dashboard).
- **Offline.** With no connection a page load shows a plain "You're offline"
  screen (`public/offline.html`) that reloads itself when the connection is
  back. Nothing is served from a cache: a stale price or time slot would be
  worse than an honest message.

## One-time setup: push keys

Push needs a VAPID key pair. Without it, notifications are off and the
"Turn on notifications" card is hidden.

1. Run `npx web-push generate-vapid-keys` once.
2. In Vercel → the project → **Settings → Environment Variables**, add for
   Production (and Preview, if you want push on previews):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — the public key
   - `VAPID_PRIVATE_KEY` — the private key (keep secret)
   - `VAPID_SUBJECT` — `mailto:` an address you read
3. Redeploy. The public key is built into the site, so a redeploy is needed.

Keep the same pair for good. Replacing it invalidates every existing
subscription, and everyone would have to turn notifications on again.

## Changing the service worker

`public/sw.js` is served with `no-cache`, so a new version reaches phones on
their next visit. When the offline page or its icon changes, bump `VERSION`
at the top of the file so the old cache is replaced.
