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
3. **Review** — every proposed change starts **unapproved**. Approve items
   individually or per-section:
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

Excel parsing by [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0),
embedded in the file.
