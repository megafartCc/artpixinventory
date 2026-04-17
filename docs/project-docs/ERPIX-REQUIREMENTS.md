# ERPIX Integration Requirements — Inventory App

## Overview

We are building a custom Inventory Management System that needs to integrate with ERPIX. This document lists all API endpoints and data exchanges needed. Please review and provide timeline estimates.

---

## 1. ERPIX Calls OUR Inventory App

These are endpoints on our app that ERPIX will call. We will provide the base URL and API key.

### 1.1 Machine Consumption (required for Day 1)

When a machine consumes a raw material during production.

**Endpoint:** `POST {INVENTORY_URL}/api/erpix/consume`
**Auth:** Header `x-api-key: {ERPIX_API_KEY}`

```json
{
  "erpixMachineId": "STN-07",       // Machine ID from ERPIX (stable)
  "compoundId": "3CRS",              // Product Compound ID (SKU)
  "quantity": 1,                      // Quantity consumed
  "erpixOrderId": "ORD-12345",      // ERPIX order reference (optional)
  "operatorName": "John Smith",      // Operator name (optional)
  "defect": {                         // ONLY include when item is defective
    "erpixReasonId": "R-005",        // Defect reason ID from ERPIX
    "isDefective": true
  }
}
```

**Response:** `200 OK` with `{ "success": true, "consumptionId": "..." }`
**Error:** `400/500` with `{ "error": "message" }`

**Notes:**
- The `defect` field is optional. Only send it when the item was marked as a production issue in ERPIX.
- The supervisor's reason selection in ERPIX maps to `erpixReasonId`.
- One call per consumed item.

---

### 1.2 Stock Reservation (needed by Week 3)

When a customer order is placed in ERPIX, reserve stock in the inventory system.

**Endpoint:** `POST {INVENTORY_URL}/api/erpix/reserve`

```json
{
  "compoundId": "3CRS",
  "quantity": 5,
  "erpixOrderId": "ORD-12345"
}
```

**Fulfill reservation** (when order produced/shipped):
`POST {INVENTORY_URL}/api/erpix/reserve/{reservationId}/fulfill`

**Cancel reservation** (when order cancelled):
`POST {INVENTORY_URL}/api/erpix/reserve/{reservationId}/cancel`

---

## 2. OUR Inventory App Calls ERPIX

These are endpoints on ERPIX that our app will call.

### 2.1 Production Queue — Remaining Production Per Machine (needed by Week 3)

Our app will poll this endpoint every hour to check what production is remaining today.

**What we need from ERPIX:**
- Endpoint URL
- Auth method

**Expected response format:**
```json
{
  "date": "2026-04-15",
  "machines": [
    {
      "erpixMachineId": "STN-07",
      "items": [
        { "compoundId": "3CRS", "quantityRemaining": 40 },
        { "compoundId": "3CRM", "quantityRemaining": 15 }
      ]
    },
    {
      "erpixMachineId": "Vitro-03",
      "items": [
        { "compoundId": "3CRL", "quantityRemaining": 20 }
      ]
    }
  ]
}
```

Our app uses this to check if each machine's sublocation has enough stock, and alerts the warehouse team to restock if not.

---

### 2.2 Defect Reasons List (needed by Week 2)

Our app needs to sync the list of defect/production-issue reasons from ERPIX.

**What we need from ERPIX:**
- Endpoint that returns all active defect/issue reasons
- Each reason must include: ID (stable), name, and whether it is a vendor fault or internal fault

**Expected response:**
```json
{
  "reasons": [
    { "id": "R-001", "name": "Cracked crystal", "faultType": "VENDOR" },
    { "id": "R-002", "name": "Surface defect", "faultType": "VENDOR" },
    { "id": "R-003", "name": "Engraving error", "faultType": "INTERNAL" },
    { "id": "R-004", "name": "Handling damage", "faultType": "INTERNAL" },
    { "id": "R-005", "name": "Internal flaw (post-production)", "faultType": "VENDOR" }
  ]
}
```

This is triggered manually (sync button), not on a schedule.

---

### 2.3 Machine List (needed by Week 1)

Sync machine IDs from ERPIX so both systems reference the same machines.

**Expected response:**
```json
{
  "machines": [
    { "id": "STN-01", "name": "STN-01", "type": "STN" },
    { "id": "STN-02", "name": "STN-02", "type": "STN" },
    { "id": "Vitro-01", "name": "Vitro-01", "type": "VITRO" }
  ]
}
```

Triggered manually (sync button).

---

### 2.4 Product Data Sync (needed by Week 2)

Sync product images, weight, and dimensions from ERPIX.

**Expected response:**
```json
{
  "products": [
    {
      "erpixId": "PROD-001",
      "compoundId": "3CRS",
      "imageUrl": "https://...",
      "weight": 0.5,
      "weightUnit": "lb",
      "length": 4.0,
      "width": 3.0,
      "height": 2.0,
      "dimensionUnit": "in"
    }
  ]
}
```

Triggered manually (sync button).

---

## 3. Shared Identifiers

Both systems must agree on these identifiers:

| Identifier | Format | Example | Who Owns It |
|-----------|--------|---------|-------------|
| Compound ID (SKU) | String | "3CRS" | ERPIX (source of truth) |
| ERPIX Machine ID | String | "STN-07" | ERPIX (stable, never changes) |
| ERPIX Order ID | String | "ORD-12345" | ERPIX |
| Defect Reason ID | String | "R-005" | ERPIX |
| ERPIX Product ID | String | "PROD-001" | ERPIX |

---

## 4. Error Handling

Our inventory app implements retry logic:
- **3 retry attempts** with 10-second intervals
- If all 3 fail, we log the failure and send an alert to Slack #system-errors
- ERPIX should expect occasional retry calls (same payload, same idempotency)

We ask that ERPIX endpoints:
- Return proper HTTP status codes (200 for success, 4xx for client errors, 5xx for server errors)
- Include error messages in the response body
- Be idempotent where possible (same consumption call twice should not double-deduct)

---

## 5. Priority & Timeline

| Integration | Priority | When We Need It |
|------------|----------|----------------|
| Machine List sync | High | Week 1 (we need machine IDs first) |
| Machine Consumption (consume endpoint) | Critical | Week 2 (core functionality) |
| Defect Reasons sync | High | Week 2 (needed for defect module) |
| Product Data sync | Medium | Week 2 |
| Stock Reservation | Medium | Week 3 |
| Production Queue (remaining per machine) | Medium | Week 3 |

---

## 6. Testing

We will provide:
- Staging URL for our inventory app
- API key for ERPIX to use
- Postman collection with example calls for all endpoints

We need from ERPIX:
- Staging endpoint URLs for the endpoints we call
- Test API credentials
- Sample data for testing (a few machine consumptions, a sample production queue)

---

## Questions for ERPIX Team

1. Can you provide stable machine IDs that won't change? (We will use these as the primary key for machine mapping.)
2. Do you already have defect/issue reasons with IDs, or do these need to be created?
3. Is there an existing API for remaining production per machine, or does this need to be built?
4. What is your preferred auth method for endpoints we call? (API key, OAuth, JWT?)
5. Can we get access to a staging/test environment?
6. What is the estimated timeline for implementing the Machine Consumption callback (section 1.1)?
