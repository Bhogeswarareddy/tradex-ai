# Foreign Exchange Risk Management & Currency Hedging in B2B Cross-Border Trade

## 1. FX Exposure in International Trade Contracts
Cross-border agricultural trade cycles frequently span 60 to 120 days between contract signing, crop harvesting, ocean transit, and final invoice settlement. During this period, currency fluctuations between EUR, USD, and INR can erase commercial profit margins or result in substantial contract default risks.

## 2. Common FX Hedging Instruments
### Forward Contracts (Outright Forwards)
- An agreement between an exporter/importer and a commercial bank to buy or sell a specific amount of foreign currency at a predetermined exchange rate (the Forward Rate) on a future delivery date.
- **Benefit:** Completely eliminates currency uncertainty; fixes profit margins in domestic currency.
- **Limitation:** Inflexible; obligates execution even if trade shipments are delayed or cancelled due to force majeure.

### Plain Vanilla Currency Options
- Grants the buyer the right, but not the obligation, to buy (Call) or sell (Put) currency at a pre-set Strike Price before an expiration date.
- **Benefit:** Provides asymmetric downside protection against unfavorable exchange rate depreciation while preserving upside participation if the currency moves favorably.
- **Cost:** Requires payment of an upfront cash premium.

### Structured Cross-Currency Limits & Price Adjustment Clauses
- International trade sales contracts can incorporate currency collar clauses:
  - If the EUR/INR exchange rate fluctuates by more than $\pm 5\%$ from the contract baseline rate on the date of Bill of Lading, the invoice price per metric ton is adjusted formulaically to split the currency variance evenly between buyer and seller.

## 3. Best Practices for TradeX AI Participants
1. Match quotation currencies to underlying cost centers where feasible (e.g., European buyers prefer EUR-denominated CIF contracts; South Asian exporters prefer USD or hedged local currency).
2. Utilize escrow milestone payment releases (30% advance deposit upon order confirmation, 70% balance upon Bill of Lading presentation) to compress the duration of unhedged exposure.
