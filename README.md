# Hasenie dlhov

Mobile-first Slovak web app for paying down personal debts. Each creditor is a fire on a dusk meadow. Payments shrink the flame. A fully paid debt leaves a cold fire pit (ohnisko).

The interface is in Slovak. Amounts use Slovak euro formatting (`1 234,50 €`). Everything is stored in `localStorage` in the browser. Settings can export and import a JSON backup.

## GitHub Pages

Serve the site from the **root of the `main` branch** (not `/docs`).

1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/ (root)`**.
4. Save.

The project site will be at `https://<user>.github.io/hasenie-dlhov/`. Paths are relative, so the same files also work at the domain root. A `.nojekyll` file is included so GitHub Pages serves the fonts and icons as-is.

There is no build step. `index.html` is the app.

## On an iPhone

Open the Pages URL in Safari, then **Share → Add to Home Screen**. The app runs standalone, uses the meadow under the status bar, and respects the safe area. A manifest, Apple touch icon, and service worker are included.

## Using it

- **Zapáliť oheň** adds a creditor: name, total in euros, optional note and due date. The meadow holds up to 12 fires.
- The largest remaining debt stands in the foreground. Smaller debts recede toward the forest. Labels stay nearly full size so distant names and amounts stay readable.
- Tap a fire for its history, **Zaplatiť časť**, **Splatiť celé**, edit, or delete.
- A payment plays a short water-and-steam animation and the fire eases to its new size. At zero, only the stone ring remains, labelled **Splatené ✓**.
- The top card shows what is still owed, what has been paid, and how much of the debt is extinguished.

Data key: `hasenie-dlhov-v1`.

The scene follows `prefers-reduced-motion`: flames, parallax, and transitions settle instead of looping.
