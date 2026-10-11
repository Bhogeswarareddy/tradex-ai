# TradeX AI: 10-Minute Executive Live Demonstration Script

This script guides presenters through a compelling, end-to-end 10-minute live demonstration of the TradeX AI platform, highlighting AI intelligence, international trade compliance, containerization, and operations.

---

## Demonstration Timeline & Click Path

```
  00:00 - 01:15  |  Introduction & Architecture
  01:15 - 03:00  |  AI Natural Language Discovery & Matching
  03:00 - 04:30  |  Supplier Intelligence & Factory Verification
  04:30 - 06:00  |  RFQ, Multi-Quote Comparison & Landed-Cost Analysis
  06:00 - 07:15  |  Order Execution, Simulated Payments & Vessel Tracking
  07:15 - 08:30  |  Document Intelligence OCR & Trade Copilot RAG
  08:30 - 09:15  |  Market Intelligence & Macro Analytics
  09:15 - 10:00  |  Admin Console, Prometheus Monitoring & AWS Architecture
```

---

### Act 1: Introduction & Architecture (00:00 – 01:15)

- **Screen**: Browser opened to `https://localhost` (or `https://api.tradex.ai`).
- **Action**: Display the TradeX AI homepage. Note the active HTTPS lock badge and modern Alibaba/IndiaMART enterprise aesthetic.
- **Presenter Script**:
  > *"Welcome to TradeX AI. Cross-border B2B trade represents over $20 trillion annually, yet discovering compliant suppliers, negotiating landed costs, and verifying complex customs documents remains slow and fragmented.*
  >
  > *TradeX AI is an end-to-end intelligent procurement platform. Behind this single interface is a hardened, multi-container architecture running Nginx reverse proxying, a React 19 single-page app, a FastAPI asynchronous Python backend with pgvector 16, and real-time Prometheus monitoring. Let's walk the entire international trade journey."*

---

### Act 2: AI Natural Language Discovery & Matching (01:15 – 03:00)

- **Screen**: Click **AI Search** (`/search`).
- **Action**: Paste the canonical procurement prompt into the natural language input box:
  ```
  Looking for 20 MT organic turmeric powder with curcumin > 5% for shipment to Hamburg
  ```
- **Action**: Press Enter or click **Search with AI**.
- **Action**: Point out the parsed requirements extracted by the AI engine:
  - Commodity: *Organic Turmeric Powder*
  - Quantity: *20 MT (Metric Tons)*
  - Chemical Specification: *Curcumin > 5%*
  - Destination Port: *Port of Hamburg (DEHAM), Germany*
- **Presenter Script**:
  > *"Notice how the AI immediately parsed unstructured commercial intent into structured vector parameters. It evaluated our 60 seeded products and matched top enterprise exporters like Kerala Spices Exports and Western Ghats Bio-Agro.*
  >
  > *Crucially, TradeX doesn't just match keywords—it computes a multi-attribute match score blending vector cosine similarity, trust scores, and certification compliance (EU Organic, ISO 22000, FSSAI). With one click, the buyer can generate an instant RFQ directly from this prompt."*

---

### Act 3: Supplier Intelligence & Factory Verification (03:00 – 04:30)

- **Screen**: Click into **Kerala Spices Exports** profile (`/suppliers/1`).
- **Action**: Show the Trust Score badge (94/100), verified licenses (APEDA, ISO 22000, EU Organic), and factory profile tabs:
  - Overview: export history, revenue, export destinations.
  - Products: catalog of certified organic spices.
  - Factory & Machinery: processing capacity (50 MT/day), pulverizers, steam sterilizers.
  - Certifications: verified certificate badges with issuing authority details.
- **Presenter Script**:
  > *"On traditional trade portals, verifying whether a supplier is a legitimate manufacturer or a broker takes weeks. In TradeX AI, each supplier has a verified digital storefront backed by factory audit data, production capacity, and verifiable trade licenses.*
  >
  > *This supplier boasts a 94 Trust Score, 50 MT/day capacity, and pre-verified TRACES NT EU organic compliance."*

---

### Act 4: RFQs, Multi-Quote Comparison & Landed-Cost Analysis (04:30 – 06:00)

- **Screen**: Switch to **RFQs** (`/rfqs`) $\rightarrow$ View Seeded RFQ `RFQ-2026-0001`.
- **Action**: Highlight the multi-vendor quotation comparison table.
- **Action**: Click **Compare Quotes with AI**.
- **Action**: Toggle **Landed-Cost Calculator**. Show how FOB price ($2,400/MT) expands to CIF Hamburg ($2,720/MT) including customs duty (7.7%), ocean freight, marine insurance, and terminal handling charges.
- **Presenter Script**:
  > *"Here we see two competitive quotations submitted for our turmeric inquiry. Instead of manual spreadsheet math, our AI Quote Evaluator benchmarks lead times, Incoterms, and payment terms.*
  >
  > *Furthermore, our Landed-Cost Engine calculates the exact final landed cost at Hamburg Port—accounting for EU Common Customs Tariff, ocean container freight, and marine cargo insurance. Let's award this quote to Kerala Spices Exports and generate an order."*

---

### Act 5: Order Execution, Simulated Payments & Vessel Tracking (06:00 – 07:15)

- **Screen**: Navigate to **Orders** (`/orders`) $\rightarrow$ Click `ORD-2026-0001`.
- **Action**: Show order state transition flow: *Confirmed $\rightarrow$ In Production $\rightarrow$ Quality Check $\rightarrow$ Shipped*.
- **Action**: Click **Simulate Payment** (Advance 30% / Escrow release).
- **Action**: Navigate to **Shipments** (`/shipments`) $\rightarrow$ Click `EX2026-1024`.
- **Action**: Display the interactive maritime map showing vessel *MV Ocean Star* traversing the 14-waypoint corridor from Nhava Sheva / Chennai through the Red Sea and Suez Canal to Hamburg.
- **Presenter Script**:
  > *"The order progresses through strict role-aware status transitions. Notice the payment simulator: it generates verifiable simulated escrow milestones with full transaction references.*
  >
  > *Under Shipments, our real-time simulator advances vessel MV Ocean Star along the 14 nautical waypoints between India and Europe, updating ETA, coordinates, and transit events in real time."*

---

### Act 6: Document Intelligence OCR & Trade Copilot RAG (07:15 – 08:30)

- **Screen**: Navigate to **Documents** (`/documents`).
- **Action**: View an uploaded Commercial Invoice / Certificate. Click **AI Extraction**.
- **Action**: Display extracted JSON fields: Seller, Buyer, HS Code `0910.30`, Invoice Total, Container Number, and Confidence Score.
- **Screen**: Click the floating or sidebar **Copilot** (`/copilot`).
- **Action**: Submit query:
  ```
  What are the mandatory document requirements for importing organic turmeric into Germany under EU 2018/848?
  ```
- **Action**: Show the streaming answer grounded in the 15 international trade compliance guides, highlighting the clickable citation badge: `[Verified Guide: EU Organic Regulations & TRACES NT]`.
- **Presenter Script**:
  > *"Document processing is the biggest bottleneck in international trade. Our Document Intelligence engine extracts structured line items, weights, and container numbers with confidence scores.*
  >
  > *And our AI Trade Copilot is grounded in a retrieval-augmented generation engine spanning 15 international trade guides—including Incoterms 2020, UCP 600 Letters of Credit, and EU organic regulations. Every answer cites verified legal sources."*

---

### Act 7: Market Intelligence & Macro Analytics (08:30 – 09:15)

- **Screen**: Navigate to **Analytics** (`/analytics`).
- **Action**: Show 24 months of price trends and demand growth curves (Turmeric +42%, Basmati Rice +35%).
- **Action**: Point out the AI Macro Insights summary box citing real statistics from the underlying dataset.
- **Presenter Script**:
  > *"Our Market Intelligence dashboard visualizes 24 months of time-series data across top export commodities and global destination ports, paired with an AI macro-economic summarizer that analyzes real trends."*

---

### Act 8: Admin Console, Prometheus Monitoring & AWS Architecture (09:15 – 10:00)

- **Screen**: Log in as `admin@tradex.ai` $\rightarrow$ Navigate to **Admin Console** (`/admin`).
- **Action**: Show user management, supplier verification toggles, and tamper-evident audit logs.
- **Screen**: Switch tab to Grafana (`http://localhost:3001`).
- **Action**: Show real-time HTTP request rate, p95 latency curve, container memory usage, and `/metrics` Prometheus integration.
- **Presenter Script**:
  > *"Finally, as platform administrator, we have complete platform governance, sanctions review, and tamper-evident audit logs.*
  >
  > *Under the hood, Prometheus scrapes our custom /metrics endpoint every 15 seconds, visualized on our Grafana dashboard. The entire stack is packaged with Docker Compose, hardened with non-root containers and isolated networks, and automated via a declarative 11-stage Jenkins CI/CD pipeline on AWS EC2.*
  >
  > *That concludes the demonstration of TradeX AI. Thank you."*
