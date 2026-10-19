# Video design specification

## Reference and evidence

Source: `WhatsApp Video 2026-10-18 at 10.36.43.mp4`, duration 23.474 seconds, portrait encoding 720 by 1280 pixels. The website is a desktop recording embedded approximately in the rectangle x 0 to 720 and y 438 to 843. Black padding, the orange caption “Furniture e-commerce website,” the creator watermark, and the mouse cursor belong to the recording; do not build them into the website.

The recording provides a small raster reference, not the original browser viewport or design source. Proportions below refer to the 720-pixel-wide embedded site. CSS values, fonts and animation timings are proposed starting points, not measurements of source code. The lower portion of some screens is outside the visible area.

| Evidence | Time | Visible content | Confidence |
| --- | --- | --- | --- |
| V01 | 00.0 to 02.5 | Header and asymmetric home hero | High for layout; partial headline |
| V02 | 03.0 to 07.5 | This week's favourites, Lighting filter, two products, bag badge | High |
| V03 | 08.0 to 12.5 | Sign-in panel, account tab, demo admin button, add-to-bag toast | High |
| V04 | 13.0 to 17.5 | Mostly blank main area after auth; signed-in header | High observation; purpose unknown |
| V05 | 18.0 to 23.0 | Admin overview with metrics, charts and recent orders | High; lower widgets cropped |

Frames were inspected at 0.5-second intervals across the clip. Intermediate captures preserve the sequence; they do not prove every click destination or hidden control. The approximately five-second blank state is an observed transition, not a desired production loading duration.

## Shared visual language

The store uses warm ivory backgrounds, near-black text, pale sage and butter-yellow surfaces, rounded cards, understated borders, and restrained shadows. Navigation and action buttons are compact pills. Typography combines a large, heavy sans-serif display heading with small quiet labels and spacious product imagery. Product images show furniture isolated on softly colored backgrounds with subtle shadows. Avoid replacing these with generic lifestyle banners.

Proposed starting tokens are canvas `#F1F1E8`, surface `#FAFAF6`, ink `#1D2018`, muted ink `#74776C`, sage `#DFE5D6`, butter `#F3EBC9`, powder blue `#DFE7F2`, divider `#E3E5DC`, chart blue `#4A58B6`, positive green `#3D8B70`, and negative red `#B96958`. Verify against the captures at implementation. Use an 8-pixel spacing scale with 4-pixel exceptions, card radii 18 to 24 pixels, pill radius 999 pixels, and subtle 1-pixel borders at the target desktop scale. Choose the closest licensed font after comparison; no exact font family is established by the video.

## Store header

The pale header is a narrow rounded horizontal bar. At the left is a black circular emblem and the word ELNAVO. The centered links read Shop all, Seating, Lighting, Textiles, and Ceramics. At the right are an outline account icon and a near-black Bag pill with a bag icon and a small light count badge. Preserve the alignment and compact height. Brand label, logo and navigation labels come from JSON or the content catalog.

The bag badge is observed as zero on the opening screen and increases later in the clip. The user can add products without signing in. Do not infer the exact bag drawer layout from the thin partially visible panel near the sign-in frame. Header stickiness and menu hover behavior are unconfirmed and must be specified as implementation choices.

## Home screen V01

The desktop hero is a bento layout with about 59 percent left and 41 percent right width, a narrow gap, and approximately 8 pixels of outer inset in the recorded image. The left column has a large white editorial card above two smaller cards. The right column is one tall pale-sage featured-product card spanning both left rows.

The editorial card contains a faint new-season label and a bold oversized headline beginning “Calm objects for” followed by a partially obscured “slow…” line. The full sentence is not recoverable. The bottom-left yellow card contains a ribbed pendant image, LIGHTING label, “Soft light,” and “3 pieces” with a small arrow. The neighboring delivery card reads “Free over $144” and “Dispatched in 48h. 30-night trial.” The right card shows BESTSELLER, “Bolle Lounge Chair,” a large pale upholstered chair, and a white bottom strip with `$890`, Details, and Add to bag.

Required behavior: the lighting tile opens the lighting listing; Details opens the featured product; Add to bag adds the purchasable default variant or opens variant selection if necessary. Delivery threshold, dispatch promise and trial language are configurable and must agree with actual policy. Do not hardcode the sample promise into checkout logic. Preserve headline hierarchy, but supply complete copy and avoid reproducing apparent text clipping caused by the recording or animation.

## Product listing V02

The large left-aligned title is “This week's favourites” with a small MOST LOVED eyebrow. Category filter pills sit on the same upper band toward the right; Lighting has a dark selected background. The product grid starts at the left and keeps unused space to the right when only two results exist. Do not stretch two cards across the entire width.

Two visible items are Linne Table Lamp at `$189`, rated `4.8 (204)`, on a butter-yellow image panel, and MÅN Pendant at `$249`, rated `4.7 (158)`, on powder blue. The first has a small New badge and a dark circular plus button at the image bottom-right. Category, product name, price, star score and count sit below the image. Exact product-name accents require original catalog confirmation.

Required behavior: filter pills update URL state and result counts; quick add gives visible feedback; bag count updates; a product image or title opens details. The video displays a successful “Linne Table Lamp added to your bag” toast with a green status icon and View bag action. Toast placement is bottom-center in the recording. Persist the bag through navigation. Search, sort, price filters, pagination, empty results and loading placeholders are proposed additions; keep them visually quiet.

## Sign in V03

The store header remains. A large light-sage panel occupies roughly the left 41 percent of the content width; an isolated table lamp sits to its right on a pale yellow image area. The form has WELCOME BACK, a Sign in heading, pill-like Sign in and Create account tabs, Email and Password fields, a password visibility icon, a full-width dark Sign in button with arrow, an “or” divider, and Continue as demo admin. Muted helper copy explicitly refers to demo accounts stored in the browser and adding Firebase keys.

Replicate the form geometry and visual language while implementing server authentication with Express and PostgreSQL. The demo's Firebase note is not part of this project's stack. Demo mode may show an equivalent explicitly labeled sandbox message. Continue as demo admin is available only in an isolated demo environment with fake records and restricted writes. Production sign-in must not expose a public admin bypass. Add recovery, validation and error states in this style.

## Admin overview V05

The admin has its own shell. A pale fixed-width left sidebar occupies approximately 17 percent of the capture. ELNAVO and a small DEMO badge are at the top; Overview is the dark selected pill, followed by Orders, Products, Categories, and Storefront with small outline icons. A lower card shows Live traffic, Simulating shoppers, and a green toggle. The account block shows a circular blue avatar, Demo Admin, an email label and a logout icon.

The main area begins with a small date and “Good afternoon, Demo.” At the right are Last order just now and a segmented 7D, 30D, 90D selector, with 30D selected. Below is a row of four cards: Revenue `$164,375`, Orders `497`, Avg. order value `$330.73`, and Customers `344`. Each includes an icon, percentage change pill and small sparkline. These values are demo content; production values come from documented metric definitions.

The next row has a wide “Orders - last 30 days” line/area chart with a Revenue and Orders toggle and a narrow Live orders list. List rows include colored initials, name, city, item count, total and elapsed time. Under the chart are a Today goal donut showing `$5,288`, a 100 percent goal indication and 13 orders so far, and a Sales by category donut with a legend including Seating, Lighting and Tables. The lower edge is cropped; do not invent additional widgets as observed evidence.

Production adapts the traffic simulation toggle into a disabled/hidden demo-only control. The recent-order list can poll every 30 seconds; the Live label must state update recency and change to a stale state after failures. A real shopper count requires a separate privacy-conscious telemetry design and is not inferred from this clip.

## Responsive and interaction specification

Mobile and tablet designs are proposed because the recording shows only a desktop interface. At 1024 pixels preserve the sidebar and reduce chart density. At 768 pixels collapse sidebar navigation into a drawer, wrap metric cards into two columns and move the orders list below the chart. At 360 to 390 pixels stack home hero cards, use a two-column product grid where readable, show a compact menu, and make bag and checkout actions reachable with touch. Collapse to one product column when long translated names would overflow.

Use 44-pixel minimum touch targets, visible focus indicators, semantic labels and reduced-motion alternatives. Keep decorative transitions around 150 to 220 ms as a starting point. Show loading, empty, validation, network failure, out-of-stock and permission-denied states. Never display a blank screen during data fetching. Any adjustment needed for readability takes precedence over copying a low-resolution recording artifact.

## Design completion checklist

Compare each of the four captured states at an equivalent 16:9 viewport, crop to the embedded website area, and review geometry before colors and typography. Use a screenshot overlay and log accepted differences. Do not claim pixel accuracy without this comparison. Obtain original logo, product cutouts, exact fonts and complete copy if exact asset matching is required. No such source assets are present in the project yet.
