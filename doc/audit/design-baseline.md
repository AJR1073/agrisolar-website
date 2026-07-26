# AgriSolar visual baseline

Baseline captured before implementation from the Firebase development site and the current public Namecheap site. Screenshots are in `doc/audit/screenshots/baseline/` at 1440×1000 and 390×844.

## Locked design tokens

- Primary green: `#2ecc71`
- Secondary green: `#27ae60`
- Accent green: `#8bc34a`
- Dark text/background: `#2c3e50`
- Light section background: `#ecf0f1`
- Body text: `#333333`
- Heading typeface: Montserrat
- Body typeface: Open Sans
- Main content width: 1400px with 2rem gutters
- Header content width: 1200px with approximately 20px gutters
- Header: fixed, translucent white, light shadow, approximately 80px tall
- Hero: full-height video, dark overlay, centered white heading and CTAs
- Primary buttons: green, white text, pill radius
- Secondary hero buttons: transparent with white border
- Cards: white, 10–15px radius, soft shadow
- Common desktop section spacing: approximately 5–6rem vertically
- Primary mobile breakpoint: 768px
- Small-screen breakpoint: 480px

## Preserved character

The implementation keeps the text-based logo treatment, fixed navigation, video hero, green palette, existing fonts, rounded buttons, soft-shadow cards, local solar imagery, and desktop/mobile spacing character. New pages reuse those same elements rather than introducing a new visual system.

The original bright greens remain the decorative palette. A darker companion green (`#087f3f`) is used for text and interactive controls where WCAG AA contrast requires it.

## Firebase development indexing note

Firebase Hosting sends `X-Robots-Tag: noindex, nofollow, noarchive` while `agrisolarllc.com` remains on Namecheap. Remove that header only after the owner approves moving the primary domain to Firebase.
