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

## If something looks wrong

Nothing in the tool fails silently. The **Compare** button stays disabled — with the
reason written next to it — until both files are loaded, rows were readable, and a
hotel is ticked. Any unexpected error appears as a red diagnostic banner at the top
of the page: screenshot it and report it. Each loaded file also has a **"Preview
parsed rows"** panel, so you can check the tool read your columns the way you expect
before comparing. Very large sheets are capped at the first 5,000 rows (with a
warning) so a stray formatted range can never freeze the page.

## The master's date window

The master sheet only speaks for the period it covers. The tool takes the earliest
and latest check-in dates on the master (shown next to the Compare button, e.g.
"Master covers 04JUL–10JUL") and treats any hotel booking that checks in outside
that window as **out of scope**: it is never matched, never proposed as a
cancellation, and passes through to the new page completely untouched. These rows
appear dimmed with an "Out of range" tag and their own summary chip, so a hotel
sheet that looks weeks further ahead than the master can't generate a wall of
false cancellations. Year-end windows (e.g. 28DEC–03JAN) are handled correctly.

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

The interface uses the Cargojet palette — main `#060000`, accent red `#c92c3a`,
header `#5e6368`, text `#858585` — with a red vector recreation of the wordmark
(the sandbox this was built in cannot download the official PNG; swap it in later
if pixel-perfect branding is needed). Caution boxes are kept amber so they read as
warnings rather than being confused with the red cancellation highlight.

Excel parsing by [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0),
embedded in the file.
