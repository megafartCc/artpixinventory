# ArtPix 3D Inventory Management System

## Project Context
Custom inventory management system for ArtPix 3D (3D crystal photo gifts, Chicago, IL). Replacing inFlow Inventory. ~500 SKUs, 44 laser engraving machines, 1 warehouse.

## Tech Stack
- **Framework:** Next.js 14, App Router, TypeScript
- **UI:** Shadcn/ui + Tailwind CSS
- **Database:** PostgreSQL (Railway)
- **ORM:** Prisma
- **Auth:** NextAuth.js with Google OAuth (ArtPix Google Workspace)
- **i18n:** next-intl (EN, RU, UA — all three from day one)
- **Hosting:** Railway (app + DB)
- **Barcode/QR scan:** html5-qrcode (browser camera)
- **Label printing:** bwip-js + ZPL → Zebra printer via Browser Print SDK
- **File storage:** AWS S3 (PO documents)
- **Notifications:** Slack API (5 webhook channels)
- **PDF:** @react-pdf/renderer (PO export)
- **Cron:** Railway cron (hourly production check, daily alerts)

## Terminology
- **Compound ID** = SKU (e.g., 3CRS, 3CRM). This is what ArtPix calls their SKU.
- **Index** = Product flow type that determines production routing in ERPIX (e.g., "3D Crystals", "2D Crystals", "Light Bases", "Glass Ornaments", "Metal Ornaments")
- **Category** = Flexible nested grouping. User-created. Products can belong to multiple.
- **UOM** = Unit of measure. One per product (pcs, box, ltr).
- **CI/PL** = Commercial Invoice / Packing List — documents attached to POs.
- **STN** = Standard laser engraving machine (33 units)
- **Vitro** = German Vitro laser engraving machine (11 units)
- **Pallet** = Temporary grouping for receiving. Gets QR label. Closed after items placed at sublocation.
- **Pick-and-Drop** = Transfer method: collect items from multiple sublocations into a "cart", then drop at multiple destinations. All via QR scanning.

## Key Rules
1. Every stock change MUST create an ActivityLog entry with `{ beforeQty, afterQty, productId, locationId }` in the details JSON. This is used for historical stock reconstruction.
2. Stock levels CAN go negative. This is intentional — it signals discrepancies (e.g., machine consumed from empty sublocation).
3. Inventory counts are BLIND — the `expectedQty` is stored but NEVER shown to the person counting. Only shown during manager review.
4. PO receiving ALWAYS goes to the default receiving location (stored in Settings as "default_receiving_location"). No location picker during receiving.
5. Pallets are temporary — once items are placed at a sublocation, the pallet is CLOSED and no longer tracked.
6. Deactivated products (active=false) are HIDDEN from all lists, POs, counts, etc. Historical data preserved.
7. All ERPIX API endpoints authenticate via `ERPIX_API_KEY` header.
8. ERPIX retry logic: 3 attempts, 10 seconds between. On final failure → Slack #system-errors.
9. Container constraint warnings are NON-BLOCKING. User can always proceed.
10. Defect reasons are synced FROM ERPIX (not created locally). Each reason has a pre-mapped faultType (VENDOR or INTERNAL).
11. Auto-number formats: PO-YYYY-NNNN, TR-YYYY-NNNN, DEF-YYYY-NNNN, VC-YYYY-NNNN, PAL-YYYY-NNNN.

## 4 User Roles
| Action | Admin | Manager | Purchaser | Warehouse |
|--------|:-----:|:-------:|:---------:|:---------:|
| View stock | ✅ | ✅ | ✅ | ✅ |
| Manage products/indexes/categories | ✅ | ✅ | ✅ | ❌ |
| CSV import | ✅ | ✅ | ✅ | ❌ |
| Manage machines | ✅ | ✅ | ❌ | ❌ |
| Create PO | ✅ | ✅ | ✅ | ❌ |
| Approve PO | ✅ | ✅ | ❌ | ❌ |
| Receive PO + pallets | ✅ | ✅ | ✅ | ✅ |
| Batch defect report | ✅ | ✅ | ❌ | ❌ |
| Confirm defect | ✅ | ✅ | ❌ | ❌ |
| Count inventory | ✅ | ✅ | ❌ | ✅ |
| Approve count | ✅ | ✅ | ❌ | ❌ |
| Pick-and-drop transfer | ✅ | ✅ | ❌ | ✅ |
| Stock adjustment | ✅ | ✅ | ❌ | ❌ |
| Manage vendors | ✅ | ✅ | ✅ | ❌ |
| Vendor credits | ✅ | ✅ | ✅ | ❌ |
| Print labels | ✅ | ✅ | ✅ | ✅ |
| Container templates | ✅ | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ |

## UI Conventions
- Mobile-first responsive design. Warehouse staff use Android phones/tablets.
- Big touch targets for warehouse use (minimum 44px).
- Desktop: collapsible sidebar navigation.
- Mobile: bottom tab bar (Home, Stock, Scan, Transfers, More).
- Use Shadcn/ui components everywhere. Don't build custom components when Shadcn has one.
- Color coding for stock: green (above min), yellow (approaching min), red (below min or zero).
- Status badges for POs, transfers, counts, defects (use consistent color scheme).
- Locale switcher in header (EN/RU/UA).
- All dates displayed in user's locale format.

## API Conventions
- All mutations through API routes (app/api/).
- Validate inputs with Zod.
- Return consistent JSON: `{ data, error, message }`.
- Use Prisma transactions for any operation that touches multiple tables.
- ActivityLog on every stock-changing operation.

## Slack Channels
- `#inventory-alerts` — low stock, wrong location
- `#purchasing` — PO approval, PO overdue
- `#quality` — defects, vendor credit suggestions
- `#warehouse-ops` — production restock needed
- `#system-errors` — ERPIX failures

## Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  image         String?
  role          UserRole @default(WAREHOUSE)
  locale        String   @default("en")
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  accounts      Account[]
  sessions      Session[]
  countSessions          CountSession[]
  countEntries           CountEntry[]
  transfersCreated       Transfer[]          @relation("TransferCreatedBy")
  adjustments            StockAdjustment[]
  activityLogs           ActivityLog[]
  purchaseOrdersCreated  PurchaseOrder[]     @relation("POCreatedBy")
  purchaseOrdersApproved PurchaseOrder[]     @relation("POApprovedBy")
  receivingSessions      ReceivingSession[]
  vendorCreditsCreated   VendorCredit[]
  defectReportsCreated   DefectReport[]      @relation("DefectCreatedBy")
  defectReportsReviewed  DefectReport[]      @relation("DefectReviewedBy")
}

enum UserRole { ADMIN; MANAGER; PURCHASER; WAREHOUSE }

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model Product {
  id                String   @id @default(cuid())
  compoundId        String   @unique
  name              String
  indexId           String
  barcode           String?  @unique
  uom               String   @default("pcs")
  imageUrl          String?
  packagingImageUrl String?
  weight            Decimal? @db.Decimal(10,3)
  length            Decimal? @db.Decimal(10,2)
  width             Decimal? @db.Decimal(10,2)
  height            Decimal? @db.Decimal(10,2)
  dimensionUnit     String?  @default("in")
  weightUnit        String?  @default("lb")
  itemsPerBox       Int?
  boxesPerPallet    Int?
  itemWeight        Decimal? @db.Decimal(10,3)
  active            Boolean  @default(true)
  minStock          Int      @default(0)
  avgCost           Decimal  @default(0) @db.Decimal(10,2)
  notes             String?
  erpixId           String?  @unique
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  index             ProductIndex       @relation(fields: [indexId], references: [id])
  categories        ProductCategory[]
  stockLevels       StockLevel[]
  countEntries      CountEntry[]
  transferPicks     TransferPick[]
  transferDrops     TransferDrop[]
  adjustments       StockAdjustment[]
  poItems           POItem[]
  receivingItems    ReceivingItem[]
  palletItems       PalletItem[]
  creditItems       VendorCreditItem[]
  vendors           ProductVendor[]
  reservations      StockReservation[]
  consumptions      MachineConsumption[]
  defectItems       DefectItem[]
}

model ProductIndex {
  id          String    @id @default(cuid())
  name        String    @unique
  description String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  products    Product[]
}

model Category {
  id          String    @id @default(cuid())
  name        String    @unique
  description String?
  parentId    String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  parent      Category?           @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[]          @relation("CategoryTree")
  products    ProductCategory[]
}

model ProductCategory {
  productId   String
  categoryId  String
  product     Product   @relation(fields: [productId], references: [id])
  category    Category  @relation(fields: [categoryId], references: [id])
  @@id([productId, categoryId])
}

model ProductVendor {
  id            String   @id @default(cuid())
  productId     String
  vendorId      String
  isDefault     Boolean  @default(false)
  moq           Int?
  unitCost      Decimal? @db.Decimal(10,2)
  leadTimeDays  Int?
  vendorSku     String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  product       Product  @relation(fields: [productId], references: [id])
  vendor        Vendor   @relation(fields: [vendorId], references: [id])
  @@unique([productId, vendorId])
}

model Location {
  id          String       @id @default(cuid())
  name        String
  type        LocationType
  parentId    String?
  qrCode      String?      @unique
  description String?
  active      Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  parent            Location?    @relation("LocationTree", fields: [parentId], references: [id])
  children          Location[]   @relation("LocationTree")
  stockLevels       StockLevel[]
  countSessions     CountSession[]
  transferPicks     TransferPick[]
  transferDrops     TransferDrop[]
  adjustments       StockAdjustment[]
  receivingSessions ReceivingSession[]
  machines          Machine[]
  defectReports     DefectReport[]
  defectFromReports DefectReport[]   @relation("DefectFromLocation")
  pallets           Pallet[]
  @@unique([name, parentId])
}

enum LocationType { WAREHOUSE; ZONE; SHELF; BIN; PRODUCTION; SHIPPING; QUARANTINE; DEFECTIVE; RECEIVING; OTHER }

model Machine {
  id              String      @id @default(cuid())
  name            String      @unique
  type            MachineType
  erpixMachineId  String?     @unique
  locationId      String
  active          Boolean     @default(true)
  notes           String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  location        Location    @relation(fields: [locationId], references: [id])
  consumptions    MachineConsumption[]
  defectReports   DefectReport[]
  productionQueue ProductionQueueItem[]
}

enum MachineType { STN; VITRO }

model MachineConsumption {
  id                  String   @id @default(cuid())
  machineId           String
  productId           String
  quantity            Int
  expectedLocationId  String?
  isCorrectLocation   Boolean  @default(true)
  erpixOrderId        String?
  operatorName        String?
  notificationSent    Boolean  @default(false)
  consumedAt          DateTime @default(now())
  machine             Machine  @relation(fields: [machineId], references: [id])
  product             Product  @relation(fields: [productId], references: [id])
  @@index([machineId, consumedAt])
  @@index([isCorrectLocation])
}

model ProductionQueueItem {
  id               String   @id @default(cuid())
  machineId        String
  productId        String
  quantityNeeded   Int
  quantityInStock  Int
  sufficient       Boolean  @default(true)
  erpixSyncedAt    DateTime
  notificationSent Boolean  @default(false)
  createdAt        DateTime @default(now())
  machine          Machine  @relation(fields: [machineId], references: [id])
  @@index([machineId, erpixSyncedAt])
}

model StockLevel {
  id          String   @id @default(cuid())
  productId   String
  locationId  String
  quantity    Int      @default(0)
  updatedAt   DateTime @updatedAt
  product     Product  @relation(fields: [productId], references: [id])
  location    Location @relation(fields: [locationId], references: [id])
  @@unique([productId, locationId])
  @@index([locationId])
  @@index([productId])
}

model StockReservation {
  id              String            @id @default(cuid())
  productId       String
  quantity        Int
  erpixOrderId    String
  status          ReservationStatus @default(RESERVED)
  reservedAt      DateTime          @default(now())
  fulfilledAt     DateTime?
  cancelledAt     DateTime?
  product         Product           @relation(fields: [productId], references: [id])
  @@index([productId, status])
  @@index([erpixOrderId])
}

enum ReservationStatus { RESERVED; FULFILLED; CANCELLED }

model Vendor {
  id                         String   @id @default(cuid())
  name                       String   @unique
  contactName                String?
  email                      String?
  phone                      String?
  address                    String?
  country                    String?
  paymentTerms               String?
  defaultLeadTimeDays        Int?
  enableContainerConstraints Boolean  @default(false)
  containerTemplateId        String?
  notes                      String?
  active                     Boolean  @default(true)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  purchaseOrders    PurchaseOrder[]
  vendorCredits     VendorCredit[]
  products          ProductVendor[]
  containerTemplate ContainerTemplate? @relation(fields: [containerTemplateId], references: [id])
}

model ContainerTemplate {
  id              String   @id @default(cuid())
  name            String   @unique
  maxWeightKg     Decimal  @db.Decimal(10,2)
  maxPallets      Int
  maxLooseBoxes   Int
  description     String?
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  vendors         Vendor[]
  purchaseOrders  PurchaseOrder[]
}

model PurchaseOrder {
  id                  String     @id @default(cuid())
  poNumber            String     @unique
  vendorId            String
  vendorOrderId       String?
  status              POStatus   @default(DRAFT)
  orderDate           DateTime   @default(now())
  expectedDate        DateTime?
  containerTemplateId String?
  subtotal            Decimal    @default(0) @db.Decimal(12,2)
  shippingCost        Decimal    @default(0) @db.Decimal(12,2)
  otherCosts          Decimal    @default(0) @db.Decimal(12,2)
  totalCost           Decimal    @default(0) @db.Decimal(12,2)
  totalWeightKg       Decimal?   @db.Decimal(10,2)
  totalPallets        Int?
  totalLooseBoxes     Int?
  constraintWarnings  String[]   @default([])
  duplicatedFromId    String?
  notes               String?
  createdById         String
  approvedById        String?
  approvedAt          DateTime?
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt
  vendor              Vendor              @relation(fields: [vendorId], references: [id])
  containerTemplate   ContainerTemplate?  @relation(fields: [containerTemplateId], references: [id])
  createdBy           User                @relation("POCreatedBy", fields: [createdById], references: [id])
  approvedBy          User?               @relation("POApprovedBy", fields: [approvedById], references: [id])
  items               POItem[]
  documents           PODocument[]
  receivingSessions   ReceivingSession[]
  vendorCredits       VendorCredit[]
}

enum POStatus { DRAFT; PENDING_APPROVAL; APPROVED; ORDERED; PARTIALLY_RECEIVED; RECEIVED; CLOSED; CANCELLED }

model POItem {
  id              String   @id @default(cuid())
  purchaseOrderId String
  productId       String
  orderedQty      Int
  receivedQty     Int      @default(0)
  unitCost        Decimal  @db.Decimal(10,2)
  totalCost       Decimal  @db.Decimal(12,2)
  notes           String?
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  product         Product       @relation(fields: [productId], references: [id])
  receivingItems  ReceivingItem[]
  @@unique([purchaseOrderId, productId])
}

model PODocument {
  id              String   @id @default(cuid())
  purchaseOrderId String
  label           String
  fileName        String
  fileUrl         String
  fileSize        Int?
  uploadedAt      DateTime @default(now())
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
}

model ReceivingSession {
  id              String            @id @default(cuid())
  purchaseOrderId String
  locationId      String
  status          ReceivingStatus   @default(IN_PROGRESS)
  receivedById    String
  notes           String?
  startedAt       DateTime          @default(now())
  completedAt     DateTime?
  purchaseOrder   PurchaseOrder     @relation(fields: [purchaseOrderId], references: [id])
  location        Location          @relation(fields: [locationId], references: [id])
  receivedBy      User              @relation(fields: [receivedById], references: [id])
  items           ReceivingItem[]
  pallets         Pallet[]
}

enum ReceivingStatus { IN_PROGRESS; COMPLETED; CANCELLED }

model ReceivingItem {
  id                  String   @id @default(cuid())
  receivingSessionId  String
  poItemId            String
  productId           String
  receivedQty         Int
  damagedQty          Int      @default(0)
  notes               String?
  receivingSession    ReceivingSession @relation(fields: [receivingSessionId], references: [id], onDelete: Cascade)
  poItem              POItem           @relation(fields: [poItemId], references: [id])
  product             Product          @relation(fields: [productId], references: [id])
}

model Pallet {
  id                  String       @id @default(cuid())
  palletNumber        String       @unique
  receivingSessionId  String
  status              PalletStatus @default(OPEN)
  placedAtLocationId  String?
  placedAt            DateTime?
  createdAt           DateTime     @default(now())
  receivingSession    ReceivingSession @relation(fields: [receivingSessionId], references: [id])
  placedAtLocation    Location?        @relation(fields: [placedAtLocationId], references: [id])
  items               PalletItem[]
}

enum PalletStatus { OPEN; READY; PLACED; CANCELLED }

model PalletItem {
  id          String   @id @default(cuid())
  palletId    String
  productId   String
  quantity    Int
  pallet      Pallet   @relation(fields: [palletId], references: [id], onDelete: Cascade)
  product     Product  @relation(fields: [productId], references: [id])
  @@unique([palletId, productId])
}

model Transfer {
  id              String         @id @default(cuid())
  reference       String         @unique
  status          TransferStatus @default(COLLECTING)
  createdById     String
  startedAt       DateTime       @default(now())
  completedAt     DateTime?
  createdBy       User           @relation("TransferCreatedBy", fields: [createdById], references: [id])
  picks           TransferPick[]
  drops           TransferDrop[]
}

enum TransferStatus { COLLECTING; DROPPING; COMPLETED; CANCELLED }

model TransferPick {
  id              String   @id @default(cuid())
  transferId      String
  productId       String
  fromLocationId  String
  quantity        Int
  pickedAt        DateTime @default(now())
  transfer        Transfer @relation(fields: [transferId], references: [id])
  product         Product  @relation(fields: [productId], references: [id])
  fromLocation    Location @relation(fields: [fromLocationId], references: [id])
}

model TransferDrop {
  id              String   @id @default(cuid())
  transferId      String
  productId       String
  toLocationId    String
  quantity        Int
  droppedAt       DateTime @default(now())
  transfer        Transfer @relation(fields: [transferId], references: [id])
  product         Product  @relation(fields: [productId], references: [id])
  toLocation      Location @relation(fields: [toLocationId], references: [id])
}

model DefectReason {
  id            String    @id @default(cuid())
  erpixReasonId String?   @unique
  name          String    @unique
  faultType     FaultType
  active        Boolean   @default(true)
  syncedAt      DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  defectItems   DefectItem[]
}

enum FaultType { VENDOR; INTERNAL }

model DefectReport {
  id              String       @id @default(cuid())
  reportNumber    String       @unique
  source          DefectSource
  machineId       String?
  fromLocationId  String?
  locationId      String?
  status          DefectStatus @default(PENDING_REVIEW)
  erpixOrderId    String?
  operatorName    String?
  notes           String?
  createdById     String
  reviewedById    String?
  reviewedAt      DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  machine         Machine?     @relation(fields: [machineId], references: [id])
  location        Location?    @relation(fields: [locationId], references: [id])
  fromLocation    Location?    @relation("DefectFromLocation", fields: [fromLocationId], references: [id])
  createdBy       User         @relation("DefectCreatedBy", fields: [createdById], references: [id])
  reviewedBy      User?        @relation("DefectReviewedBy", fields: [reviewedById], references: [id])
  items           DefectItem[]
}

enum DefectSource { PRE_PRODUCTION; PRODUCTION }
enum DefectStatus { PENDING_REVIEW; CONFIRMED; REJECTED }

model DefectItem {
  id                    String    @id @default(cuid())
  defectReportId        String
  productId             String
  reasonId              String
  quantity              Int       @default(1)
  faultType             FaultType
  vendorCreditSuggested Boolean   @default(false)
  vendorCreditId        String?
  notes                 String?
  defectReport          DefectReport @relation(fields: [defectReportId], references: [id], onDelete: Cascade)
  product               Product      @relation(fields: [productId], references: [id])
  reason                DefectReason @relation(fields: [reasonId], references: [id])
}

model CountSession {
  id               String              @id @default(cuid())
  name             String
  locationId       String
  type             CountType
  status           CountSessionStatus  @default(IN_PROGRESS)
  assignedToId     String?
  duplicatedFromId String?
  notes            String?
  startedAt        DateTime            @default(now())
  completedAt      DateTime?
  reviewedAt       DateTime?
  location         Location            @relation(fields: [locationId], references: [id])
  assignedTo       User?               @relation(fields: [assignedToId], references: [id])
  entries          CountEntry[]
}

enum CountType { FULL; CYCLE; SPOT }
enum CountSessionStatus { IN_PROGRESS; SUBMITTED; REVIEWING; APPROVED; CANCELLED }

model CountEntry {
  id              String   @id @default(cuid())
  countSessionId  String
  productId       String
  countedQty      Int
  expectedQty     Int
  variance        Int      @default(0)
  countedById     String
  notes           String?
  scannedAt       DateTime @default(now())
  countSession    CountSession @relation(fields: [countSessionId], references: [id])
  product         Product      @relation(fields: [productId], references: [id])
  countedBy       User         @relation(fields: [countedById], references: [id])
  @@unique([countSessionId, productId])
}

model VendorCredit {
  id              String             @id @default(cuid())
  creditNumber    String             @unique
  vendorId        String
  purchaseOrderId String?
  reason          VendorCreditReason
  totalAmount     Decimal            @db.Decimal(12,2)
  status          CreditStatus       @default(PENDING)
  notes           String?
  createdById     String
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  vendor          Vendor             @relation(fields: [vendorId], references: [id])
  purchaseOrder   PurchaseOrder?     @relation(fields: [purchaseOrderId], references: [id])
  createdBy       User               @relation(fields: [createdById], references: [id])
  items           VendorCreditItem[]
}

enum VendorCreditReason { DAMAGED_GOODS; MISSING_ITEMS; WRONG_ITEMS; QUALITY_ISSUE; OTHER }
enum CreditStatus { PENDING; APPROVED; APPLIED; CLOSED }

model VendorCreditItem {
  id              String   @id @default(cuid())
  vendorCreditId  String
  productId       String
  quantity        Int
  unitCost        Decimal  @db.Decimal(10,2)
  totalCredit     Decimal  @db.Decimal(12,2)
  notes           String?
  vendorCredit    VendorCredit @relation(fields: [vendorCreditId], references: [id], onDelete: Cascade)
  product         Product      @relation(fields: [productId], references: [id])
}

model StockAdjustment {
  id            String           @id @default(cuid())
  productId     String
  locationId    String
  previousQty   Int
  newQty        Int
  reason        AdjustmentReason
  notes         String?
  adjustedById  String
  createdAt     DateTime         @default(now())
  product       Product          @relation(fields: [productId], references: [id])
  location      Location         @relation(fields: [locationId], references: [id])
  adjustedBy    User             @relation(fields: [adjustedById], references: [id])
}

enum AdjustmentReason { COUNT_VARIANCE; DAMAGE; DEFECT_SCRAP; LOSS; FOUND; CORRECTION; INITIAL_SETUP; OTHER }

model ActivityLog {
  id          String   @id @default(cuid())
  action      String
  entityType  String
  entityId    String
  details     Json?
  userId      String?
  createdAt   DateTime @default(now())
  user        User?    @relation(fields: [userId], references: [id])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([action])
}

model Notification {
  id          String           @id @default(cuid())
  type        NotificationType
  channel     String
  message     String
  entityType  String?
  entityId    String?
  sent        Boolean          @default(false)
  sentAt      DateTime?
  failCount   Int              @default(0)
  createdAt   DateTime         @default(now())
}

enum NotificationType { WRONG_LOCATION; LOW_STOCK; PO_PENDING_APPROVAL; PO_OVERDUE; COUNT_SUBMITTED; DEFECT_REPORTED; DEFECT_VENDOR_CREDIT_SUGGESTED; PRODUCTION_RESTOCK_NEEDED; ERPIX_SYNC_FAILURE }

model Setting {
  id          String   @id @default(cuid())
  key         String   @unique
  value       String
  updatedAt   DateTime @updatedAt
}
```
