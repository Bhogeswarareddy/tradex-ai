# TradeX AI Mode Screen Specification & Architecture

## 1. Overview & Context

**AI Mode** is an interactive, conversational sourcing interface designed to replicate the streamlined, card-driven, and negotiation-enabled sourcing workflow seen in modern B2B marketplaces (such as Alibaba AI Mode), while adhering strictly to TradeX AI's brand identity, security boundaries, and PostgreSQL-grounded transactional core.

- **Frontend Route:** `/ai-mode` (standalone page)
- **Backend Service:** Prompt 18 API layer (`/api/v1/ai-mode/*` and `/api/v1/negotiation-drafts/*`)
- **Visual Reference:** Adapted from the Alibaba AI Mode layout reference screenshot without copying any Alibaba logos, imagery, or proprietary styling.

---

## 2. Layout & Interaction Architecture

The screen is organized into four primary responsive zones:

```
+----------------------------------------------------------------------------------------------------+
|  Top Navigation: TradeX AI Mode | Products | Suppliers | Worldwide | Deliver to: USA | USD ($)     |
+-------------------+--------------------------------------------------------------------------------+
|                   |                                                                                |
|  Left Sidebar     |  Center Sourcing Workspace                                                     |
|  (Light, Narrow)  |                                                                                |
|                   |  [Greeting / Prompt Chips]                                                     |
|  - TradeX AI Mode |                                                                                |
|    Global Sourcing|  [Buyer Message Bubble (Right-aligned, amber/orange)]                          |
|                   |                                                                                |
|  - [+ New Chat]   |  [AI Grounded Response (Left-aligned, verified supplier match)]                |
|                   |                                                                                |
|  - Today          |  +-------------------+  +-------------------+  +-------------------+           |
|  - Yesterday      |  | Product Card 1    |  | Product Card 2    |  | Product Card 3    |           |
|  - Earlier        |  | - Verified Badge  |  | - Verified Badge  |  | - Verified Badge  |           |
|                   |  | - SQL Price (Live)|  | - SQL Price (Live)|  | - SQL Price (Live)|           |
|  - Inline Rename  |  | - MOQ / Lead Time |  | - MOQ / Lead Time |  | - MOQ / Lead Time |           |
|  - Confirm Delete |  | - [Chat Now]      |  | - [Chat Now]      |  | - [Chat Now]      |           |
|                   |  | - [AI Negotiate]  |  | - [AI Negotiate]  |  | - [AI Negotiate]  |           |
|                   |  +-------------------+  +-------------------+  +-------------------+           |
|                   |                                                                                |
|                   |  [Suggested Follow-Up Prompt Chips]                                            |
|                   |                                                                                |
|                   |  +---------------------------------------------------------------+             |
|                   |  | Sticky Selection Tray: [Thumbnails] [Clear] [Compare (2-4)]   |             |
|                   |  +---------------------------------------------------------------+             |
|                   |  | Bottom Composer: Multi-line Input | Enter to Send             |             |
+-------------------+--------------------------------------------------------------------------------+
```

### Zone A: Left History Sidebar (Collapsible on Mobile)
- **Branding:** `TradeX AI Mode` with `GLOBAL SOURCING` subtitle and amber sparkle emblem.
- **New Conversation:** Sticky `+ New Chat` button that instantly spins up a fresh session without reloading.
- **Categorization:** Sessions grouped into **Today**, **Yesterday**, and **Earlier**.
- **Management:** Hover actions for inline title renaming (check/cancel controls) and two-step confirmation dialog for deletion.
- **Mobile Drawer:** Auto-collapses on screens < 768px behind a top-left hamburger menu.

### Zone B: Top Navigation
- Active `AI Mode` status indicator.
- Fast links to existing platform sections (`Products`, `Suppliers`, `Worldwide sourcing`).
- User regional controls (`Deliver to: Country`, `Currency selector`, and `Notification bell`).

### Zone C: Center Sourcing Column
- **Grounded AI Answers:** Each response displays source classification and clear status.
- **Responsive Card Grid:**
  - **Desktop (>=1024px):** 3-column layout.
  - **Tablet (768px - 1023px):** 2-column layout.
  - **Mobile (<768px):** 1-column stacked layout.
- **Strict Grounding:** Every card displays verified database price (marked with `CURRENT` freshness badge), MOQ, verified supplier shield, verified certifications (CE, ISO, USDA Organic), and requirement checklist (ticks for satisfied criteria, warnings for delivery or shipping caveats).
- **Direct Action Buttons:**
  - **Chat Now:** Idempotently triggers or retrieves the buyer-supplier thread in TradeX Messaging without duplicating chats.
  - **AI Negotiate:** Slides open the interactive negotiation drawer.

### Zone D: Sticky Compare Tray & Bottom Composer
- **Selection Tray:** Dynamically appears when $\ge 1$ products are selected via card checkboxes. Shows selected item thumbnails and a `Compare (2-4)` button that opens a side-by-side spec comparison modal with best values highlighted.
- **Composer:** Fixed to the viewport bottom with padding guarantees so cards are never obscured. Multi-line auto-resizing input with `Enter` to send, `Shift+Enter` for new lines, and inline error retry state.

---

## 3. Comparison Matrix: Reference Screenshot vs TradeX AI Mode

| Feature / Element | Alibaba AI Mode Reference (`media_1791995899449_becf620e.png`) | TradeX AI Mode Implementation (`frontend/src/pages/AiModePage.tsx`) |
| :--- | :--- | :--- |
| **Brand Identity** | Alibaba.com orange logo, proprietary fonts, generic AI icons. | **TradeX AI** typography, slate/amber theme, clean modern vector iconography. |
| **Data Integrity** | Vector/LLM text generation without explicit database guarantees. | **PostgreSQL Grounding**: Vector search finds descriptive text only; price, tiers, MOQ, supplier verification, and lead time are queried directly from SQL records. |
| **Price Freshness** | Static price string without staleness indication. | **Freshness Badge**: Every price displays a real-time `CURRENT` or `STALE` indicator. |
| **Supplier Verification** | Basic text badge (`Verified`). | **Verified Shield**: Linked directly to company certification audit logs in PostgreSQL. |
| **Requirements Match** | Brief `Matches 2/2 requirements` footer. | **Interactive Checklist**: Detailed tick/warning list displaying satisfied vs. caveat criteria (e.g. transit time, lead time). |
| **AI Negotiation** | External or modal flow. | **Embedded Negotiation Drawer**: Interactive drawer with target price/quantity inputs, original supplier terms, AI pitch suggestions, and explicit buyer confirmation dialog. |
| **Product Comparison** | Floating bottom bar. | **Sticky Selection Tray + Full Comparison Modal**: Multi-product select (2-4 items) with specs matrix and best-value highlight. |
| **Navigation Harmony** | Standard Alibaba header. | **TradeX TopBar & Sidebar**: Seamless integration with existing Buyer/Supplier/Admin navigation without duplicate pages. |

---

## 4. Responsive Verification & Screenshots

The layout was captured using Playwright across four standard breakpoints:

### 1. Desktop (1440px)
- **Viewport:** 1440 x 960 px
- **Layout:** Full 3-column product grid, open left sidebar with date grouping, floating compare tray, pinned composer.
- **Screenshot:** [ai-mode-1440.png](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20%281%29/PlayerValuatorPro-main/tradex-ai/docs/screenshots/ai-mode/ai-mode-1440.png)

### 2. Tablet Landscape (1024px)
- **Viewport:** 1024 x 800 px
- **Layout:** Balanced 2-column product grid, condensed history sidebar, sticky bottom tray.
- **Screenshot:** [ai-mode-1024.png](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20%281%29/PlayerValuatorPro-main/tradex-ai/docs/screenshots/ai-mode/ai-mode-1024.png)

### 3. Tablet Portrait (768px)
- **Viewport:** 768 x 1024 px
- **Layout:** 2-column product grid, responsive top bar, touch-friendly action buttons.
- **Screenshot:** [ai-mode-768.png](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20%281%29/PlayerValuatorPro-main/tradex-ai/docs/screenshots/ai-mode/ai-mode-768.png)

### 4. Mobile (390px)
- **Viewport:** 390 x 844 px
- **Layout:** Collapsed hamburger sidebar, single-column product feed, full-width action buttons, responsive bottom composer and sticky comparison pill.
- **Screenshot:** [ai-mode-390.png](file:///c:/Users/HP/Downloads/PlayerValuatorPro-main%20%281%29/PlayerValuatorPro-main/tradex-ai/docs/screenshots/ai-mode/ai-mode-390.png)

---

## 5. Verification Test Suite Summary

- **Backend Acceptance Suite:** `backend/app/tests/test_ai_mode.py`
  - 8/8 tests passing (100%): Conversation lifecycle, SQL grounding, selection persistence, compare endpoint, Chat Now idempotency, confirmed negotiation drafts.
- **Frontend Test Suite:** `frontend/src/tests/ai_mode.test.ts`
  - 6/6 tests passing (100%): API contracts, message serialization, product card parsing, selection toggling, negotiation flow.
- **All Frontend Suites:** 14 test files, 68 tests passing (100%).
- **Production Build:** `npm run build` succeeds cleanly with zero TypeScript errors.
