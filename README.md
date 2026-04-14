# Saloon Booking Bot

WhatsApp-based salon booking bot: customer messages the salon's Twilio WhatsApp number, the bot shows services, asks for a date, replies with available slots, and confirms the booking in Supabase.

## Stack
- **Next.js 14** (App Router, TypeScript) — hosts the Twilio webhook and cron endpoint
- **Supabase** (Postgres) — services, appointments, working hours, conversation state
- **Twilio WhatsApp** — inbound/outbound messaging

## Architecture

```
WhatsApp user ──▶ Twilio ──▶ POST /api/twilio/webhook
                                │
                                ▼
                        lib/booking/flow.ts   (state machine)
                                │
               ┌────────────────┼──────────────────┐
               ▼                ▼                  ▼
         services table   get_available_slots   appointments
                          (RPC)                   (exclusion constraint)
                                │
                                ▼
                   Reply built via lib/twilio.buildTwiML
```

Cron: `GET /api/cron/reminders` runs every 15 min (Vercel Cron), finds confirmed bookings starting in 60-75 minutes, sends a WhatsApp reminder, marks `reminder_sent = true`.

## Conversation flow

1. User: `hi` → bot lists services `1) Haircut ... 2) Color ...`
2. User: `1` → bot asks for date (`today`, `tomorrow`, `friday`, or `YYYY-MM-DD`)
3. User: `tomorrow` → bot replies with numbered available times
4. User: `3` → bot inserts appointment and replies with confirmation + reference
5. At any point: `cancel` resets the flow

Conversation state is persisted per phone in the `conversation_sessions` table so it survives cold starts.

## Setup

### 1. Supabase
1. Create a project at https://supabase.com
2. Open **SQL Editor**, paste `supabase/schema.sql`, run it. This creates all tables, the `get_available_slots` RPC, and seeds sample services + working hours (Mon-Sat 09:00-18:00, closed Sunday).
3. Copy from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to the browser)

### 2. Twilio WhatsApp Sandbox
1. Create a Twilio account and enable the **WhatsApp Sandbox** (Messaging → Try it out → Send a WhatsApp message).
2. Note the sandbox number (e.g. `whatsapp:+14155238886`) → `TWILIO_WHATSAPP_FROM`
3. From your Twilio Console copy `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
4. Once deployed, set the sandbox **"When a message comes in"** webhook to `https://YOUR-DOMAIN/api/twilio/webhook` (HTTP POST).

### 3. Local development
```bash
cp .env.example .env.local
# fill in values
npm install
npm run dev
```

Expose local dev to Twilio with ngrok:
```bash
npx ngrok http 3000
```
Set the sandbox webhook to `https://<ngrok-id>.ngrok-free.app/api/twilio/webhook`.

Send `join <sandbox-code>` from WhatsApp to the sandbox number, then send `hi` to start booking.

> **Note:** Twilio signature validation is skipped in `NODE_ENV !== production` so local ngrok testing works. In production it is enforced.

### 4. Deploy to Vercel
1. Push this repo to GitHub.
2. Import in Vercel, add all env vars from `.env.example`.
3. Deploy. `vercel.json` already declares the reminder cron (`*/15 * * * *`).
4. Update Twilio sandbox webhook to `https://<your-vercel-domain>/api/twilio/webhook`.

## Database schema (summary)

| Table | Purpose |
|---|---|
| `customers` | phone (unique) → id, name |
| `services` | name, duration_minutes, price, is_active |
| `working_hours` | one row per weekday (0-6), open/close or is_closed |
| `schedule_exceptions` | per-date override (holidays) |
| `appointments` | customer, service, start_at, end_at, status, reminder_sent; **exclusion constraint prevents overlapping non-cancelled bookings** |
| `conversation_sessions` | per-phone state + jsonb context (chosen service, date, candidate slots) |

RPC `get_available_slots(p_date, p_duration, p_step_minutes)` computes free slots on the fly by subtracting non-cancelled appointments from working hours (honouring exceptions).

## Race-condition safety
Two users could be shown the same slot at the same time. The `appointments_no_overlap` exclusion constraint (Postgres GIST, `tstzrange && tstzrange`) ensures the second `INSERT` fails with `23P01`; `createAppointment` catches this and `flow.ts` re-fetches a fresh slot list.

## File layout

```
app/
  layout.tsx                          # global Tailwind + html shell
  page.tsx                            # public landing
  globals.css                         # Tailwind directives
  api/
    twilio/webhook/route.ts           # Twilio inbound webhook → TwiML reply
    cron/reminders/route.ts           # Vercel Cron → WhatsApp reminders
  auth/
    callback/route.ts                 # Supabase magic-link code exchange
  admin/
    layout.tsx                        # admin chrome (nav, sign out)
    page.tsx                          # appointments list
    actions.ts                        # server actions: cancel, reschedule, name, signOut
    CancelButton.tsx                  # client component
    login/page.tsx                    # magic-link request form
    appointments/[id]/page.tsx        # appointment detail
    appointments/[id]/RescheduleForm.tsx
    customers/page.tsx                # customer search + list
    customers/[id]/page.tsx           # customer detail + history
    customers/[id]/CustomerNameForm.tsx
lib/
  supabase.ts                         # service-role client (bot + admin writes)
  supabaseServer.ts                   # @supabase/ssr server client (auth)
  supabaseBrowser.ts                  # @supabase/ssr browser client (auth)
  auth.ts                             # requireAdmin / isAdminEmail
  format.ts                           # date/time formatters in salon timezone
  twilio.ts                           # outbound send + TwiML + signature validation
  booking/
    parseDate.ts                      # "tomorrow" / "YYYY-MM-DD" / weekday parser
    session.ts                        # conversation_sessions get/set/reset
    slots.ts                          # services, RPC, customer + appointment writes
    flow.ts                           # state-machine message handler
middleware.ts                         # refresh auth cookies + protect /admin/*
supabase/
  schema.sql                          # full DDL + RPC + seed + RLS
tailwind.config.ts
postcss.config.js
vercel.json                           # cron config
.env.example
```

## Admin dashboard

Visit `/admin` to manage bookings. Pages:

- `/admin` — upcoming appointments, filter by status, cancel or open for editing
- `/admin/appointments/[id]` — full detail + reschedule via date picker (uses the same `get_available_slots` RPC, excluding the current booking)
- `/admin/customers` — searchable list of all customers
- `/admin/customers/[id]` — edit customer name, view their full appointment history

### Auth — Supabase magic link
The dashboard is protected by Supabase Auth (email magic link) with an admin allowlist.

**Setup:**
1. In Supabase dashboard → **Authentication → Providers → Email** — make sure "Enable Email provider" is on.
2. **Authentication → URL Configuration** → add your site URL and the callback to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://your-vercel-domain.vercel.app/auth/callback`
3. Add to `.env.local` (and Vercel env vars):
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase **Project Settings → API**)
   - `ADMIN_EMAILS=you@example.com,partner@example.com` — comma-separated allowlist
4. Visit `/admin/login`, enter your email, click the magic link in your inbox.

`middleware.ts` redirects any unauthenticated visit to `/admin/*` back to the login page. After login, `lib/auth.ts#requireAdmin` also checks the email is in `ADMIN_EMAILS` (a Supabase user with a non-allowlisted email gets bounced).

### Reschedule safety
Rescheduling reuses the `get_available_slots` RPC with `p_exclude_appointment_id` so the current booking doesn't block its own time grid. The Postgres exclusion constraint on `appointments` still prevents two admins (or admin + bot) from picking the same slot at once — the second action gets a `23P01` error which the UI surfaces as "That slot conflicts with another appointment."

## Extending

- **More staff**: add `staff` table and `staff_id` on appointments; modify RPC to filter by staff.
- **Cancel/reschedule via WhatsApp**: add commands in `flow.ts` that look up the latest confirmed appointment for the phone and update its status.
- **Interactive buttons**: swap TwiML for Twilio Content API templates with WhatsApp list messages.
- **Timezone**: current formatting uses `SALON_TIMEZONE`. Slot math runs in the Postgres server timezone — set Supabase project timezone accordingly or store explicit zone-aware boundaries.
