# Hotel Sheet Sync

A single-file, fully offline tool for comparing the master crew sheet against a
hotel-specific sheet, approving each change, and pasting a formatted update page
back into the hotel workbook.

**The entire tool is one file: [`hotel-sheet-sync.html`](hotel-sheet-sync.html).**
Save it anywhere (desktop, USB stick, network drive) and double-click it — it opens
in Edge or Chrome. It has no installer, needs no internet connection, and never
uploads or saves anything: a Content-Security-Policy inside the file blocks all
network access, so crew names and stay dates never leave the machine.

## How to use it

1. **Load** — drag the master `.xlsx` onto the left box and the hotel `.xlsx` onto
   the right box (or click a box to browse). Pick a different sheet tab from the
   dropdown if needed; for the hotel workbook the tool defaults to the last
   (newest) tab.
2. **Confirm the hotel** — the tool reads the hotel name off the hotel sheet and
   pre-selects the matching hotel in the master. Tick more than one if the master
   spells the hotel two ways. Set your initials and shift letter once; they are
   remembered.
3. **Review** — every proposed change starts **unapproved**, in either of two views:
   - **Side-by-side** (default): each booking shows its master row directly above its
     hotel row in one spreadsheet-style grid, with differing cells outlined. Hover an
     outlined cell for a tooltip showing old → new and the match reason, and click the
     cell (or the tooltip button, or press Enter) to approve. Approved cells fill with
     their Excel colour so the grid previews the final page as you work.
   - **Change list**: the same proposals as a compact checklist with per-section
     "Approve all" buttons — for when the tool has earned enough trust.
   Both views share one approval state; switch freely. Colour coding:
   - Schedule / flight / pairing changes → highlighted `#ffff00`
   - Name changes → highlighted `#a6c9ec` (confirmation numbers are never moved
     or edited — a replacement name goes into the same slot)
   - New bookings → whole row `#b5e6a2`, confirmation cells marked `NEW`
   - Cancellations → whole row `#ff0000` + strikethrough. Rows on the hotel sheet
     that aren't on the master (loadmasters, maintenance, executives) appear here
     too — leave them unapproved and they are copied through untouched.
4. **Copy out** — click *Build updated page*, review the preview, then *Copy page
   to clipboard*. In the hotel workbook add a new tab, name it as shown (e.g.
   `04JUL AKN` — today's date + initials + shift letter), click A1 and paste.
   Values, highlights and strikethrough paste together. No new Excel file is
   ever created.

## How rows are matched

Bookings are matched the way a scheduler thinks ("who is operating 941 on the
25th?"): by crew names, check-in date and inbound flight, in eight tiers from
strictest (all three agree) to loosest (unambiguous partial matches). Pairing
codes are treated as a changeable field, not an identifier. Every match shows its
reason in the review screen. Dates (`25JUL`, `7/25/26`, real Excel dates), times
(`1400`, `14:00`, `2:00 PM`, Excel times) and flight numbers (`AB 0941` = `AB941`)
are normalised before comparing, so formatting differences between the two files
don't produce false changes.

## Branding

The interface uses the Cargojet palette — main `#060000`, accent `#fedc2e`
(assumed from the provided "edc2e"), header `#5e6368`, text `#858585` — with a
vector recreation of the wordmark (the sandbox this was built in cannot download
the official PNG; swap it in later if pixel-perfect branding is needed).

Excel parsing by [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0),
embedded in the file.
