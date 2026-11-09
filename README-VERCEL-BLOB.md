[![devs.surf](https://devs.surf/badges/subdomain.svg)](https://ballal.devs.surf)
# Foodie Place

Customer website and restaurant admin dashboard. The live app is deployed on Vercel and uses Supabase for shared menu, order and restaurant settings data.

## Pages

- Customer home: `/`
- Full menu: `/menu.html`
- Order tracking: `/track-order.html` (private tracking code required)
- Admin dashboard: `/admin.html`

## Required Vercel environment variables

Set these in Vercel → Project → Settings → Environment Variables. Never commit their values:

- `SUPABASE_URL`: Supabase project URL only (for example, `https://YOUR_PROJECT.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret; server-side only
- `FOODIE_ADMIN_KEY`: long random admin secret; do not expose it publicly
- `BLOB_READ_WRITE_TOKEN`: only needed for the Image Library feature

After changing environment variables, redeploy the project.

## Database migration for recent improvements

Before using the updated ordering and settings features, open Supabase → SQL Editor and run the contents of `supabase/improvements.sql` once. It adds:
- Structured hot-deal kitchen breakdowns
- Customer order instructions and delivery fee snapshots
- Private tracking tokens
- WhatsApp contact, delivery fee, minimum order, estimated delivery and open/closed settings

The existing `menu_items`, `orders` and `restaurant_settings` tables must already exist.

## Configure the restaurant

Open `/admin.html` and enter the private `FOODIE_ADMIN_KEY`.

In Restaurant Settings, enter the real business information:
- Restaurant phone for calls
- WhatsApp number in international digits, without spaces or plus sign (Pakistan example: `923001234567`)
- Real address, email and opening hours
- Delivery fee and minimum order
- Estimated delivery time
- Open or temporarily closed

Save settings. The customer site will display the WhatsApp contact shortcut once the WhatsApp number is saved.

## Hot Deals

Use Admin → Hot Deals to create offers. The customer-facing description is shown on the website. In Kitchen item breakdown, enter one item per line using `quantity x item name`, for example:

```
2 x Large Pizza
2 x Cold Drink
```

These component details are copied into new order records so staff can prepare the correct combo. Review the existing sample deal prices and contents before accepting customer orders.

## Customer order tracking

New online orders receive a private 32-character tracking code. The customer must keep this code and enter it on `/track-order.html`. This replaces the old phone-number-only lookup. Older orders created before the migration do not have a tracking code and remain visible in the admin dashboard.

## Deployment

Changes pushed to the `main` branch trigger a Vercel deployment. Wait for the deployment to show Ready, then hard-refresh the site (Ctrl+F5).

## Before public launch

- Run `supabase/improvements.sql` before testing the new API fields.
- Set the actual WhatsApp number and business details in Admin → Restaurant Settings.
- Replace sample menu items, images, deal contents and prices with the restaurant's real offer.
- Test one order end-to-end, including WhatsApp, delivery fee, admin order details, status changes and private tracking.
- Test mobile widths and real devices. A successful GitHub commit does not itself prove that the Vercel deployment or live database is working.
