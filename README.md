# KR Solution website preview

For temporary-domain hosting and the complete handoff instructions, read **START-HERE.md** first. The packaged catalogue and administrator credential are preserved. Set PUBLIC_ORIGIN to your HTTPS domain and use a persistent DATA_DIR for hosted deployments.

Run `npm start` from this folder and open http://127.0.0.1:8098. No dependency installation needed. Run `npm test` for inventory-rule checks.

## Included

- Responsive home, catalogue, services, about and contact views.
- Product photography, details, price sorting, search and category/condition filters.
- New/refurbished classification. Active stock greater than zero is the only public stock.
- WhatsApp message preparation, call/email links, map directions and service enquiries. No checkout or payments. An enquiry never deducts stock.
- Separate password-protected administration at http://127.0.0.1:8098/admin . No admin link is shown on the storefront.
- Product creation/editing, category creation/renaming/removal, image upload, pricing, specifications, warranty, condition and stock controls.
- Product removal archives the record. Restore from the Removed products filter; restored products are unpublished until explicitly enabled.
- Durable catalogue and uploads stored on this computer. All storefront browsers fetch the same inventory; active tabs refresh changes within five seconds or on returning to the tab.

## Preview boundaries

The initial catalogue contains sample products, specifications, quantities and prices. Admin-created products can be real listings; mark illustrative listings with the Sample checkbox. No enquiry is transmitted until the visitor explicitly sends the prepared message in WhatsApp. No production system is connected or modified. Temporary-domain hosting is supported with PUBLIC_ORIGIN, configurable PORT/HOST/DATA_DIR, automatic Secure cookies for HTTPS, and persistent-disk initialization. See START-HERE.md for deployment steps. A hosted deployment has not been performed as part of preparing the ZIP.

## Admin access and storage

Username: `admin`. On first startup, the server generates and prints a random initial password once. Only its salted scrypt hash is saved in `private/admin.json`. Change it through Admin → Account. Sessions expire after eight hours and server restart requires signing in again. Never copy `private/` into a public static directory or commit it to a repository.

The shared catalogue is saved atomically to `private/catalogue.json`; product uploads are in `private/uploads/`. Preserve and back up the entire private directory when moving the site. The HTTP server uses an explicit public-file allowlist and never serves private JSON, credentials, backend source or tests. Uploads require authentication and accept JPEG, PNG, WebP and AVIF signatures, up to 5 MB. Stock updates, categories, product edits, image uploads and account changes are authenticated and protected by same-origin and session CSRF checks. Product version checks prevent stale edits from overwriting newer edits. Removed products remain recoverable in the admin panel.

Run `npm test` for API authentication, CSRF, upload, category, product CRUD, stock visibility, stale-edit and restart-persistence checks. Tests use isolated temporary data and never alter the real catalogue or admin credentials.

## Design provenance

Uses an adapted Open Design Refined design system from https://github.com/nexu-io/open-design/tree/main/design-systems/refined . The original guide and Apache-2.0 license are retained in `references/`. See DESIGN.md for the applied adaptations. The Open Design desktop app is not installed or needed to run this preview.

## Content and image sources

- Business services and contact details: https://krsolution.in/service/
- Lenovo photograph: https://krsolution.in/computer-laptop/ (image file: LENOVO-V330-VIEW-800x800.jpeg; the collage visibly depicts a ThinkPad, so the preview uses the family name rather than asserting V330 identity).
- Repair photo: https://krsolution.in/wp-content/uploads/2025/12/disassembling-computer-by-man-repair-shop_279525-1486.avif
- Unsplash hero: https://images.unsplash.com/photo-1496181133206-80ce9b88a853
- Unsplash Dell laptop: https://images.unsplash.com/photo-1588872657578-7efd1f1555ed
- Unsplash premium laptop: https://images.unsplash.com/photo-1593642632823-8f785ba67e45
- Unsplash desktop: https://images.unsplash.com/photo-1547082299-de196ea013d6
- Unsplash office: https://images.unsplash.com/photo-1497215728101-856f4ea42174

Online photos are used for the requested design review. Confirm permissions and replace illustrative product shots with actual stock photographs before commercial launch. Office imagery is illustrative and does not claim to show KR Solution premises.
