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

The master sheet only speaks for the period it covers. Step 2 has a **Master date
range** control: auto-filled from the master's earliest and latest check-in dates,
and editable if the auto-detect gets it wrong (accepts `04JUL`, `04JUL26`, `4/7/26`
or a bare day number like `4`; leave a side blank for an open end). Any hotel
booking that checks in outside the range is **out of scope**: never matched, never
proposed as a cancellation, passed through to the new page untouched, and shown
dimmed with an "Out of range" tag and its own summary chip. Year-end windows
(28DEC–03JAN) are handled correctly, and masters whose date column is just a day
number ("4", "7") are understood.

## Other behaviours worth knowing

- **Chronological order**: approved new bookings are inserted into the page by
  check-in date, not appended at the bottom.
- **Paste geometry**: the copied page carries the standard column widths
  (A 127px · B–F 96 · G–H 103 · I–J 170 · K 56 · L 162 · M–P 96) plus
  left-justified, vertically-centred, wrap-on formatting for every cell — paste
  and it looks right with no manual formatting.
- **VMO master exports parse natively**: columns are located by their header
  names (the extra Arrive to / Arrive From / Depart to columns don't shift
  anything), and bare day-number dates are anchored to full dates using the
  Check-in(UTC)/Check-Out(UTC) timestamps.
- **Pairing codes are never change proposals**: they churn constantly, so a
  code difference alone is ignored. Matching still uses them (equal code +
  check-in date is the strongest signal). The one write happens on a **silent
  pairing split** — when the master lists one hotel row's crew as separate
  rows, the hotel row is kept whole and its pairing cell becomes
  "Pairing short code X, Y". No new row is created.
- **Check-in immutability**: a check-in that has already occurred is locked —
  no check-in date/time proposals, no cancellation of a started stay, no new
  rows in the past. Check-OUT updates on such rows still flow through.
  Unmatched past rows appear as *Historical*, untouched.
- **Grey / struck-through = cancelled earlier**: the tool reads cell
  formatting straight out of the .xlsx. A greyed or crossed-out *name* inside
  a live row is a kept-for-the-record cancellation — never treated as a name
  change, never overwritten. A fully struck/grey *row* is "Cancelled earlier":
  never matched, never re-proposed, carried into the output with its
  formatting intact.
- **Name removals are red**: when the master drops one person from a shared
  room, the name stays on the sheet painted red and struck through, and the
  proposal is listed under *Possible cancellations* (it is a cancellation of
  that person's spot, not a blue "name change").
- **Separate stays never merge**: a match is rejected outright if it would
  move a check-in by more than 2 days, so a pilot's next stay can never be
  mistaken for an "extension" of the current one (no silently stretched —
  and paid — hotel nights).
- **Delta view by default**: the review opens showing changed items only;
  "Show all rows" reveals unchanged/out-of-range/historical bookings.
- **Footer**: trailing notes under the data are dropped and the output always
  ends with "Property of CargoJet Crew Scheduling Group". A "Download for
  Excel" button saves the formatted page as an Excel-openable file.
- **Calibration**: the `dev/` folder holds the full test pipeline, including
  golden fixtures built from real (fake-data) spreadsheets. Any wrong
  suggestion seen in the field becomes a fixture there before it is fixed, so
  accuracy only ratchets up.

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
