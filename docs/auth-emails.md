# Sign-up and sign-in emails

Account emails (confirm your email, sign-in links, password resets) are sent
by **Supabase Auth**, not by the app. That is why they do not appear in
Resend until Supabase is told to send through Resend (step 1). Booking,
approval and campaign emails are sent by the app through Resend directly.

## 1. Send auth emails through Resend (recommended)

Supabase's built-in mailer is for testing: it sends from
`noreply@mail.app.supabase.io`, is heavily rate-limited (a handful of emails
an hour), and often lands in spam.

Supabase dashboard → **Authentication → Emails → SMTP Settings** →
enable **Custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `hello@glamnetapp.com` (any address on your verified Resend domain) |
| Sender name | `GLAMNET` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |

Then **Authentication → Rate Limits** → raise "emails per hour" (e.g. 100).
The domain must be verified in Resend (Resend → Domains).

## 2. Make links work on any device (recommended)

By default the confirmation link finishes signing in only in the browser the
person signed up in. The app already copes (it tells them the email is
confirmed and to sign in), but linking to `/auth/confirm` signs them in
wherever they open it.

Supabase dashboard → **Authentication → Emails → Templates**:

**Confirm signup** — replace the link with:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm your email</a>
```

**Magic link** — replace the link with:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Sign in to GLAMNET</a>
```

`{{ .RedirectTo }}` is the full callback URL the app sent; the app only
honours same-site paths from it, so if you prefer, use `next=/account`.

Also check **Authentication → URL Configuration**: Site URL
`https://www.glamnetapp.com`, and Redirect URLs include
`https://www.glamnetapp.com/**`.
