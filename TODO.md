# Family Hub — Next Iteration To-Do

## Deployment — needed before Wishlist works live
- [ ] Add `ToriWishlist` and `NovaWishlist` tabs to the shared CHORES Google Sheet (single column A = Item, no header row — same setup as `Reminders`)
- [ ] Redeploy `chores_gas_script.gs` in the Apps Script editor (Deploy → Manage deployments → new version)

## Unwind Tab

### Local Events tile
- [ ] **Option A: Live event lookup** — user picks category (music, markets, outdoors, etc.) + area and gets a filtered results return rendered as pills or a clean short list inside the tile. Strict result cap to avoid clutter. Could be a 🔍 "Discover" button that appends results into the tile.
- [ ] **Option B: Google Sheets backend** — manual curation via GAS, same pattern as movies/books/meal ideas. Simpler, no API dependency, consistent with rest of app.
- [ ] Evaluate both and potentially ship Sheets first, then layer live lookup as an optional mode later.
