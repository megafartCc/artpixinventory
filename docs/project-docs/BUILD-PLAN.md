# ArtPix Inventory App — Build Plan

## Before You Start

### One-Time Setup (15 minutes)

1. **Create GitHub repo:**
   - Go to github.com → New Repository → name: `artpix-inventory` → Private → Create
   
2. **Clone it:**
   ```bash
   cd ~/projects  # or wherever you keep code
   git clone https://github.com/YOUR_USERNAME/artpix-inventory.git
   cd artpix-inventory
   ```

3. **Copy CLAUDE.md and PROGRESS.md into the folder:**
   - Put both files in the root of `artpix-inventory/`

4. **Set up Railway:**
   - Go to railway.app → New Project
   - Add PostgreSQL database
   - Copy the DATABASE_URL (you'll need it in Session 1)

5. **Set up Google OAuth:**
   - Go to console.cloud.google.com
   - Create OAuth 2.0 credentials (Web Application)
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Copy GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

6. **Install Claude Code** (if not already):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

---

## How Each Session Works

```
1. Open terminal
2. cd artpix-inventory
3. Run: claude
4. Paste the prompt below
5. Let Claude Code build
6. Test (run: npm run dev, open localhost:3000)
7. Fix any issues (tell Claude Code what's wrong)
8. Commit: git add -A && git commit -m "Session X: description"
9. Push: git push
10. Update PROGRESS.md
```

**If something breaks:** Start a new Claude Code session and say:
"Read CLAUDE.md. The [X] is broken — [what's wrong]. Fix it without changing anything else."

---

## SESSION 1: Project Init + Schema

**Prompt:**
```
Read CLAUDE.md. Initialize the project:

1. Create Next.js 14 project with TypeScript and App Router
2. Install dependencies: prisma, @prisma/client, next-auth, @auth/prisma-adapter, next-intl, bcryptjs
3. Install Shadcn/ui (init with default style, slate color, CSS variables)
4. Set up Prisma with the FULL schema from CLAUDE.md
5. Create .env.local with these variables (I'll fill in values):
   DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL=http://localhost:3000,
   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
6. Run prisma db push to create tables
7. Create prisma/seed.ts with:
   - 5 product indexes (3D Crystals, 2D Crystals, Light Bases, Glass Ornaments, Metal Ornaments)
   - Location tree: Main Warehouse > [Receiving Area (type:RECEIVING), Zone A-Crystals > Shelf A1/A2/A3, Zone B-Accessories > Shelf B1/B2, Zone C-Light Bases, Production Floor (type:PRODUCTION), Shipping Area (type:SHIPPING), Quarantine (type:QUARANTINE), Defective Tote (type:DEFECTIVE), Overflow Storage]
   - Auto-generate QR codes for each location (format: LOC-{abbreviation})
   - 4 test users: admin@artpix3d.com (ADMIN), manager@artpix3d.com (MANAGER), purchasing@artpix3d.com (PURCHASER), warehouse@artpix3d.com (WAREHOUSE)
   - 10 sample products with compound IDs: 3CRS, 3CRM, 3CRL, 3CRXL, 3CHS, 3CHM, 3CHL, 3CDS, 3CDM, 3CIM
   - Default settings: default_receiving_location = Receiving Area ID, po_number_prefix = PO
8. Add seed script to package.json: "prisma:seed": "tsx prisma/seed.ts"
9. Run the seed

Don't set up any pages yet, just the foundation.
```

**After this session:**
- Fill in your .env.local values (DATABASE_URL from Railway, Google OAuth credentials)
- Run `npx prisma db push` and `npm run prisma:seed`
- Verify with `npx prisma studio` that data exists

---

## SESSION 2: Auth + Role Middleware

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Set up authentication:

1. Configure NextAuth with Google OAuth provider and Prisma adapter
2. Create middleware.ts that protects all routes except /login and /api/auth
3. Create a role-based access utility (lib/permissions.ts) that checks user role against required role for each action. Use the permissions table from CLAUDE.md.
4. Create /login page with "Sign in with Google" button. Clean design, centered, ArtPix 3D branding.
5. After login, redirect to / (dashboard)
6. Create a basic /page.tsx that just says "Dashboard - Coming Soon" and shows the logged-in user's name and role
7. Create lib/prisma.ts (singleton client)

Test: I should be able to log in with Google and see my name on the dashboard.
```

---

## SESSION 3: Layout + i18n

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build the app shell:

1. Set up next-intl with EN, RU, UA locales. Create messages/en.json, messages/ru.json, messages/uk.json with translations for: navigation items, common buttons (Save, Cancel, Delete, Edit, Create, Search, Export, Back), role names, common labels.
2. Create the responsive layout:
   - Desktop: collapsible sidebar with these sections:
     Dashboard, Products (All Products, Import, Indexes, Categories), Locations, Machines, Stock Levels, Vendors, Purchase Orders, Receiving, Vendor Credits, Defects, Inventory Counts, Transfers, Labels, Reports, Settings (Admin only)
   - Mobile: bottom tab bar with 5 tabs: Home, Stock, Scan, Transfers, More (More opens full menu)
   - Header with: ArtPix 3D logo/text, locale switcher (EN/RU/UA dropdown), user avatar + role badge, sign out
3. Sidebar items should highlight the active page
4. Sidebar should be collapsible (icon-only mode) on desktop
5. Apply this layout to all pages via app/[locale]/layout.tsx
6. Create placeholder pages for each nav item (just the heading + "Coming Soon")

Test: Navigate all sidebar items, switch language, check mobile view.
```

---

## SESSION 4: Products Module

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build the Products module:

1. Products list page (/products):
   - Searchable by Compound ID or name
   - Filter by Index (dropdown) and Category (dropdown)
   - Table: Compound ID, Name, Index, UOM, Min Stock, Avg Cost, Active
   - Click row → product detail page
   - "New Product" button (hidden for WAREHOUSE role)
2. Product create page (/products/new):
   - Form: compoundId, name, index (select), categories (multi-select), uom (select from: pcs, box, ltr, kg, set), barcode, minStock, notes
   - Packaging section: itemsPerBox, boxesPerPallet, itemWeight (optional, for overseas vendor products)
   - Packaging image upload (to S3 if configured, or local for now)
   - Save → redirect to product list
3. Product edit page (/products/[id]/edit) — same form, pre-filled
4. Product detail page (/products/[id]):
   - Product info card
   - Stock by location table (all locations where this product has stock)
   - Vendor mapping section (which vendors supply this, default vendor, MOQ, lead time)
5. Deactivate button (sets active=false, product hidden from lists)
6. API routes for all CRUD operations with Zod validation

Test: Create a product, edit it, view stock, deactivate it.
```

---

## SESSION 5: Indexes + Categories + CSV Import

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build:

1. Indexes page (/indexes):
   - Simple CRUD list. Name, description, active toggle.
   - Can't delete an index that has products.
2. Categories page (/categories):
   - Nested tree view (parent/child). Show hierarchy visually with indentation.
   - Create category with optional parent.
   - Edit, deactivate. Can't delete if products assigned.
3. CSV Import page (/products/import):
   - Upload CSV file
   - Column mapping UI: user matches CSV columns to fields (compoundId, name, index, category, uom, barcode, minStock)
   - Preview table showing first 10 rows mapped
   - "Import" button → creates products
   - Show results: X created, X skipped (duplicates), X errors
   - If a product with same compoundId exists, skip it (don't overwrite)
   - Support setting initial stock levels: if CSV has "quantity" and "location" columns, create StockLevel records with INITIAL_SETUP adjustment reason

Test: Export a CSV from inFlow, import it, verify products created correctly.
```

---

## SESSION 6: Locations + QR Codes

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build:

1. Locations page (/locations):
   - Tree view showing full hierarchy (Warehouse > Zone > Shelf > Bin)
   - Show location type as a badge
   - Show QR code value
   - Create location: name, type (dropdown), parent (select from tree), description
   - Edit, deactivate
   - When creating, auto-generate qrCode: "LOC-" + abbreviation from name
2. QR Code generation for every location:
   - Generate QR image on the fly (using bwip-js or qrcode library)
   - Show QR code preview next to each location in the tree
3. All locations from the seed should already be visible

No label printing yet — that comes later.

Test: View the full tree from seed data. Create a new sublocation. See its QR code.
```

---

## SESSION 7: Machines

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build:

1. Machines page (/machines):
   - List all 44 machines. Table: Name, Type (STN/VITRO badge), Assigned Sublocation, ERPIX Machine ID, Active
   - Create machine: name, type (STN/VITRO), assigned sublocation (location picker — only PRODUCTION type locations and their children), erpixMachineId (optional), notes
   - Edit machine
   - "Sync from ERPIX" button (placeholder for now — just shows a toast "ERPIX sync not configured yet")
2. Machine detail page (/machines/[id]):
   - Machine info card
   - Assigned sublocation with current stock levels at that sublocation
   - Consumption history (empty for now, will be populated by ERPIX later)
   - Defect history (empty for now)
3. Seed script update: add 44 machines (STN-01 through STN-33, Vitro-01 through Vitro-11). Assign each to a placeholder production sublocation. Create the sublocations if they don't exist (e.g., "STN-01 Station", "Vitro-05 Station" as children of Production Floor).

Test: See all 44 machines. Edit one. Check its sublocation.
```

---

## SESSION 8: Stock Levels

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build:

1. Stock Levels page (/stock):
   - Grid/table view: rows = products (compoundId, name), columns grouped by location
   - Each cell shows quantity, color-coded: green (>minStock), yellow (>0 but near minStock), red (<=0 or below minStock)
   - If product has reservations, show "Available: X" below the total
   - Search by compound ID or name
   - Filter by Index, Category, Location
   - "Export CSV" button — exports the current filtered view
   - Click a cell → opens adjustment modal
2. Stock adjustment modal:
   - Shows current qty, input for new qty
   - Reason dropdown (COUNT_VARIANCE, DAMAGE, LOSS, FOUND, CORRECTION, OTHER)
   - Notes field
   - On save: update StockLevel, create StockAdjustment record, create ActivityLog with beforeQty/afterQty
   - Only Admin/Manager can adjust
3. Create some sample stock levels in the seed (e.g., 100x 3CRS at Shelf A1, 50x 3CRM at Shelf A2, etc.)

Test: View grid, filter, export CSV, make an adjustment, verify ActivityLog.
```

**After Session 8: DEPLOY TO RAILWAY**

```
Prompt for deployment:
Read CLAUDE.md. Set up Railway deployment:
1. Create a Procfile or railway.json for Next.js
2. Make sure prisma generate runs during build
3. Add all required environment variables to Railway
4. Set up prisma db push as part of deployment
```

At this point you have a working app with products, locations, machines, and stock visibility. The team can start looking at real data.

---

## SESSION 9: Vendors + Product-Vendor Mapping

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build:

1. Vendors page (/vendors):
   - List: name, country, payment terms, lead time, active
   - Create/edit vendor: name, contact name, email, phone, address, country, payment terms, default lead time, notes, enableContainerConstraints (checkbox), default container template (select, only if checkbox on)
2. Vendor detail page (/vendors/[id]):
   - Vendor info card
   - Product mapping section: table of products this vendor supplies
   - Add product mapping: product (search), isDefault, MOQ, unit cost, lead time, vendor SKU
   - PO history (list of POs for this vendor — empty for now)
3. Container Templates page (/container-templates):
   - Simple CRUD: name, maxWeightKg, maxPallets, maxLooseBoxes, description
   - Pre-seed: "20ft Container" (18000kg, 10 pallets, 80 boxes), "40ft Container" (20000kg, 21 pallets, 189 boxes), "40ft HC" (20000kg, 24 pallets, 220 boxes)

Test: Create vendors, map products, create container templates.
```

---

## SESSION 10: PO Creation

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build PO creation:

1. PO list page (/purchase-orders):
   - Status filter tabs: All, Draft, Pending Approval, Approved, Ordered, Receiving, Closed
   - Table: PO#, Vendor, Status, Order Date, Expected Date, Total, Created By
   - Click → PO detail page
2. PO create page (/purchase-orders/new):
   - Select vendor (dropdown). On select, auto-fill lead time.
   - Vendor Order ID (optional text field)
   - Line items section:
     - "Add Item" → product search (autocomplete by compound ID or name)
     - When product selected: auto-fill unit cost from ProductVendor default
     - If qty < MOQ: show yellow warning "Below MOQ of X"
     - Columns: Product, Qty, Unit Cost, Total
     - Remove item button
   - Container constraint calculator (only if vendor has enableContainerConstraints):
     - Select container template (dropdown, defaults to vendor's default)
     - Real-time display: Total Weight: X/Y kg, Pallets: X/Y, Loose Boxes: X/Y
     - Progress bars for each. Red when exceeded.
     - Loose boxes from different products should be stacked into shared pallets
   - Cost section: Subtotal (auto), Shipping Cost, Other Costs, Total (auto)
   - Notes field
   - "Save as Draft" and "Submit for Approval" buttons
   - Auto-generate PO number: PO-YYYY-NNNN
   - Auto-calculate expected date: orderDate + vendor lead time

Test: Create a PO with multiple items. Check container calculator. Save as draft. Submit for approval.
```

---

## SESSION 11: PO Approval + PDF + Duplicate

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build:

1. PO detail page (/purchase-orders/[id]):
   - Full PO info: vendor, dates, status, costs, constraint warnings
   - Line items table
   - Documents section (upload files with a label field — "CI", "PL", etc.)
   - Status action buttons (based on current status and user role):
     - DRAFT: "Edit", "Submit for Approval", "Delete"
     - PENDING: "Approve" (Admin/Manager), "Reject" (back to Draft)
     - APPROVED: "Mark as Ordered"
     - ORDERED: "Go to Receiving"
     - Any status: "Duplicate PO" → creates new DRAFT with same vendor, items, costs
   - Cancel button: only if status is DRAFT/PENDING/APPROVED/ORDERED and receivedQty is 0 for all items
   - Receiving history section (list of receiving sessions — empty until receiving is built)
2. PO edit page (/purchase-orders/[id]/edit) — same form as create, only for DRAFT/PENDING
3. PO PDF export — "Export PDF" button on detail page:
   - Professional layout: ArtPix 3D header, PO details, line items table, totals
   - Downloads as PDF

Test: Full PO lifecycle: create → submit → approve → mark ordered → duplicate. Export PDF.
```

---

## SESSION 12: Receiving + Pallets

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build receiving with pallets:

1. Receiving page (/receiving):
   - Step 1: Select vendor (dropdown, filtered: only vendors with ORDERED or PARTIALLY_RECEIVED POs)
   - Step 2: Select PO (dropdown, filtered to that vendor's open POs)
   - Step 3: Show line items table: Product, Ordered, Already Received, Remaining, Receive Qty (input), Damaged Qty (input), Notes
   - Step 4: "Complete Receiving" button
   - On complete:
     - Create ReceivingSession (locationId = default receiving location from Settings)
     - Create ReceivingItems
     - Update POItem.receivedQty (running total)
     - Update PO status (PARTIALLY_RECEIVED or RECEIVED)
     - Add stock to Receiving Area location
     - Recalculate Product.avgCost (weighted average with landed cost)
     - Create ActivityLog entries for each stock change
     - If damaged > 0, show toast: "X damaged items — move to Quarantine?"

2. Pallet creation (on same page, after receiving):
   - "Create Pallet" button → modal:
     - Shows received items with remaining-to-palletize quantities
     - Select items + qty for this pallet
     - "Create" → generates PAL-YYYY-NNNN
     - "Print QR" button → generates ZPL with pallet number, sends to Zebra
   - Can create multiple pallets

3. Pallet placement page (/receiving/place):
   - "Scan Pallet QR" → opens camera scanner
   - After scan: shows pallet contents
   - "Scan Sublocation QR" → opens camera scanner
   - After scan: confirms placement
   - On confirm: move stock from Receiving Area to scanned sublocation, pallet status → PLACED
   - ActivityLog for each stock move

Test: Receive a PO. Create 2 pallets. Print QR. Place each at different sublocations. Verify stock moved.
```

---

## SESSION 13: Pick-and-Drop Transfers

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build pick-and-drop transfers:

1. Transfers list page (/transfers):
   - Table: Reference, Status, Created By, Started, Items count, Completed
   - Status badges: COLLECTING (blue), DROPPING (orange), COMPLETED (green), CANCELLED (gray)

2. New transfer — mobile-first interface (/transfers/new):
   
   COLLECTION MODE (default when starting):
   - Big "Scan Location" button → opens camera QR scanner
   - After scanning sublocation QR:
     - Show location name and stock at this location
     - User selects product from stock list, enters quantity
     - "Add to Cart" button
     - Stock deducted from this sublocation immediately
     - ActivityLog entry
   - Cart display at bottom: shows all picked items (product, qty, from location)
   - "Scan Another Location" to continue collecting
   - "Switch to Drop-Off" button (prominent)
   
   DROP-OFF MODE:
   - "Scan Destination" button → opens camera QR scanner
   - After scanning sublocation QR:
     - Show location name
     - Show cart items. User selects which to drop here and qty.
     - "Drop" button → stock added to this sublocation
     - ActivityLog entry
   - Cart updates (shows remaining)
   - "Scan Another Destination" to continue
   - When cart is empty → transfer auto-completes
   
   Validation:
   - Can't switch back to COLLECTING after starting DROP-OFF
   - On completion, verify: total picked per product = total dropped per product
   - If user cancels mid-transfer: all picked stock is returned to original locations

3. Transfer detail page (/transfers/[id]):
   - All picks and drops listed with locations, quantities, timestamps

Test: Start transfer on mobile. Scan 2 sublocations (use QR codes from seed). Add items. Switch to drop-off. Scan destinations. Complete. Verify stock moved correctly.
```

---

## SESSION 14: Blind Inventory Counts

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build inventory counts:

1. Counts list page (/counts):
   - Table: Name, Location, Type, Status, Assigned To, Started, Variances count
   - "New Count" button
   - "Duplicate" button on each row (copies location, type, assigns same person)

2. Create count (/counts/new):
   - Name, location (picker), type (FULL/CYCLE/SPOT), assign to user, notes
   
3. Count scan interface (/counts/[id]) — mobile-first:
   - If status is IN_PROGRESS and user is the assigned person:
   - Big "Scan" button → opens camera barcode scanner
   - After scan: shows product name and compound ID ONLY (no expected qty — blind count!)
   - Input: counted quantity + optional notes
   - "Submit Entry" → saves CountEntry (expectedQty filled from current StockLevel but hidden)
   - List of scanned entries below
   - "Submit Count" button when done → status → SUBMITTED → Slack #inventory-alerts

4. Review page (/counts/[id]/review) — Admin/Manager only:
   - Table: Product, Expected Qty, Counted Qty, Variance
   - Variance highlighted: green (0), yellow (small), red (large)
   - "Approve" button → for each entry with variance:
     - Update StockLevel
     - Create StockAdjustment (reason: COUNT_VARIANCE)
     - ActivityLog
   - Status → APPROVED

Test: Create count, scan items, submit, review variances, approve.
```

---

## SESSION 15: Label Printing

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build label printing:

1. Labels page (/labels):
   Three tabs: Product Labels, Location Labels, Pallet Labels
   
   Product Labels tab:
   - Search/select products (multi-select)
   - Set quantity per product
   - Preview: shows label layout (Compound ID + Code 128 barcode + product name)
   - "Print" button → generates ZPL → sends to Zebra via Zebra Browser Print SDK
   
   Location Labels tab:
   - Shows all locations in tree
   - Select which ones to print (checkboxes)
   - Preview: QR code + location name + type
   - "Print Selected" → ZPL to Zebra
   - "Print All" → all sublocations
   
   Pallet Labels tab:
   - Shows recent pallets (READY status)
   - "Print" button per pallet
   - Preview: QR with pallet number + pallet ID text

2. Install Zebra Browser Print SDK (JS library for browser-to-Zebra communication)
3. Create lib/barcode.ts and lib/zpl.ts for barcode/QR generation and ZPL formatting

Test: Generate product barcode, location QR, pallet QR. If no Zebra printer, test that ZPL is generated correctly (show preview).
```

---

## SESSION 16: Defects

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build defect management:

1. Defect reasons management:
   - Page or section in settings showing all defect reasons
   - "Sync from ERPIX" button (placeholder for now — creates sample reasons)
   - Each reason shows: name, fault type (VENDOR/INTERNAL badge), ERPIX ID
   - Create sample reasons: "Cracked crystal" (VENDOR), "Surface defect" (VENDOR), "Wrong dimensions" (VENDOR), "Engraving error" (INTERNAL), "Handling damage" (INTERNAL)

2. Batch defect report form (/defects/new):
   - Source: PRE_PRODUCTION (default for manual reports)
   - Multi-item form:
     - Row: product (search), quantity, reason (dropdown), notes
     - "Add Item" button for more rows
     - Each row shows fault type badge based on selected reason
   - From location (where items were before defective tote)
   - Notes for overall report
   - "Submit" → creates DefectReport + DefectItems

3. Defect review page (/defects/review) — Admin/Manager:
   - List of PENDING_REVIEW reports
   - Click to expand: see all items with reasons and fault types
   - "Confirm" button per report:
     - Status → CONFIRMED
     - For each item: deduct stock from fromLocation, create StockAdjustment (DEFECT_SCRAP)
     - For VENDOR fault items: set vendorCreditSuggested=true, show banner "Suggest creating vendor credit for X items"
     - Slack #quality

4. Defects list page (/defects):
   - Table: Report#, Source, Status, Items count, Fault summary, Date

5. ERPIX defect endpoint (POST /api/erpix/consume):
   - Already handles consumption. Add: if payload includes "defect" object:
     - Create DefectReport (source: PRODUCTION) + DefectItem
     - Auto-confirm (from ERPIX, already verified by supervisor)
     - If vendor fault → vendorCreditSuggested + Slack

Test: Create batch defect report. Review and confirm. Check stock deducted. Check vendor credit suggestion.
```

---

## SESSION 17: ERPIX Integration

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build ERPIX integration:

1. POST /api/erpix/consume:
   - Accepts: { erpixMachineId, compoundId, quantity, erpixOrderId?, operatorName?, defect?: { erpixReasonId, isDefective } }
   - Validate ERPIX_API_KEY header
   - Look up machine by erpixMachineId → get assigned locationId
   - Deduct stock from assigned sublocation
   - Check if sublocation stock was <=0 → isCorrectLocation=false → Slack #inventory-alerts
   - If defect present: create DefectReport+DefectItem, auto-confirm, check vendor credit
   - Create MachineConsumption record
   - ActivityLog
   - Retry wrapper: 3 attempts, 10s between

2. POST /api/erpix/reserve:
   - Accepts: { compoundId, quantity, erpixOrderId }
   - Create StockReservation (RESERVED)
   
3. POST /api/erpix/reserve/[id]/fulfill — mark as FULFILLED
4. POST /api/erpix/reserve/[id]/cancel — mark as CANCELLED

5. POST /api/erpix/sync/machines:
   - Placeholder: accepts array of { name, type, erpixMachineId }
   - Updates existing machines' erpixMachineId or creates new ones

6. POST /api/erpix/sync/defect-reasons:
   - Accepts array of { erpixReasonId, name, faultType }
   - Upserts DefectReason records

7. POST /api/erpix/sync/products:
   - Accepts array of { erpixId, imageUrl, weight, length, width, height }
   - Updates matching products

8. Create lib/erpix-client.ts with retry logic (3 attempts, 10s, Slack on failure)

Test: Use Postman/curl to call each endpoint. Verify stock changes, notifications, error handling.
```

---

## SESSION 18: Production Queue

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build production queue:

1. Cron job (jobs/production-queue-check.ts):
   - Calls ERPIX API endpoint to get remaining production per machine for today
   - For now, create a placeholder that generates sample data
   - For each machine: compare needed qty vs stock at assigned sublocation
   - If insufficient: create ProductionQueueItem (sufficient=false), send Slack #warehouse-ops
   - Message: "🔧 STN-07 needs 40× 3CRS, sublocation has 10. Restock from [nearest location with stock]."

2. Production page (/production):
   - Dashboard of all machines
   - Cards or table: Machine name, Product needed, Qty needed, Qty in stock, Status (sufficient/restock needed)
   - Color coding: green (ok), red (needs restock)
   - Last synced timestamp
   - "Sync Now" button (triggers the check manually)

3. Set up Railway cron to run the check every hour

Test: Run the check manually. See which machines need restocking. Verify Slack message.
```

---

## SESSION 19: Vendor Credits

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build vendor credits:

1. Credits list (/credits):
   - Table: Credit#, Vendor, PO#, Reason, Total Amount, Status, Date
   - Filter by status, vendor

2. Create credit (/credits/new):
   - Select vendor
   - Optionally link to PO (dropdown filtered to that vendor's POs)
   - Reason dropdown (DAMAGED_GOODS, MISSING_ITEMS, WRONG_ITEMS, QUALITY_ISSUE, OTHER)
   - Line items: product, quantity, unit cost, total (auto-calc)
   - Notes
   - Pre-fill from defect report if coming from "Suggest vendor credit" link

3. Credit detail page:
   - All info + line items
   - Status management: PENDING → APPROVED → APPLIED → CLOSED

Test: Create credit from defect suggestion. Create manual credit. Move through statuses.
```

---

## SESSION 20: Reports + QBO Export

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build reports:

1. Reports hub page (/reports) — links to each report

2. Stock Levels report (/reports/stock-levels):
   - Filterable by index, category, location
   - Table with totals
   - "Export CSV" button

3. PO Aging report (/reports/po-aging):
   - All open POs
   - Columns: PO#, Vendor, Status, Order Date, Expected Date, Days in Status, Days Overdue
   - Highlight overdue in red
   - Sort by most overdue first

4. Defect report (/reports/defects):
   - Filter by: date range, vendor, machine, operator, product
   - Summary cards: total defects, vendor vs internal split, top defective product
   - Table with details
   - "Generate Vendor Summary" button: select vendor + date range → generates a report of all defects from that vendor (for disputes)

5. Production Daily report (/reports/production):
   - Date picker (default: today)
   - Consumption by machine, by operator, by product
   - Defects breakdown included
   - Summary: total consumed, total defective, defect rate %

6. QBO Export (/reports/qbo-export):
   - Date range picker
   - Generates CSV formatted for QuickBooks import
   - Includes: received items with landed costs, adjustments, defect scraps

Test: Generate each report. Export CSV. Verify data accuracy.
```

---

## SESSION 21: Dashboard + Slack + Settings

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Build final pieces:

1. Dashboard (/ page):
   - Summary cards: Total Products, Low Stock Alerts (count), Open POs, Pending Approval, Active Defects
   - Alerts section: low stock items, overdue POs, recent wrong-location events, production restock needed
   - Recent activity feed (last 20 ActivityLog entries, formatted nicely)
   - Active counts and transfers

2. Slack notification integration (lib/slack.ts):
   - Send to correct channel based on notification type (use SLACK_WEBHOOK_* env vars)
   - Create Notification record in DB
   - Wire up all notification triggers:
     - Stock below minStock → #inventory-alerts
     - Wrong location → #inventory-alerts
     - PO submitted for approval → #purchasing
     - PO overdue check (daily cron) → #purchasing
     - Defect reported → #quality
     - Vendor credit suggested → #quality
     - Production restock needed → #warehouse-ops
     - ERPIX sync failure → #system-errors

3. Daily cron jobs:
   - Low stock check: scan all products, compare stock vs minStock
   - PO aging check: find POs past expectedDate

4. Settings page (/settings) — Admin only:
   - Default receiving location (dropdown)
   - PO number prefix
   - Slack webhook URLs (5 fields)
   - ERPIX API key display (masked)

Test: Check dashboard with real data. Trigger each Slack notification type. Verify cron jobs.
```

---

## SESSION 22: Polish + Bug Fixes

**Prompt:**
```
Read CLAUDE.md and PROGRESS.md. Final polish:

1. Go through every page and verify:
   - Role-based access is enforced (try accessing admin pages as warehouse user)
   - Translations work in all 3 languages (check key pages)
   - Mobile responsiveness (sidebar collapses, bottom nav works)
   - All forms validate properly (try empty submissions, duplicates)
   - Loading states on all buttons and pages
   - Error handling (show user-friendly messages, not stack traces)
2. Add "active" toggles where missing
3. Make sure deactivated products don't appear in:
   - PO item search
   - Count scan
   - Transfer pick
   - Defect report
4. Add empty states ("No products found", "No open POs", etc.)
5. Fix any console errors or warnings
```

---

## After All Sessions: Migration from inFlow

1. Export products CSV from inFlow → import via /products/import
2. Export vendor list → create in /vendors
3. Export stock levels → import as initial stock (manual or CSV + adjustment)
4. Print QR codes for ALL sublocations
5. Register machines + assign sublocations
6. Create test PO, receive it, place pallet
7. Do a test transfer
8. Do a test count
9. Train team
10. Hard cutover
