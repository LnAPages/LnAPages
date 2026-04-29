# FNL STAGE Schema — Unified Items Model (canonical)

Source of truth for how services, products, bookings, and intakes relate on Cloudflare Pages + D1 + KV. Based on the Cloudflare AI recommendation (April 2026), extended to support FNL STAGE's real catalog (podcast services, wedding tiers, add-ons, monthly retainers). All future Copilot / human edits must conform to this doc. If behavior changes, update this doc in the same PR.

## Principles

One table, `items`, holds both services (bookable) and products (a la carte, recurring, or add-on). Differentiated by `items.type` (`service` or `product`). Every customer action that mentions an item (booking or intake) carries an `item_id` FK so the admin can route and report on it. An admin boolean `items.has_page` decides whether `/services/:slug` resolves publicly (404 when false). Items can be one-time, hourly, or monthly recurring, may require a deposit, and may be add-ons to other items. Cache invalidation: admin writes bump a KV version key; reads fall through to D1 on miss; frontend trusts the `x-services-version` header.

## Table: items

- id INTEGER PRIMARY KEY AUTOINCREMENT
- type TEXT NOT NULL DEFAULT 'service' CHECK(type IN ('service','product'))
- slug TEXT NOT NULL UNIQUE
- name TEXT NOT NULL
- description TEXT
- billing_mode TEXT NOT NULL DEFAULT 'one_time' CHECK(billing_mode IN ('one_time','hourly','monthly_retainer'))
- duration_minutes INTEGER                       -- for time-boxed sessions; NULL for products, retainers, hourly
- price_cents INTEGER NOT NULL DEFAULT 0         -- base price (per session, per hour, or per month depending on billing_mode)
- deposit_cents INTEGER NOT NULL DEFAULT 0       -- >0 means deposit required before booking is confirmed
- addon_of_item_id INTEGER REFERENCES items(id)  -- nullable; if set, this is an add-on and can only be purchased with the parent
- stripe_price_id TEXT                           -- optional, for Stripe recurring/one-time prices
- active INTEGER NOT NULL DEFAULT 1
- has_page INTEGER NOT NULL DEFAULT 0
- sort_order INTEGER NOT NULL DEFAULT 0
- created_at TEXT DEFAULT (datetime('now'))
- updated_at TEXT DEFAULT (datetime('now'))

Indexes: idx_items_slug (UNIQUE), idx_items_type_active, idx_items_addon_of.

### billing_mode semantics

- one_time: customer pays price_cents once. Use for fixed wedding tiers, speed delivery add-on.
- hourly: price_cents is per hour; booking flow asks how many hours and multiplies. Use for podcast film/edit.
- monthly_retainer: price_cents is billed monthly via Stripe subscription. Use for the $1,200/month podcast retainer.

### deposit semantics

If deposit_cents > 0, /api/bookings creates the booking in status='pending_deposit' and checkout must clear deposit_cents first. On deposit paid, booking moves to 'confirmed'.

### addon semantics

If addon_of_item_id is set, the item is not bookable by itself. It appears on the parent item's page as an optional extra and is attached to the parent booking.

## Table: bookings (rebuilt)

Drops service_id. Adds:
- item_id INTEGER NOT NULL REFERENCES items(id)
- hours_requested INTEGER                      -- for hourly items
- addon_item_ids TEXT                          -- JSON array of item ids selected as add-ons
- deposit_paid INTEGER NOT NULL DEFAULT 0
- status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','pending_deposit','confirmed','paid','cancelled','completed'))

## Table: intakes (rebuilt)

Adds item_id INTEGER REFERENCES items(id) (nullable — general inquiries still allowed). Existing rows backfilled NULL.

## Endpoints

Public: GET /api/items (optionally ?type=service|product), GET /api/items/:slug (404 if has_page=0), POST /api/bookings (requires item_id; computes amount from billing_mode), POST /api/intakes (item_id optional).
Admin (session-gated): GET /admin/api/items, POST /admin/api/items, PUT /admin/api/items/:id, PATCH /admin/api/items/:id/toggle, DELETE /admin/api/items/:id.

## Cache invalidation

On every admin write:

    const v = String(Date.now());
    await Promise.all([
      env.CACHE_KV.put('items:version', v),
      env.CACHE_KV.delete('items:active:all'),
      env.CACHE_KV.delete('items:active:service'),
      env.CACHE_KV.delete('items:active:product'),
    ]);

Public GETs read KV first, fall through to D1 on miss, then cache. Responses include header `x-services-version` so the frontend knows when to invalidate.

## Frontend routing

- /services  -> list of type=service items
- /services/:slug -> detail page, only if has_page=1
- (future) /products, /products/:slug mirror this for type=product

## Seed catalog (FNL STAGE initial products)

| type | slug | name | billing_mode | price_cents | duration_minutes | deposit_cents | has_page |
|---|---|---|---|---|---|---|---|
| service | podcast-film | Podcast Film (on-site) | hourly | 30000 | NULL | 0 | 1 |
| service | podcast-edit | Podcast Edit | hourly | 20000 | NULL | 0 | 1 |
| service | podcast-retainer | Podcast Monthly Retainer | monthly_retainer | 120000 | NULL | 0 | 1 |
| service | wedding-3hr | Wedding Package — 3 hours | one_time | 40000 | 180 | 10000 | 1 |
| service | wedding-6hr | Wedding Package — 6 hours | one_time | 70000 | 360 | 15000 | 1 |
| service | wedding-8hr | Wedding Package — 8 hours | one_time | 90000 | 480 | 20000 | 1 |
| product | speed-delivery | Speed Delivery | one_time | 20000 | NULL | 0 | 0 |

Deposits above are placeholders — admin can change them in the UI. Speed Delivery is an add-on candidate; after migration, set addon_of_item_id to whichever parent item(s) it attaches to.

## Migration

See migrations/0004_unified_items.sql. Forward-only. Take a D1 export before running in prod. The migration inserts the seed rows above when the services table is empty.

## Verification checklist

- Admin can create a service item; it appears after refresh
- Admin can create a product item (type=product)
- Admin toggle has_page on/off and /services/:slug returns 200 or 404 accordingly
- Public booking flow records item_id on the new booking
- Hourly booking multiplies price_cents by hours_requested
- Monthly retainer items route to Stripe subscription checkout
- Items with deposit_cents>0 block confirmation until deposit paid
- Public quote/intake records item_id when submitted from an item page
- Admin Bookings and Intakes lists show the item name for each row
- x-services-version header changes on every admin write
