# iPhone Catalog

## Goal

Users select a model and then choose from that model's official colors. They do
not type model or color values. The color `name` is authoritative and is stored
in the database; `hex` is an approximate UI swatch only.

## Data and types

The immutable catalog and its helpers live in `lib/catalog/iphones.ts`. Model
and color literals belong there, not in UI components.

```ts
type IPhoneColor = {
  name: string;
  hex?: string;
};

type IPhoneCatalogItem = {
  id: string;
  name: string;
  year: number;
  order: number;
  colors: IPhoneColor[];
};
```

`year` supports grouping and display. `order` is a unique, monotonically
increasing release sequence (oldest first), independent of marketing generation
labels. This distinguishes models such as iPhone X, XR, and XS for sorting and
search ranking.

## Catalog

IDs and `order` follow the chronological list below. Search results are ordered
by `order` descending, so newer models appear first.

| Year | Models |
| --- | --- |
| 2017 | iPhone 8, iPhone 8 Plus, iPhone X |
| 2018 | iPhone XR, iPhone XS, iPhone XS Max |
| 2019 | iPhone 11, iPhone 11 Pro, iPhone 11 Pro Max |
| 2020 | iPhone SE (2nd gen), iPhone 12 mini, iPhone 12, iPhone 12 Pro, iPhone 12 Pro Max |
| 2021 | iPhone 13 mini, iPhone 13, iPhone 13 Pro, iPhone 13 Pro Max |
| 2022 | iPhone SE (3rd gen), iPhone 14, iPhone 14 Plus, iPhone 14 Pro, iPhone 14 Pro Max |
| 2023 | iPhone 15, iPhone 15 Plus, iPhone 15 Pro, iPhone 15 Pro Max |
| 2024 | iPhone 16, iPhone 16 Plus, iPhone 16 Pro, iPhone 16 Pro Max |
| 2025 | iPhone 16e, iPhone 17, iPhone 17 Pro, iPhone 17 Pro Max, iPhone Air |
| 2026 | iPhone 17e, iPhone 18 Pro, iPhone 18 Pro Max |

The 2026 entries were placeholders in the original revision. Apple has since
announced iPhone 17e and iPhone 18 Pro / Pro Max. Their catalog names and colors
are confirmed as of 2026-09-30: [iPhone 17e announcement](https://www.apple.com/newsroom/2026/03/apple-introduces-iphone-17e/),
[iPhone 18 Pro announcement](https://www.apple.com/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/).

### Official color names

Paired models share one color list when their official options are identical.
The values below are official names; swatch hex values are approximate.

- **iPhone 8 / 8 Plus:** Gold, Silver, Space Gray, (PRODUCT)RED
- **iPhone X:** Silver, Space Gray
- **iPhone XR:** Black, White, Blue, Yellow, Coral, (PRODUCT)RED
- **iPhone XS / XS Max:** Silver, Space Gray, Gold
- **iPhone 11:** Purple, Yellow, Green, Black, White, (PRODUCT)RED
- **iPhone 11 Pro / 11 Pro Max:** Gold, Space Gray, Silver, Midnight Green
- **iPhone SE (2nd gen):** Black, White, (PRODUCT)RED
- **iPhone 12 mini / 12:** Black, White, (PRODUCT)RED, Green, Blue, Purple
- **iPhone 12 Pro / 12 Pro Max:** Silver, Graphite, Gold, Pacific Blue
- **iPhone 13 mini / 13:** (PRODUCT)RED, Starlight, Midnight, Blue, Pink, Green
- **iPhone 13 Pro / 13 Pro Max:** Graphite, Gold, Silver, Sierra Blue, Alpine Green
- **iPhone SE (3rd gen):** (PRODUCT)RED, Starlight, Midnight
- **iPhone 14 / 14 Plus:** Midnight, Purple, Starlight, (PRODUCT)RED, Blue, Yellow
- **iPhone 14 Pro / 14 Pro Max:** Space Black, Silver, Gold, Deep Purple
- **iPhone 15 / 15 Plus:** Black, Blue, Green, Yellow, Pink
- **iPhone 15 Pro / 15 Pro Max:** Black Titanium, White Titanium, Blue Titanium, Natural Titanium
- **iPhone 16 / 16 Plus:** Black, White, Pink, Teal, Ultramarine
- **iPhone 16 Pro / 16 Pro Max:** Black Titanium, White Titanium, Natural Titanium, Desert Titanium
- **iPhone 16e:** Black, White
- **iPhone 17:** Black, White, Mist Blue, Sage, Lavender
- **iPhone 17 Pro / 17 Pro Max:** Silver, Cosmic Orange, Deep Blue
- **iPhone Air:** Space Black, Cloud White, Light Gold, Sky Blue
- **iPhone 17e:** Black, White, Soft Pink
- **iPhone 18 Pro / 18 Pro Max:** Black, Silver, Glacier, Burgundy

## Helpers

`lib/catalog/iphones.ts` exports:

```ts
getIPhoneById(id: string): IPhoneCatalogItem | undefined
getIPhoneColors(id: string): readonly IPhoneColor[]
searchIPhones(query: string): IPhoneCatalogItem[]
isValidIPhoneModel(id: string): boolean
isValidIPhoneColor(id: string, colorName: string): boolean
```

Search supports compact and subsequence matches and ranks matches newest first.
Color validation compares the official name exactly and scopes the check to the
selected model.

## Server validation and storage

Validate every transaction on the server. The client submits a catalog model ID
and an official color name. A Zod `.superRefine` checks the model with
`isValidIPhoneModel` and checks the color with `isValidIPhoneColor` for that
model. Only after validation, resolve the model ID to its canonical `name` for
the existing transaction column.

Keep storing canonical display names on the transaction; no models table is
needed yet:

```text
phone_model = "iPhone 15 Pro Max"
phone_color = "Natural Titanium"
```

Revisit the storage shape when adding non-Apple brands and a generic device
catalog.

## Picker and transaction flow

Use a searchable drawer or command menu rather than a native select for the
large model list:

1. Search model names with fuzzy matching; show newer matches first.
2. Selecting a model immediately shows that model's colors with a swatch and
   official name.
3. If the model changes, clear the selected color when it is invalid for the
   new model.

Primary transaction flow:

```text
BUY / SELL
→ iPhone model
→ Color
→ Price
→ Date
→ Phone photos (camera/gallery)
→ BUY: Seller ID front/back | SELL: Buyer ID front/back
→ Save transaction
```

Keep Notes collapsed under “More details”.

## V1 ledger app

The first runnable version includes Overview, Stock, and Transactions views,
plus create and delete transaction actions. Each transaction represents one
phone: a BUY adds one model/color to stock and a SELL removes one. Stock counts
are derived from the transaction history. Money totals are grouped by currency
so values in different currencies are never added together.

The app uses Next.js App Router and deploys to Vercel. Supabase Auth gates the
ledger. Next.js route handlers verify the signed-in user; GET and DELETE use
that user's session and RLS. The POST route uses Zod `.superRefine` to validate
the catalog model and model-specific color, then inserts with a server-only
service key and assigns the verified user's ID. Authenticated clients have no
direct database insert grant, so they cannot bypass catalog validation through
the Supabase Data API. The default currency is TND, with TND, EUR, and USD
selectable per transaction.

The database table is `public.phone_transactions`. Row level security scopes
reads and deletes to `auth.uid()`; authenticated users have no insert grant.
The POST route inserts only after session and catalog validation, setting
`user_id` from the verified session. Photos upload as JPEGs to the private
`transaction-photos` bucket; Storage policies scope access to the signed-in
user's folder, and the database stores object paths rather than public URLs.
Photos are served through an authenticated Next.js route and are marked
`private, no-store`. The browser uses only the Supabase publishable key; the
service key stays server-side and is never named with a `NEXT_PUBLIC_` prefix.
Configure the Project URL, publishable key, and server-only service key before
using the app. Apply the SQL in `supabase/migrations/` once per project.

Each transaction requires front and back images for the seller on a BUY or the
buyer on a SELL. Up to five phone photos can be attached. The interface resizes
photos before upload and keeps Notes collapsed under “More details”.

## Visual direction

The audience is a phone reseller entering trades at a counter. The app should
read like a precise stock ledger with device details visible at a glance.

- **Palette:** Paper `#FAF8F5`, Sheet `#FFFFFF`, Ink `#451A03`, Rule `#E5DED2`,
  Trade `#B45309`, Stock `#059669`.
- **Type:** Space Grotesk for page titles and model names; IBM Plex Sans for
  controls and body text; IBM Plex Mono for amounts and dates.
- **Layout:** Compact top navigation over a readable ledger table, with a
  stock view grouped by model and color. On small screens the table becomes a
  short, scannable transaction list and the form uses the full viewport.
- **Signature:** A small phone silhouette whose back color uses the catalog
  swatch, repeated beside model/color names in the picker, stock, and ledger.

Keep surfaces flat, borders quiet, controls rectangular, and movement limited
to brief focus/selection feedback. Respect keyboard focus and reduced-motion
settings.
