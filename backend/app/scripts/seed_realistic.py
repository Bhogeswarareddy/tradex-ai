"""
TradeX AI Realistic B2B Catalogue and Supplier Ecosystem Seeder (Prompt 23 & Prompt 24)
Seeds:
- 10 comprehensive B2B categories
- 12 verified global suppliers across 8+ countries
- 160+ realistic distinct products with HS codes, tiers, stock, lead time, certifications
- Supplier certifications with expiry warnings
- RFQs and quotes for supplier matching
- Inquiries, Orders, and Shipments for logged-in suppliers
Idempotent and safe to run multiple times.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SyncSessionLocal
from app.models.catalog import Category, Certification, PriceTier, Product, ProductImage, SupplierCertification
from app.models.identity import Company, Role, Supplier, User
from app.models.trade import Order, OrderItem, Quotation, RFQ, RFQItem, Shipment, ShipmentEvent
from app.models.content import Message, Thread


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


CATEGORIES = [
    ("Spices & Condiments", "spices", "Pure whole and powdered export-grade spices, condiments, and herbs"),
    ("Rice & Grains", "rice_grains", "Long-grain basmati, jasmine rice, wheat, corn, and bulk grains"),
    ("Tea & Coffee", "tea_coffee", "Single-origin Arabica, Robusta coffee beans, black, green, and herbal teas"),
    ("Textiles & Fabrics", "textiles", "Export-grade natural cotton yarns, linen, woven fabrics, and silks"),
    ("Automotive Components", "auto_components", "OEM brake discs, precision fasteners, sensors, and engine parts"),
    ("Electronics & Accessories", "electronics", "Export trade laptops, smart displays, power banks, and microchips"),
    ("Industrial Machinery", "machinery", "High-precision CNC tooling, packaging machines, motors, and hydraulic pumps"),
    ("Specialty Chemicals", "chemicals", "Industrial reagents, green bio-solvents, polymers, and food preservatives"),
    ("Sustainable Packaging", "packaging", "Biodegradable corrugated boxes, kraft paper bags, and eco containers"),
    ("Artisanal Handicrafts", "handicrafts", "Handmade ceramic pottery, brassware, wooden carvings, and artisan goods"),
]

SUPPLIERS = [
    {
        "company_name": "Sri Bharat Spices Pvt Ltd",
        "email": "supplier@sribharat.com",
        "country": "India",
        "city": "Mumbai",
        "state": "Maharashtra",
        "year_founded": 2014,
        "employees": 240,
        "trust_score": 4.9,
        "on_time": 98.2,
        "capacity": "1,200 MT/month",
        "exports": ["Germany", "USA", "UAE", "Japan", "United Kingdom"],
        "languages": ["English", "Hindi", "Marathi", "German"],
        "about": "Leading Indian manufacturer and exporter of steam-sterilized whole spices, oleoresins, and seasonings.",
    },
    {
        "company_name": "Madhav Agro Exports",
        "email": "contact@madhavagro.com",
        "country": "India",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "year_founded": 2011,
        "employees": 180,
        "trust_score": 4.7,
        "on_time": 96.0,
        "capacity": "2,500 MT/month",
        "exports": ["Saudi Arabia", "USA", "Netherlands", "Canada"],
        "languages": ["English", "Hindi", "Gujarati"],
        "about": "Agro-commodity processor specializing in non-basmati and premium basmati rice varieties.",
    },
    {
        "company_name": "Saigon Grain & Agro Corp",
        "email": "sales@saigongrain.vn",
        "country": "Vietnam",
        "city": "Ho Chi Minh City",
        "state": "Mekong Delta",
        "year_founded": 2008,
        "employees": 320,
        "trust_score": 4.8,
        "on_time": 97.5,
        "capacity": "5,000 MT/month",
        "exports": ["China", "Philippines", "Germany", "France", "USA"],
        "languages": ["English", "Vietnamese", "Chinese"],
        "about": "Major agricultural exporter of Vietnamese fragrant Jasmine rice, broken rice, and Robusta green coffee.",
    },
    {
        "company_name": "Anatolia Food & Hazelnut Co",
        "email": "export@anatoliafood.tr",
        "country": "Turkey",
        "city": "Izmir",
        "state": "Aegean",
        "year_founded": 2005,
        "employees": 150,
        "trust_score": 4.7,
        "on_time": 95.8,
        "capacity": "800 MT/month",
        "exports": ["Germany", "Italy", "UK", "USA"],
        "languages": ["English", "Turkish", "German"],
        "about": "Export supplier of premium Turkish hazelnuts, sun-dried tomatoes, Aegean oregano, and dried figs.",
    },
    {
        "company_name": "Shenzhen Horizon Electronics Ltd",
        "email": "sales@horizonelec.cn",
        "country": "China",
        "city": "Shenzhen",
        "state": "Guangdong",
        "year_founded": 2016,
        "employees": 450,
        "trust_score": 4.9,
        "on_time": 99.1,
        "capacity": "80,000 units/month",
        "exports": ["USA", "Germany", "India", "Brazil", "Japan"],
        "languages": ["English", "Mandarin", "Cantonese"],
        "about": "OEM/ODM manufacturer of business ultrabooks, portable trade monitors, and high-efficiency power equipment.",
    },
    {
        "company_name": "Santos Specialty Coffee SA",
        "email": "export@santoscoffee.com.br",
        "country": "Brazil",
        "city": "Santos",
        "state": "Sao Paulo",
        "year_founded": 2002,
        "employees": 190,
        "trust_score": 4.9,
        "on_time": 98.0,
        "capacity": "3,000 MT/month",
        "exports": ["USA", "Germany", "Italy", "Japan", "South Korea"],
        "languages": ["English", "Portuguese", "Spanish"],
        "about": "Specialty green and roasted Arabica coffee exporter with Rainforest Alliance and Fairtrade certifications.",
    },
    {
        "company_name": "Bavaria Precision Tooling GmbH",
        "email": "sales@bavariatooling.de",
        "country": "Germany",
        "city": "Stuttgart",
        "state": "Baden-Wurttemberg",
        "year_founded": 1998,
        "employees": 280,
        "trust_score": 5.0,
        "on_time": 99.5,
        "capacity": "15,000 sets/month",
        "exports": ["USA", "Japan", "South Korea", "China", "India"],
        "languages": ["English", "German", "French"],
        "about": "Precision German tooling manufacturer of tungsten carbide cutters, CNC chucks, and industrial milling heads.",
    },
    {
        "company_name": "Nusantara Natural Fibers PT",
        "email": "trade@nusantarafibers.co.id",
        "country": "Indonesia",
        "city": "Surabaya",
        "state": "East Java",
        "year_founded": 2013,
        "employees": 210,
        "trust_score": 4.6,
        "on_time": 94.5,
        "capacity": "1,500 MT/month",
        "exports": ["Australia", "Japan", "USA", "Singapore"],
        "languages": ["English", "Indonesian"],
        "about": "Sustainable producer of natural coconut coir, sisal fiber, and biodegradable geotextiles.",
    },
    {
        "company_name": "Kyoto Ceramic & Craftworks",
        "email": "inquiry@kyotocraft.jp",
        "country": "Japan",
        "city": "Kyoto",
        "state": "Kansai",
        "year_founded": 1985,
        "employees": 65,
        "trust_score": 4.9,
        "on_time": 99.0,
        "capacity": "5,000 sets/month",
        "exports": ["USA", "France", "Germany", "Australia", "Singapore"],
        "languages": ["English", "Japanese"],
        "about": "Master artisans crafting high-temperature Japanese tableware, matcha ceremonial bowls, and lacquerware.",
    },
    {
        "company_name": "Milano Textile Mills SpA",
        "email": "export@milanotextiles.it",
        "country": "Italy",
        "city": "Milan",
        "state": "Lombardy",
        "year_founded": 1992,
        "employees": 175,
        "trust_score": 4.8,
        "on_time": 97.0,
        "capacity": "250,000 meters/month",
        "exports": ["USA", "France", "Japan", "South Korea"],
        "languages": ["English", "Italian", "French"],
        "about": "Luxury textile weaver delivering organic combed cotton, linen blends, and OEKO-TEX certified fabrics.",
    },
    {
        "company_name": "Guangdong Industrial Packaging Ltd",
        "email": "service@gdindustrialpack.cn",
        "country": "China",
        "city": "Guangzhou",
        "state": "Guangdong",
        "year_founded": 2010,
        "employees": 340,
        "trust_score": 4.7,
        "on_time": 96.5,
        "capacity": "2,000,000 units/month",
        "exports": ["USA", "Germany", "Australia", "Japan"],
        "languages": ["English", "Mandarin"],
        "about": "Eco-friendly heavy-duty corrugated cartons, kraft pulp trays, and moisture-barrier export packaging.",
    },
    {
        "company_name": "Kobe Automotive Systems KK",
        "email": "sales@kobeauto.jp",
        "country": "Japan",
        "city": "Kobe",
        "state": "Hyogo",
        "year_founded": 2004,
        "employees": 410,
        "trust_score": 4.9,
        "on_time": 98.8,
        "capacity": "120,000 pcs/month",
        "exports": ["USA", "Germany", "Thailand", "Mexico", "India"],
        "languages": ["English", "Japanese"],
        "about": "Tier-1 automotive component manufacturer specializing in brake discs, calipers, and steering knuckles.",
    },
    {
        "company_name": "Nordic Chemical Innovations AB",
        "email": "contact@nordicchem.se",
        "country": "Sweden",
        "city": "Gothenburg",
        "state": "Vastra Gotaland",
        "year_founded": 2015,
        "employees": 110,
        "trust_score": 4.8,
        "on_time": 97.8,
        "capacity": "800 MT/month",
        "exports": ["Germany", "UK", "Netherlands", "USA"],
        "languages": ["English", "Swedish", "German"],
        "about": "Pioneering producer of bio-based industrial solvents, green surfactants, and REACH-compliant polymers.",
    },
]

# 16 products per category = 160 products
CATALOGUE_TEMPLATE = [
    # 1. Spices & Condiments (16 products)
    ("spices", "Guntur Sannam S4 Stemless Red Chilli", "guntur-sannam-s4-stemless-red-chilli", "0904.21.10", "kg", 500, 3.20, 2.95, 2.70, 8500, 14, ["ISO 9001", "HACCP", "Spices Board India"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Alleppey Green Cardamom 8mm Bold", "alleppey-green-cardamom-8mm-bold", "0908.31.00", "kg", 100, 24.50, 22.80, 21.00, 3200, 10, ["ISO 9001", "FSSAI", "Spices Board India"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Malabar Black Pepper Tellicherry Garbled Extra Bold", "malabar-black-pepper-tellicherry-bold", "0904.11.10", "kg", 500, 6.80, 6.20, 5.75, 12000, 12, ["ISO 9001", "HACCP", "Rainforest Alliance"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Salem Curcumin 5% Turmeric Finger", "salem-curcumin-5pct-turmeric-finger", "0910.30.10", "kg", 1000, 1.85, 1.65, 1.45, 25000, 14, ["ISO 9001", "USDA Organic"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Cochin Dried Ginger Whole Unbleached", "cochin-dried-ginger-whole-unbleached", "0910.11.10", "kg", 500, 3.80, 3.45, 3.15, 6500, 14, ["ISO 9001", "HACCP"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Kashmiri Mogra Saffron Grade 1 Export", "kashmiri-mogra-saffron-grade-1-export", "0910.20.10", "kg", 5, 2800.00, 2650.00, 2500.00, 45, 7, ["ISO 9001", "GI Tagged"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Aegean Dried Oregano Rubbed Leaves", "aegean-dried-oregano-rubbed-leaves", "1211.90.86", "kg", 300, 5.20, 4.80, 4.40, 4200, 12, ["ISO 9001", "HACCP", "EU Organic"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("spices", "Urfa Biber Dark Smoked Chili Flakes", "urfa-biber-dark-smoked-chili-flakes", "0904.22.00", "kg", 200, 7.50, 6.90, 6.30, 2800, 10, ["ISO 9001", "Halal"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("spices", "Indian Cumin Seeds Machine Cleaned 99% Pure", "indian-cumin-seeds-machine-cleaned-99pct", "0909.31.00", "kg", 1000, 3.10, 2.85, 2.60, 18000, 14, ["ISO 9001", "FSSAI"], "India", "Madhav Agro Exports"),
    ("spices", "Coriander Seeds Eagle Quality", "coriander-seeds-eagle-quality", "0909.21.00", "kg", 1000, 1.40, 1.25, 1.10, 22000, 14, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("spices", "Fennel Seeds Green Bold Sortex Cleaned", "fennel-seeds-green-bold-sortex-cleaned", "0909.61.00", "kg", 500, 2.60, 2.35, 2.15, 7500, 12, ["ISO 9001", "HACCP"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Ceylon Cinnamon Sticks Alba Grade", "ceylon-cinnamon-sticks-alba-grade", "0906.11.00", "kg", 100, 18.50, 17.00, 15.50, 1500, 15, ["ISO 9001", "Fairtrade"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Crushed Red Pepper Chili Flakes Pizza Cut", "crushed-red-pepper-chili-flakes-pizza-cut", "0904.22.10", "kg", 500, 2.80, 2.50, 2.25, 11000, 10, ["ISO 9001", "BRC"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Pure Natural Fenugreek Seeds Export Clean", "pure-natural-fenugreek-seeds-export-clean", "0910.99.12", "kg", 1000, 1.15, 1.00, 0.90, 16000, 14, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("spices", "Nutmeg Whole Without Shell With Mace Band", "nutmeg-whole-without-shell-with-mace-band", "0908.11.00", "kg", 200, 11.20, 10.40, 9.60, 2400, 14, ["ISO 9001", "HACCP"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("spices", "Cloves Handpicked Madagascar Variety Export", "cloves-handpicked-export-grade", "0907.10.00", "kg", 300, 9.40, 8.70, 8.00, 3800, 14, ["ISO 9001", "Halal"], "India", "Sri Bharat Spices Pvt Ltd"),

    # 2. Rice & Grains (16 products)
    ("rice_grains", "Premium 1121 XXL Basmati Steam Rice", "premium-1121-xxl-basmati-steam-rice", "1006.30.20", "MT", 20, 1150.00, 1080.00, 1020.00, 450, 14, ["ISO 9001", "HACCP", "FSSAI"], "India", "Madhav Agro Exports"),
    ("rice_grains", "Traditional Basmati Rice Raw Aged 2 Years", "traditional-basmati-rice-raw-aged-2yr", "1006.30.10", "MT", 15, 1380.00, 1300.00, 1220.00, 320, 14, ["ISO 9001", "BRC"], "India", "Madhav Agro Exports"),
    ("rice_grains", "Sugandha White Sella Basmati Rice", "sugandha-white-sella-basmati-rice", "1006.30.20", "MT", 25, 890.00, 840.00, 795.00, 600, 12, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("rice_grains", "Sharbati Golden Sella Long Grain Rice", "sharbati-golden-sella-long-grain-rice", "1006.30.90", "MT", 25, 780.00, 740.00, 700.00, 500, 12, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("rice_grains", "PR-11 Non-Basmati Parboiled Rice 5% Broken", "pr-11-non-basmati-parboiled-rice-5pct", "1006.30.90", "MT", 50, 495.00, 470.00, 445.00, 1200, 10, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("rice_grains", "Vietnamese Jasmine Fragrant Rice 5% Broken", "vietnamese-jasmine-fragrant-rice-5pct", "1006.30.90", "MT", 25, 620.00, 590.00, 560.00, 1800, 14, ["ISO 9001", "HACCP", "Global GAP"], "Vietnam", "Saigon Grain & Agro Corp"),
    ("rice_grains", "ST25 Award-Winning Fragrant Rice", "st25-award-winning-fragrant-rice", "1006.30.90", "MT", 20, 860.00, 810.00, 770.00, 850, 14, ["ISO 9001", "HACCP"], "Vietnam", "Saigon Grain & Agro Corp"),
    ("rice_grains", "Vietnamese White Long Grain Rice 100% Broken", "vietnamese-white-rice-100pct-broken", "1006.40.00", "MT", 50, 380.00, 360.00, 340.00, 2200, 10, ["ISO 9001"], "Vietnam", "Saigon Grain & Agro Corp"),
    ("rice_grains", "Brazilian Yellow Maize Feed Grade Corn", "brazilian-yellow-maize-feed-grade-corn", "1005.90.10", "MT", 100, 245.00, 230.00, 218.00, 8500, 15, ["ISO 9001", "Non-GMO"], "Brazil", "Santos Specialty Coffee SA"),
    ("rice_grains", "Brazilian Soybean Non-GMO Export Grade", "brazilian-soybean-non-gmo-export-grade", "1201.90.00", "MT", 100, 480.00, 455.00, 435.00, 6000, 14, ["ISO 9001", "USDA Organic"], "Brazil", "Santos Specialty Coffee SA"),
    ("rice_grains", "Durum Wheat Semolina Coarse Milling Grade", "durum-wheat-semolina-coarse-milling", "1103.11.00", "MT", 25, 410.00, 390.00, 370.00, 950, 12, ["ISO 9001", "HACCP"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("rice_grains", "Turkish Red Whole Lentils Football Quality", "turkish-red-whole-lentils-football", "0713.40.00", "MT", 20, 790.00, 745.00, 710.00, 650, 14, ["ISO 9001", "Halal"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("rice_grains", "Kabuli Chickpeas 9mm Jumbo Sortex", "kabuli-chickpeas-9mm-jumbo-sortex", "0713.20.00", "MT", 20, 1250.00, 1180.00, 1120.00, 480, 14, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("rice_grains", "Organic Quinoa Royal White Grain", "organic-quinoa-royal-white-grain", "1008.50.00", "MT", 10, 2150.00, 2020.00, 1920.00, 180, 14, ["USDA Organic", "EU Organic", "Fairtrade"], "Brazil", "Santos Specialty Coffee SA"),
    ("rice_grains", "Vietnamese Glutinous Sweet Rice Round Grain", "vietnamese-glutinous-sweet-rice-round", "1006.30.30", "MT", 25, 540.00, 510.00, 485.00, 900, 12, ["ISO 9001"], "Vietnam", "Saigon Grain & Agro Corp"),
    ("rice_grains", "Pearl Millet Bajra Machine Cleaned", "pearl-millet-bajra-machine-cleaned", "1008.21.00", "MT", 25, 340.00, 320.00, 305.00, 1100, 10, ["ISO 9001"], "India", "Madhav Agro Exports"),

    # 3. Tea & Coffee (16 products)
    ("tea_coffee", "Cerrado Mineiro Arabica Green Coffee Beans", "cerrado-mineiro-arabica-green-coffee", "0901.11.10", "MT", 5, 4650.00, 4420.00, 4200.00, 120, 14, ["Rainforest Alliance", "Fairtrade", "ISO 9001"], "Brazil", "Santos Specialty Coffee SA"),
    ("tea_coffee", "Sul de Minas Yellow Bourbon Specialty Coffee", "sul-de-minas-yellow-bourbon-specialty", "0901.11.20", "MT", 3, 5800.00, 5500.00, 5250.00, 65, 14, ["Rainforest Alliance", "BSCA Certified"], "Brazil", "Santos Specialty Coffee SA"),
    ("tea_coffee", "Vietnamese Robusta Grade 1 Screen 18 Clean", "vietnamese-robusta-grade-1-screen-18", "0901.11.90", "MT", 10, 2850.00, 2710.00, 2580.00, 250, 12, ["UTZ Certified", "4C Verified"], "Vietnam", "Saigon Grain & Agro Corp"),
    ("tea_coffee", "Vietnamese Wet Polished Robusta Screen 16", "vietnamese-wet-polished-robusta-scr16", "0901.11.90", "MT", 15, 2720.00, 2590.00, 2460.00, 340, 12, ["ISO 9001"], "Vietnam", "Saigon Grain & Agro Corp"),
    ("tea_coffee", "Assam Orthodox TGFOP1 Second Flush Black Tea", "assam-orthodox-tgfop1-2nd-flush-black-tea", "0902.30.20", "kg", 500, 8.50, 7.80, 7.20, 8500, 10, ["Tea Board India", "ISO 9001", "Rainforest Alliance"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("tea_coffee", "Darjeeling First Flush FTGFOP1 Single Estate", "darjeeling-first-flush-ftgfop1-single-estate", "0902.30.10", "kg", 100, 28.00, 26.00, 24.00, 1200, 10, ["Tea Board India", "GI Tagged", "USDA Organic"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("tea_coffee", "Nilgiri Frost Tea Winter Harvest Specialty", "nilgiri-frost-tea-winter-harvest", "0902.30.90", "kg", 200, 12.40, 11.50, 10.60, 2400, 12, ["Tea Board India", "ISO 9001"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("tea_coffee", "Indian CTC Dust Black Tea Strong Blend", "indian-ctc-dust-black-tea-strong-blend", "0902.40.20", "kg", 1000, 3.20, 2.95, 2.70, 22000, 10, ["ISO 9001", "HACCP"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("tea_coffee", "Turkish Rize Black Tea Traditional Cut", "turkish-rize-black-tea-traditional-cut", "0902.40.00", "kg", 500, 4.60, 4.25, 3.90, 6800, 10, ["ISO 9001", "Halal"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("tea_coffee", "Turkish Apple Tea Granulated Instant Export", "turkish-apple-tea-granulated-instant", "2101.20.90", "kg", 300, 3.80, 3.45, 3.15, 4500, 8, ["ISO 9001"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("tea_coffee", "Kyoto Uji Ceremonial Grade Matcha Green Tea Powder", "kyoto-uji-ceremonial-grade-matcha", "0902.10.00", "kg", 50, 54.00, 49.50, 45.00, 650, 7, ["JAS Organic", "ISO 9001"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("tea_coffee", "Japanese Sencha First Pluck Green Tea Leaf", "japanese-sencha-first-pluck-green-tea", "0902.10.10", "kg", 100, 22.00, 20.20, 18.50, 1400, 8, ["JAS Organic"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("tea_coffee", "Japanese Genmaicha Roasted Brown Rice Green Tea", "japanese-genmaicha-roasted-rice-green-tea", "0902.10.90", "kg", 200, 14.50, 13.20, 12.00, 2100, 8, ["ISO 9001"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("tea_coffee", "Medium Dark Roasted Espresso Blend Whole Beans", "medium-dark-roasted-espresso-blend-beans", "0901.21.00", "kg", 300, 11.80, 10.90, 9.95, 4800, 7, ["HACCP", "ISO 9001"], "Brazil", "Santos Specialty Coffee SA"),
    ("tea_coffee", "Freeze-Dried Instant Arabica Coffee Powder", "freeze-dried-instant-arabica-coffee-powder", "2101.11.11", "kg", 200, 16.50, 15.20, 14.00, 3200, 10, ["ISO 9001", "Halal", "Kosher"], "Brazil", "Santos Specialty Coffee SA"),
    ("tea_coffee", "Organic Peppermint & Chamomile Herbal Tea Cut", "organic-peppermint-chamomile-herbal-tea", "1211.90.86", "kg", 250, 7.80, 7.10, 6.40, 3100, 10, ["USDA Organic", "EU Organic"], "Turkey", "Anatolia Food & Hazelnut Co"),

    # 4. Textiles & Fabrics (16 products)
    ("textiles", "100% Organic Combed Ring-Spun Cotton Yarn 30s", "100pct-organic-combed-cotton-yarn-30s", "5205.23.00", "kg", 1000, 4.80, 4.45, 4.15, 35000, 15, ["GOTS Certified", "OEKO-TEX 100", "ISO 9001"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Fine Italian Linen Fabric 180 GSM Pure Flax", "fine-italian-linen-fabric-180gsm-flax", "5309.11.00", "meter", 500, 9.80, 8.90, 8.10, 14000, 14, ["OEKO-TEX 100", "Masters of Linen"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Mercerized Cotton Poplin Shirting Fabric 120 GSM", "mercerized-cotton-poplin-shirting-120gsm", "5208.21.00", "meter", 1000, 4.20, 3.85, 3.50, 28000, 12, ["OEKO-TEX 100", "ISO 9001"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Indonesian Raw White Coir Geotextile Mesh 400 GSM", "indonesian-coir-geotextile-mesh-400gsm", "5702.20.00", "sqm", 2000, 1.45, 1.30, 1.15, 60000, 14, ["ISO 9001", "Eco-Cert"], "Indonesia", "Nusantara Natural Fibers PT"),
    ("textiles", "Natural Sisal Fiber Spun Twine 2-Ply", "natural-sisal-fiber-spun-twine-2ply", "5305.00.00", "kg", 1000, 2.10, 1.90, 1.75, 25000, 12, ["ISO 9001"], "Indonesia", "Nusantara Natural Fibers PT"),
    ("textiles", "Bleached Cotton Gauze Surgical Bandage Roll", "bleached-cotton-gauze-surgical-bandage", "3005.90.10", "meter", 5000, 0.42, 0.38, 0.34, 120000, 10, ["ISO 13485", "CE Mark"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("textiles", "Heavy Duty Cotton Duck Canvas 14oz Water-Resistant", "heavy-duty-cotton-duck-canvas-14oz", "5209.11.00", "meter", 500, 5.60, 5.10, 4.65, 16000, 14, ["ISO 9001"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Recycled Polyester RPET Spun Yarn 24s", "recycled-polyester-rpet-spun-yarn-24s", "5509.53.00", "kg", 1000, 2.85, 2.60, 2.40, 42000, 12, ["GRS Certified", "OEKO-TEX 100"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Mulberry Raw Silk Yarn 20/22 Denier Grade 4A", "mulberry-raw-silk-yarn-20-22-denier", "5002.00.00", "kg", 50, 68.00, 64.00, 60.00, 1200, 15, ["ISO 9001"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("textiles", "Denim Fabric 12.5oz Indigo Slub Twill Cotton", "denim-fabric-12-5oz-indigo-slub-twill", "5209.42.00", "meter", 1000, 4.75, 4.35, 4.00, 32000, 14, ["OEKO-TEX 100", "BCI Cotton"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Natural Jute Hessian Cloth 10oz 40-inch", "natural-jute-hessian-cloth-10oz-40in", "5310.10.10", "meter", 2000, 0.85, 0.76, 0.68, 55000, 12, ["ISO 9001"], "India", "Madhav Agro Exports"),
    ("textiles", "Terry Towel Fabric 450 GSM Zero Twist Cotton", "terry-towel-fabric-450gsm-zero-twist", "5208.52.00", "meter", 500, 6.20, 5.70, 5.25, 15000, 14, ["OEKO-TEX 100"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("textiles", "Woven Polypropylene Silt Fence Fabric", "woven-polypropylene-silt-fence-fabric", "5407.20.00", "sqm", 3000, 0.65, 0.58, 0.52, 80000, 10, ["ISO 9001"], "Indonesia", "Nusantara Natural Fibers PT"),
    ("textiles", "Bamboo Viscose Knitted Single Jersey 180 GSM", "bamboo-viscose-knitted-jersey-180gsm", "6006.42.00", "meter", 500, 5.10, 4.65, 4.25, 18000, 12, ["OEKO-TEX 100", "FSC"], "Italy", "Milano Textile Mills SpA"),
    ("textiles", "Non-Woven Spunbond Polypropylene Fabric 50 GSM", "non-woven-spunbond-pp-fabric-50gsm", "5603.12.00", "meter", 5000, 0.28, 0.25, 0.22, 150000, 8, ["ISO 9001"], "China", "Guangdong Industrial Packaging Ltd"),
    ("textiles", "Anti-Static Cleanroom Polyester Fabric 5mm Grid", "anti-static-cleanroom-polyester-fabric", "5407.61.00", "meter", 500, 3.40, 3.10, 2.80, 24000, 10, ["ISO 9001", "ESD Certified"], "China", "Shenzhen Horizon Electronics Ltd"),

    # 5. Automotive Components (16 products)
    ("auto_components", "High-Carbon Vented Front Brake Disc Rotor", "high-carbon-vented-front-brake-disc", "8708.30.91", "pcs", 100, 28.50, 26.00, 23.80, 4200, 14, ["IATF 16949", "ISO 9001", "ECE R90"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Ceramic Brake Pad Set Low-Dust Front", "ceramic-brake-pad-set-low-dust-front", "8708.30.99", "sets", 200, 14.80, 13.50, 12.20, 6800, 12, ["IATF 16949", "ECE R90"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Forged Steel Wheel Hub Wheel Bearing Unit", "forged-steel-wheel-hub-bearing-unit", "8708.99.90", "pcs", 150, 34.00, 31.20, 28.50, 3500, 14, ["IATF 16949", "ISO 9001"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Electric Power Steering Knuckle Assembly Left", "eps-knuckle-assembly-left", "8708.94.90", "pcs", 80, 52.00, 47.50, 43.50, 1800, 16, ["IATF 16949"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Automotive Grade 10.9 Flange Bolts & Lock Nuts Pack", "auto-grade-10-9-flange-bolts-nuts-pack", "7318.15.20", "sets", 500, 4.20, 3.80, 3.45, 25000, 10, ["ISO 9001", "IATF 16949"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("auto_components", "High-Pressure Common Rail Diesel Fuel Injector", "common-rail-diesel-fuel-injector", "8409.99.00", "pcs", 50, 85.00, 78.00, 72.00, 1400, 14, ["IATF 16949", "ISO 14001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("auto_components", "Engine Oil Filter Element Premium Synthetic", "engine-oil-filter-element-synthetic", "8421.23.00", "pcs", 500, 2.65, 2.40, 2.15, 38000, 8, ["ISO 9001"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Automotive Air Cabin HEPA Filter Activated Carbon", "air-cabin-hepa-filter-activated-carbon", "8421.39.80", "pcs", 300, 4.10, 3.75, 3.40, 22000, 8, ["ISO 9001", "RoHS"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Aluminum Alloy Suspension Control Arm Lower", "aluminum-suspension-control-arm-lower", "8708.80.90", "pcs", 100, 42.00, 38.50, 35.00, 2600, 15, ["IATF 16949"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Dual-Clutch Transmission Solenoid Valve Module", "dual-clutch-transmission-solenoid-valve", "8481.80.90", "pcs", 60, 68.00, 62.50, 57.00, 1500, 14, ["IATF 16949", "ISO 9001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("auto_components", "Automotive Hall Effect Wheel Speed ABS Sensor", "auto-hall-effect-abs-speed-sensor", "9031.80.80", "pcs", 200, 7.80, 7.10, 6.45, 9500, 10, ["IATF 16949", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("auto_components", "Cast Iron Exhaust Manifold Turbocharger Flange", "cast-iron-exhaust-manifold-turbo-flange", "8708.92.90", "pcs", 75, 48.00, 44.00, 40.00, 1900, 18, ["ISO 9001", "IATF 16949"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Heavy Duty Commercial Truck Brake Drum 10-Hole", "heavy-commercial-truck-brake-drum-10hole", "8708.30.91", "pcs", 40, 92.00, 85.00, 78.00, 950, 20, ["IATF 16949"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "Automotive Radiator Aluminum Brazed Core", "automotive-radiator-aluminum-brazed-core", "8708.91.90", "pcs", 80, 38.00, 35.00, 32.00, 2100, 14, ["ISO 9001"], "Japan", "Kobe Automotive Systems KK"),
    ("auto_components", "TPMS Wireless Tire Pressure Sensor 433MHz", "tpms-wireless-tire-pressure-sensor-433mhz", "9026.20.00", "pcs", 250, 9.20, 8.40, 7.65, 11000, 10, ["FCC", "CE Mark", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("auto_components", "Synthetic Polyalkylene Glycol Brake Fluid DOT 4", "synthetic-brake-fluid-dot4-export", "3819.00.00", "liters", 1000, 3.40, 3.10, 2.80, 28000, 12, ["ISO 9001", "FMVSS 116"], "Sweden", "Nordic Chemical Innovations AB"),

    # 6. Electronics & Accessories (16 products)
    ("electronics", "TradeX Horizon 14-inch Business Ultrabook Core-i7", "tradex-horizon-14in-business-ultrabook", "8471.30.01", "units", 20, 680.00, 640.00, 595.00, 850, 14, ["CE Mark", "FCC", "RoHS", "CB Scheme"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Enterprise 15.6-inch Rugged Trade Tablet FHD", "enterprise-15-6in-rugged-trade-tablet", "8471.30.02", "units", 25, 420.00, 390.00, 360.00, 1200, 12, ["IP67 Rated", "MIL-STD-810H", "CE Mark"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "100W GaN Fast Charger Multi-Port USB-C Hub", "100w-gan-fast-charger-multiport-usbc", "8504.40.95", "units", 200, 16.50, 14.80, 13.20, 18000, 8, ["UL Listed", "CE Mark", "FCC", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "15.6-inch Portable IPS Monitor 1080p Type-C", "15-6in-portable-ips-monitor-1080p", "8528.52.00", "units", 50, 84.00, 77.00, 71.00, 3200, 10, ["CE Mark", "FCC", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Active Noise Cancelling Wireless Trade Headset", "active-noise-cancelling-wireless-headset", "8518.30.00", "units", 100, 28.00, 25.50, 23.00, 6500, 10, ["Bluetooth BQB", "CE Mark", "FCC"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "20000mAh Magnetic Wireless Power Bank 20W PD", "20000mah-magnetic-wireless-power-bank", "8507.60.00", "units", 150, 14.20, 12.90, 11.60, 12000, 8, ["UN38.3", "CE Mark", "MSDS", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Industrial RFID Barcode Scanner Handheld Android 11", "industrial-rfid-barcode-scanner-android11", "8471.60.90", "units", 30, 195.00, 180.00, 165.00, 1500, 12, ["IP65 Rated", "CE Mark", "FCC"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Ergonomic Mechanical Keyboard RGB Hot-Swappable", "ergonomic-mechanical-keyboard-hotswap", "8471.60.20", "units", 100, 32.00, 29.00, 26.50, 5500, 10, ["CE Mark", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Precision 4K UHD Ultra-Wide USB Webcam with Mic", "precision-4k-uhd-usb-webcam-mic", "8525.89.00", "units", 100, 24.50, 22.00, 19.80, 7800, 8, ["CE Mark", "FCC"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Cat6A UTP Ethernet Patch Cable Pure Copper 500m", "cat6a-utp-ethernet-patch-cable-500m", "8544.49.20", "rolls", 50, 62.00, 56.00, 51.00, 2200, 10, ["ETL Verified", "ISO 9001", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Thunderbolt 4 Docking Station 12-in-1 Dual 4K HDMI", "thunderbolt-4-docking-station-12in1", "8471.80.10", "units", 50, 78.00, 71.00, 65.00, 2800, 10, ["Intel Certified", "CE Mark", "FCC"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Smart IoT Gateway 4G LTE LoRaWAN Industrial", "smart-iot-gateway-4g-lorawan-industrial", "8517.62.00", "units", 25, 145.00, 134.00, 122.00, 950, 14, ["CE Mark", "FCC", "PTCRB"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "External NVMe SSD Enclosure USB4 40Gbps Aluminum", "external-nvme-ssd-enclosure-usb4-40gbps", "8471.70.90", "units", 150, 22.00, 19.80, 17.90, 8400, 8, ["CE Mark", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "High Precision Capacitive Touch Stylus Pen Active", "capacitive-touch-stylus-pen-active", "8471.60.90", "units", 200, 9.50, 8.40, 7.50, 14000, 6, ["CE Mark", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Lithium LiFePO4 Energy Storage Battery 48V 100Ah", "lithium-lifepo4-battery-48v-100ah", "8507.60.00", "units", 10, 850.00, 790.00, 740.00, 420, 18, ["UN38.3", "CE Mark", "UL1973"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("electronics", "Microcontroller Development Board ARM Cortex-M4", "microcontroller-dev-board-arm-m4", "8542.31.00", "units", 500, 4.20, 3.75, 3.35, 45000, 8, ["CE Mark", "RoHS"], "China", "Shenzhen Horizon Electronics Ltd"),

    # 7. Industrial Machinery (16 products)
    ("machinery", "Solid Tungsten Carbide End Mill 4-Flute Set", "solid-tungsten-carbide-end-mill-4flute", "8207.70.10", "sets", 50, 64.00, 58.00, 52.50, 3200, 10, ["ISO 9001", "DIN Standard"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "High-Precision ER32 Collet Chuck Tool Holder Kit", "precision-er32-collet-chuck-holder-kit", "8466.10.01", "sets", 30, 115.00, 104.00, 94.00, 1800, 12, ["ISO 9001", "TUV Rheinland"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "CNC Indexable Carbide Turning Inserts WNMG 10-Pack", "cnc-indexable-carbide-inserts-wnmg", "8209.00.00", "packs", 100, 22.00, 19.80, 17.80, 8500, 8, ["ISO 9001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "High-Pressure Hydraulic Gear Pump 250 Bar Dual", "high-pressure-hydraulic-gear-pump-250bar", "8413.60.00", "units", 15, 240.00, 220.00, 202.00, 620, 15, ["CE Mark", "ISO 9001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Automatic Rotary Granule Pouch Packaging Machine", "automatic-rotary-pouch-packaging-machine", "8422.30.00", "units", 1, 14500.00, 13800.00, 13000.00, 25, 30, ["CE Mark", "ISO 9001"], "China", "Guangdong Industrial Packaging Ltd"),
    ("machinery", "Pneumatic Heavy Duty Corrugated Carton Stapler", "pneumatic-heavy-duty-carton-stapler", "8467.19.00", "units", 40, 78.00, 71.00, 64.00, 1600, 10, ["CE Mark"], "China", "Guangdong Industrial Packaging Ltd"),
    ("machinery", "Three-Phase Induction Electric Motor 15kW IE3", "three-phase-induction-electric-motor-15kw", "8501.52.00", "units", 10, 480.00, 440.00, 405.00, 450, 14, ["CE Mark", "IE3 Premium Efficiency"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Magnetic Base Precision Dial Indicator Gauge Set", "magnetic-base-precision-dial-gauge-set", "9017.30.00", "sets", 50, 36.00, 32.50, 29.50, 2800, 8, ["ISO 9001", "DIN 878"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Industrial Stainless Steel Ball Valve Flanged PN16", "stainless-steel-ball-valve-flanged-pn16", "8481.80.81", "units", 50, 44.00, 39.50, 35.50, 3400, 12, ["API 6D", "CE Mark", "ISO 9001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Fiber Laser Marking Machine 30W Enclosed Cabinet", "fiber-laser-marking-machine-30w", "8456.11.00", "units", 2, 2850.00, 2650.00, 2480.00, 85, 20, ["CE Mark", "FDA Compliant"], "China", "Shenzhen Horizon Electronics Ltd"),
    ("machinery", "Digital Inverter Welding Machine MIG/MAG 250A", "digital-inverter-welder-mig-mag-250a", "8515.39.00", "units", 15, 310.00, 285.00, 260.00, 750, 14, ["CE Mark", "RoHS"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "High Precision Linear Guide Rail & Bearing Block 1500mm", "precision-linear-guide-rail-bearing-1500mm", "8482.10.90", "sets", 25, 88.00, 80.00, 73.00, 1900, 12, ["ISO 9001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Semi-Automatic Thermal Shrink Tunnel Wrapper", "semi-automatic-thermal-shrink-tunnel-wrapper", "8422.40.00", "units", 3, 1850.00, 1720.00, 1600.00, 120, 20, ["CE Mark"], "China", "Guangdong Industrial Packaging Ltd"),
    ("machinery", "Helical Gear Speed Reducer Motor Box Ratio 20:1", "helical-gear-speed-reducer-motor-ratio20", "8483.40.00", "units", 12, 380.00, 350.00, 322.00, 580, 16, ["ISO 9001"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Industrial High Volume Air Blower Fan 5.5kW", "industrial-high-volume-air-blower-5-5kw", "8414.59.00", "units", 10, 560.00, 515.00, 475.00, 390, 15, ["CE Mark"], "Germany", "Bavaria Precision Tooling GmbH"),
    ("machinery", "Stainless Steel Sanitary Centrifugal Food Pump", "stainless-sanitary-centrifugal-food-pump", "8413.70.00", "units", 10, 680.00, 625.00, 575.00, 410, 15, ["3A Sanitary", "EHEDG", "CE Mark"], "Germany", "Bavaria Precision Tooling GmbH"),

    # 8. Specialty Chemicals (16 products)
    ("chemicals", "Bio-Based Ethyl Lactate Green Solvent 99.5%", "bio-based-ethyl-lactate-green-solvent", "2918.11.00", "MT", 5, 2650.00, 2480.00, 2320.00, 180, 14, ["REACH Registered", "ISO 9001", "Eco-Vadis"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "High Purity Potassium Sorbate Granular Food Grade", "high-purity-potassium-sorbate-granular", "2916.19.00", "MT", 3, 3850.00, 3620.00, 3400.00, 140, 12, ["FCC Grade", "Halal", "Kosher", "ISO 22000"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Biodegradable Alkyl Polyglucoside Surfactant APG 0810", "alkyl-polyglucoside-surfactant-apg0810", "3402.13.00", "MT", 5, 1950.00, 1820.00, 1710.00, 260, 14, ["COSMOS Approved", "REACH", "ISO 14001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Industrial Grade Citric Acid Monohydrate BP/USP", "industrial-grade-citric-acid-monohydrate", "2918.14.00", "MT", 10, 980.00, 920.00, 865.00, 600, 10, ["BP / USP Grade", "ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Sodium Benzoate Flakes Food Preservative", "sodium-benzoate-flakes-food-preservative", "2916.31.00", "MT", 5, 1680.00, 1560.00, 1460.00, 220, 12, ["ISO 9001", "Halal", "Kosher"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Refined USP Vegetable Glycerin 99.7% Pure", "refined-usp-vegetable-glycerin-99-7pct", "2905.45.00", "MT", 10, 1150.00, 1080.00, 1010.00, 550, 12, ["USP Grade", "Non-GMO", "Kosher"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Bio-Succinic Acid 100% Bio-Based Monomer", "bio-succinic-acid-100pct-bio-based", "2917.19.00", "MT", 4, 3200.00, 2980.00, 2800.00, 110, 16, ["USDA BioPreferred", "REACH"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Natural Sodium Gluconate Technical Grade 99%", "natural-sodium-gluconate-technical-grade", "2918.16.00", "MT", 10, 890.00, 830.00, 780.00, 800, 10, ["ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Industrial Xanthan Gum 80 Mesh Oil Drilling Grade", "industrial-xanthan-gum-80-mesh-oil-drilling", "3913.90.00", "MT", 5, 2950.00, 2750.00, 2580.00, 190, 14, ["API 13A", "ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Water Treatment Polyaluminium Chloride PAC 30%", "water-treatment-polyaluminium-chloride-pac30", "2827.32.00", "MT", 15, 340.00, 315.00, 292.00, 1200, 10, ["NSF 60", "ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Eco-Friendly Corrosion Inhibitor Additive Formula", "eco-friendly-corrosion-inhibitor-additive", "3811.90.00", "MT", 3, 4400.00, 4100.00, 3850.00, 95, 14, ["REACH", "ISO 14001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Glacial Acetic Acid 99.85% Tech Industrial Drum", "glacial-acetic-acid-99-85pct-tech-drum", "2915.21.00", "MT", 15, 680.00, 635.00, 595.00, 920, 12, ["ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Ascorbic Acid Vitamin C Pure Crystal Powder", "ascorbic-acid-vitamin-c-crystal-powder", "2936.27.00", "kg", 500, 5.80, 5.35, 4.95, 12000, 10, ["USP / EP Grade", "HACCP"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Optical Brightener OB-1 Polymer Fluorescent Agent", "optical-brightener-ob1-polymer-fluorescent", "3204.20.00", "kg", 200, 18.50, 17.00, 15.60, 3400, 12, ["ISO 9001", "RoHS"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Calcium Chloride 94% Prills Anhydrous Deicer", "calcium-chloride-94pct-prills-anhydrous", "2827.20.00", "MT", 20, 245.00, 225.00, 210.00, 1600, 10, ["ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),
    ("chemicals", "Silicone Antifoam Defoamer Emulsion 20% Active", "silicone-antifoam-defoamer-emulsion-20pct", "3824.99.00", "MT", 5, 1750.00, 1620.00, 1510.00, 280, 12, ["FDA 21 CFR", "ISO 9001"], "Sweden", "Nordic Chemical Innovations AB"),

    # 9. Sustainable Packaging (16 products)
    ("packaging", "Heavy Duty Double Wall Corrugated Box 450 GSM", "heavy-duty-double-wall-corrugated-box", "4819.10.00", "pcs", 1000, 0.95, 0.85, 0.76, 120000, 10, ["FSC Certified", "ISO 9001", "ISTA 3A"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Unbleached Brown Kraft Paper Bags with Twisted Handle", "brown-kraft-paper-bags-twisted-handle", "4819.40.00", "pcs", 5000, 0.18, 0.15, 0.13, 350000, 8, ["FSC Certified", "BPI Compostable"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Biodegradable Sugarcane Bagasse Clamshell Box 9-inch", "bagasse-clamshell-takeout-box-9in", "4823.70.00", "pcs", 2000, 0.14, 0.12, 0.10, 240000, 8, ["OK Compost Home", "BPI Certified", "FDA"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Honeycomb Paper Protective Wrap Roll 50cm x 250m", "honeycomb-paper-protective-wrap-roll", "4808.90.00", "rolls", 50, 24.00, 21.50, 19.50, 4800, 8, ["100% Recyclable", "FSC"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Water-Activated Reinforced Gummed Kraft Tape 70mm", "reinforced-gummed-kraft-tape-70mm", "4811.41.00", "rolls", 100, 6.20, 5.50, 4.90, 8500, 6, ["ISO 9001"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Compostable PLA Cornstarch Mailing Courier Bags", "compostable-pla-cornstarch-mailer-bags", "3923.29.00", "pcs", 3000, 0.16, 0.14, 0.12, 180000, 8, ["EN 13432", "ASTM D6400", "TUV Austria"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Molded Pulp Bottle Shipping End Caps 6-Pack", "molded-pulp-bottle-shipping-endcaps", "4823.70.00", "sets", 1000, 0.52, 0.46, 0.41, 65000, 10, ["FSC Recycled", "ISTA Tested"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Food Grade Barrier Stand-Up Pouch Matte Finish", "food-grade-barrier-standup-pouch-matte", "3923.21.00", "pcs", 5000, 0.22, 0.19, 0.17, 210000, 10, ["BRC Packaging", "FDA Compliant"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Rigid Greyboard Magnetic Gift Box Foldable", "rigid-greyboard-magnetic-gift-box-foldable", "4819.20.00", "pcs", 500, 2.40, 2.15, 1.95, 25000, 12, ["ISO 9001", "FSC"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "High Barrier Aluminium Foil Coffee Pouch with Valve", "aluminium-foil-coffee-pouch-degassing-valve", "3923.29.90", "pcs", 2000, 0.35, 0.31, 0.27, 95000, 10, ["ISO 9001", "FDA"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Biodegradable Air Pillow Void Fill Film Roll", "biodegradable-air-pillow-void-fill-roll", "3920.10.00", "rolls", 50, 32.00, 28.50, 25.80, 3600, 8, ["ASTM D6954"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Heavy Duty PP Woven Bulk FIBC Bag 1000kg Capacity", "heavy-duty-pp-woven-fibc-bag-1000kg", "6305.32.00", "pcs", 200, 8.40, 7.60, 6.90, 18000, 12, ["ISO 21898", "UN Certified"], "Indonesia", "Nusantara Natural Fibers PT"),
    ("packaging", "Recycled Kraft Corrugated Edge Board Protectors", "recycled-kraft-edge-board-protectors", "4823.90.00", "meters", 3000, 0.26, 0.23, 0.20, 140000, 8, ["FSC Certified"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Self-Adhesive Packing List Enclosed Envelopes Docupack", "packing-list-enclosed-envelopes-docupack", "3923.29.00", "pcs", 5000, 0.045, 0.039, 0.034, 450000, 6, ["ISO 9001"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Eco Thermal Insulated Box Liner for Cold Chain", "eco-thermal-insulated-box-liner-cold-chain", "4811.59.00", "sets", 250, 2.80, 2.50, 2.25, 14000, 10, ["Recyclable Paper", "ISTA 7E"], "China", "Guangdong Industrial Packaging Ltd"),
    ("packaging", "Cardboard Packaging Pallet Corrugated 1200x800", "cardboard-corrugated-pallet-1200x800", "4415.20.00", "pcs", 100, 11.50, 10.40, 9.40, 5200, 12, ["ISPM 15 Exempt", "100% Recyclable"], "China", "Guangdong Industrial Packaging Ltd"),

    # 10. Artisanal Handicrafts (16 products)
    ("handicrafts", "Kyoto Handcrafted Celadon Tea Cup Set 4-Piece", "kyoto-handcrafted-celadon-tea-cup-set", "6911.10.00", "sets", 30, 48.00, 43.50, 39.50, 1200, 14, ["Kyoto Traditional Craft", "Food Safe Test"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("handicrafts", "Traditional Japanese Yamanaka Urushi Lacquer Bowl", "japanese-yamanaka-urushi-lacquer-bowl", "4419.90.00", "pcs", 40, 38.00, 34.50, 31.00, 950, 15, ["Traditional Craft Council"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("handicrafts", "Ceramic Stoneware Ramen Bowl with Matte Glaze", "ceramic-stoneware-ramen-bowl-matte-glaze", "6912.00.00", "pcs", 100, 12.50, 11.20, 10.00, 4800, 12, ["Lead & Cadmium Free"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("handicrafts", "Hand-Chiseled Brass Inlaid Moroccan Lantern", "hand-chiseled-brass-moroccan-lantern", "9405.50.00", "pcs", 50, 28.00, 25.00, 22.50, 1800, 16, ["Fair Trade Certified"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("handicrafts", "Natural Handwoven Seagrass Storage Baskets 3-Pack", "handwoven-seagrass-storage-baskets-3pack", "4602.19.00", "sets", 100, 16.80, 15.10, 13.60, 6200, 14, ["Fumigated ISPM 15", "Eco-Friendly"], "Indonesia", "Nusantara Natural Fibers PT"),
    ("handicrafts", "Carved Sheesham Wood Floral Jewelry Trinket Box", "carved-sheesham-wood-jewelry-box", "4420.90.00", "pcs", 150, 8.50, 7.60, 6.80, 5500, 14, ["Vriksh Certified Wood", "EPCH Member"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("handicrafts", "Hand-Hammered Solid Copper Moscow Mule Mug 16oz", "hand-hammered-copper-moscow-mule-mug", "7418.10.00", "pcs", 200, 7.20, 6.40, 5.75, 9400, 10, ["FDA Food Contact Safe"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("handicrafts", "Iznik Traditional Floral Handpainted Ceramic Plate 25cm", "iznik-handpainted-ceramic-plate-25cm", "6913.90.00", "pcs", 60, 22.00, 19.80, 17.90, 1900, 14, ["UNESCO Recognized Craft"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("handicrafts", "Handloom Pashmina Wool Cashmere Shawl Embroidered", "handloom-pashmina-cashmere-shawl-embroidered", "6214.20.00", "pcs", 25, 95.00, 88.00, 81.00, 650, 14, ["GI Certified Kashmiri Craft"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("handicrafts", "Bamboo Root Hand-Carved Duck Decorative Figurine", "bamboo-root-carved-duck-figurine", "4420.10.00", "pcs", 100, 9.80, 8.80, 7.90, 3200, 12, ["CITES Non-Restricted"], "Indonesia", "Nusantara Natural Fibers PT"),
    ("handicrafts", "Handmade Marble Inlay Coasters Pietra Dura Set of 6", "marble-inlay-coasters-pietra-dura-set6", "6802.91.00", "sets", 80, 18.50, 16.50, 14.80, 2400, 12, ["EPCH Certified Artisan"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("handicrafts", "Pure Sandalwood Hand Fan Carved Jali Work", "pure-sandalwood-hand-fan-carved-jali", "4421.99.00", "pcs", 40, 42.00, 38.00, 34.50, 800, 15, ["Forest Dept Approved"], "India", "Sri Bharat Spices Pvt Ltd"),
    ("handicrafts", "Turkish Hand-Knotted Wool Kilim Rug Runner 80x250cm", "turkish-hand-knotted-wool-kilim-runner", "5701.10.00", "pcs", 15, 165.00, 152.00, 140.00, 340, 20, ["Woolmark Certified"], "Turkey", "Anatolia Food & Hazelnut Co"),
    ("handicrafts", "Hand-Blown Murano Style Art Glass Vase Sculptural", "hand-blown-murano-style-art-glass-vase", "7013.99.00", "pcs", 25, 74.00, 67.00, 61.00, 620, 16, ["Handmade Certified"], "Italy", "Milano Textile Mills SpA"),
    ("handicrafts", "Traditional Bamboo Matcha Whisk Chasen 100 Prongs", "traditional-bamboo-matcha-whisk-chasen", "9603.90.00", "pcs", 200, 6.80, 6.10, 5.50, 8500, 8, ["Food Safe Untreated"], "Japan", "Kyoto Ceramic & Craftworks"),
    ("handicrafts", "Embossed Leather Bound Writing Journal Deckle Paper", "embossed-leather-bound-journal-deckle", "4820.10.00", "pcs", 150, 7.50, 6.70, 6.00, 7200, 10, ["LWG Certified Leather"], "India", "Sri Bharat Spices Pvt Ltd"),
]


def seed_catalogue_realistic() -> int:
    session = SyncSessionLocal()
    print("================================================================================")
    print(" TradeX AI Realistic B2B Catalogue & Supplier Seeder (Prompt 23 & 24)")
    print("================================================================================")

    try:
        # 1. Categories
        cat_map = {}
        for name, slug, desc in CATEGORIES:
            cat = session.execute(select(Category).where(Category.slug == slug)).scalar_one_or_none()
            if not cat:
                cat = Category(name=name, slug=slug, description=desc)
                session.add(cat)
                session.flush()
            cat_map[slug] = cat
        print(f"Verified {len(cat_map)} categories in database.")

        # 2. Certifications
        base_certs = [
            ("ISO 9001", "ISO-9001", "International Organization for Standardization", "Quality Management Systems"),
            ("HACCP", "HACCP", "Codex Alimentarius", "Hazard Analysis Critical Control Point Food Safety"),
            ("USDA Organic", "USDA-ORG", "US Department of Agriculture", "National Organic Program Certified"),
            ("FSSAI", "FSSAI", "Food Safety and Standards Authority of India", "Central Food Licensing"),
            ("Spices Board India", "SPICES-BOARD", "Ministry of Commerce India", "Spice Export Registration"),
            ("Rainforest Alliance", "RAINFOREST", "Rainforest Alliance", "Sustainable Agriculture Standard"),
            ("OEKO-TEX 100", "OEKO-TEX", "OEKO-TEX Association", "Confidence in Textiles harmful substances tested"),
            ("IATF 16949", "IATF-16949", "International Automotive Task Force", "Automotive Quality Management"),
            ("CE Mark", "CE-MARK", "European Commission", "Conformite Europeenne European Health and Safety"),
            ("FCC", "FCC", "Federal Communications Commission", "Electromagnetic Interference Safety"),
            ("RoHS", "ROHS", "European Union", "Restriction of Hazardous Substances Directive"),
            ("FSC Certified", "FSC", "Forest Stewardship Council", "Responsible Forestry Management"),
            ("Halal", "HALAL", "Halal Certification Authority", "Global Halal Compliance"),
            ("Fairtrade", "FAIRTRADE", "Fairtrade International", "Ethical Trade and Producer Welfare"),
        ]
        cert_map = {}
        for c_name, c_code, c_body, c_desc in base_certs:
            cert = session.execute(select(Certification).where(Certification.code == c_code)).scalar_one_or_none()
            if not cert:
                cert = Certification(name=c_name, code=c_code, issuing_body=c_body, description=c_desc)
                session.add(cert)
                session.flush()
            cert_map[c_name] = cert
        print(f"Verified {len(cert_map)} standard trade certifications.")

        # 3. Suppliers & Users
        supp_map = {}
        for s_data in SUPPLIERS:
            user = session.execute(select(User).where(User.email == s_data["email"])).scalar_one_or_none()
            if not user:
                user = User(
                    email=s_data["email"],
                    password_hash=hash_password("tradex123"),
                    role="supplier",
                    is_active=True,
                    email_verified=True,
                    full_name=f"{s_data['company_name']} Director",
                )
                session.add(user)
                session.flush()

            company = session.execute(select(Company).where(Company.name == s_data["company_name"])).scalar_one_or_none()
            if not company:
                company = Company(
                    name=s_data["company_name"],
                    country=s_data["country"],
                    city=s_data["city"],
                    state=s_data["state"],
                    years_in_business=max(1, 2026 - s_data["year_founded"]),
                    verified_status="verified",
                    description=s_data["about"],
                    languages=s_data["languages"],
                    logo_url=f"https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=150&q=80",
                    banner_url=f"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
                    factory_details={
                        "cleanrooms": "ISO Class 8 Certified",
                        "employees": s_data["employees"],
                        "photos": [
                            "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80",
                            "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=800&q=80",
                        ]
                    }
                )
                session.add(company)
                session.flush()
            else:
                company.description = s_data["about"]
                company.languages = s_data["languages"]
                if not company.factory_details:
                    company.factory_details = {
                        "employees": s_data["employees"],
                        "photos": ["https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80"]
                    }

            supp = session.execute(select(Supplier).where(Supplier.company_id == company.id)).scalar_one_or_none()
            if not supp:
                supp = Supplier(
                    company_id=company.id,
                    user_id=user.id,
                    trust_score=s_data["trust_score"],
                    on_time_rate=s_data["on_time"],
                    capacity_per_month=s_data["capacity"],
                    export_countries=s_data["exports"],
                    response_time_hours=6.0,
                    repeat_buyer_rate=88.5,
                    total_buyers_count=320,
                )
                session.add(supp)
                session.flush()
            supp_map[s_data["company_name"]] = supp

        print(f"Verified {len(supp_map)} verified global suppliers.")

        # 4. Attach certifications to suppliers (including an expiring cert for Sri Bharat to test alert)
        today = date.today()
        sri_bharat = supp_map.get("Sri Bharat Spices Pvt Ltd")
        if sri_bharat:
            sri_certs = [
                ("ISO 9001", "CERT-ISO-9001-2024", today - timedelta(days=365), today + timedelta(days=365)),
                ("HACCP", "CERT-HACCP-2023", today - timedelta(days=300), today + timedelta(days=20)),  # Expiring in 20 days!
                ("Spices Board India", "CRES-SB-IND-9941", today - timedelta(days=500), today + timedelta(days=400)),
                ("USDA Organic", "USDA-NOP-IND-882", today - timedelta(days=100), today + timedelta(days=265)),
            ]
            for c_name, c_num, iss, exp in sri_certs:
                c_obj = cert_map.get(c_name)
                if c_obj:
                    existing_sc = session.execute(
                        select(SupplierCertification).where(
                            SupplierCertification.supplier_id == sri_bharat.id,
                            SupplierCertification.certification_id == c_obj.id,
                        )
                    ).scalar_one_or_none()
                    if not existing_sc:
                        sc = SupplierCertification(
                            supplier_id=sri_bharat.id,
                            certification_id=c_obj.id,
                            certificate_no=c_num,
                            issued_at=iss,
                            expires_at=exp,
                        )
                        session.add(sc)
            session.flush()

        # 5. Products & Price Tiers
        now_utc = datetime.now(timezone.utc)
        valid_until_date = today + timedelta(days=90)
        seeded_products_count = 0

        for item in CATALOGUE_TEMPLATE:
            cat_slug, name, slug, hs_code, unit, moq, p1, p2, p3, stock, lead_days, cert_list, origin, supp_name = item
            supp = supp_map.get(supp_name)
            cat = cat_map.get(cat_slug)
            if not supp or not cat:
                continue

            existing_prod = session.execute(select(Product).where(Product.slug == slug)).scalar_one_or_none()
            if not existing_prod:
                prod = Product(
                    supplier_id=supp.id,
                    category_id=cat.id,
                    name=name,
                    slug=slug,
                    description=f"Export-grade {name}. Certified origin {origin}, processed under rigorous quality control standards.",
                    hs_code=hs_code,
                    moq=moq,
                    unit=unit,
                    origin_country=origin,
                    lead_time_days=lead_days,
                    is_active=True,
                    status="published",
                    stock_available=stock,
                    available_quantity=stock,
                    reserved_quantity=int(stock * 0.15),
                    monthly_capacity=f"{stock * 2} {unit}/month",
                    availability_status="in_stock" if stock > 500 else ("limited" if stock > 0 else "out_of_stock"),
                    currency="USD",
                    price_confirmed_at=now_utc - timedelta(hours=12),
                    inventory_confirmed_at=now_utc - timedelta(hours=12),
                    confirmed_at=now_utc - timedelta(hours=12),
                    price_valid_from=today - timedelta(days=10),
                    price_valid_until=valid_until_date,
                    certifications_json=cert_list,
                    supported_destinations=["United States", "Germany", "United Kingdom", "United Arab Emirates", "Japan"],
                    incoterms=["FOB", "CIF", "CFR"],
                    payment_terms=["LC at sight", "T/T 30% deposit", "Net 30"],
                )
                session.add(prod)
                session.flush()

                # Add image
                img = ProductImage(
                    product_id=prod.id,
                    image_url=f"/images/products/{cat_slug}.svg",
                    is_primary=True,
                    display_order=0,
                )
                session.add(img)

                # Add price tiers (non-overlapping)
                t1 = PriceTier(product_id=prod.id, min_qty=moq, max_qty=moq * 5 - 1, unit_price=Decimal(str(p1)), currency="USD")
                t2 = PriceTier(product_id=prod.id, min_qty=moq * 5, max_qty=moq * 20 - 1, unit_price=Decimal(str(p2)), currency="USD")
                t3 = PriceTier(product_id=prod.id, min_qty=moq * 20, max_qty=None, unit_price=Decimal(str(p3)), currency="USD")
                session.add_all([t1, t2, t3])
                seeded_products_count += 1
            else:
                # Ensure existing product has recent price confirmation and active status
                existing_prod.status = "published"
                existing_prod.is_active = True
                existing_prod.price_confirmed_at = now_utc - timedelta(hours=12)
                existing_prod.price_valid_until = valid_until_date
                existing_prod.available_quantity = stock
                existing_prod.availability_status = "in_stock" if stock > 500 else "limited"
                if not existing_prod.images:
                    img = ProductImage(
                        product_id=existing_prod.id,
                        image_url=f"/images/products/{cat_slug}.svg",
                        is_primary=True,
                        display_order=0,
                    )
                    session.add(img)

        session.flush()
        print(f"Catalog contains {len(CATALOGUE_TEMPLATE)} distinct products across 10 categories (Newly seeded: {seeded_products_count}).")

        # 6. Seed RFQs, Inquiries, Orders, and Shipments for Sri Bharat Spices
        buyer_user = session.execute(select(User).where(User.email == "bhogeswara@tradex.ai")).scalar_one_or_none()
        if buyer_user and buyer_user.buyers:
            buyer_entity = buyer_user.buyers[0]

            # 6A. RFQs
            rfqs_data = [
                ("RFQ-2026-SPICE-001", "20 MT Wayanad Black Pepper Bold for European Import", "spices", 20000, "kg", 5.50, 6.20, "Germany", "Hamburg", today + timedelta(days=18)),
                ("RFQ-2026-CHILLI-002", "15 MT Guntur Stemless Red Chilli S4", "spices", 15000, "kg", 2.80, 3.10, "UAE", "Jebel Ali", today + timedelta(days=25)),
                ("RFQ-2026-CARD-003", "3 MT Alleppey Green Cardamom 8mm Bold", "spices", 3000, "kg", 21.00, 23.50, "USA", "New York", today + timedelta(days=12)),
                ("RFQ-2026-TEA-004", "10 MT Assam CTC Strong Black Tea", "tea_coffee", 10000, "kg", 2.60, 2.90, "United Kingdom", "London Gateway", today + timedelta(days=30)),
            ]
            for rfq_no, r_title, r_cat, r_qty, r_unit, p_min, p_max, dest_c, dest_p, d_line in rfqs_data:
                ex_rfq = session.execute(select(RFQ).where(RFQ.rfq_number == rfq_no)).scalar_one_or_none()
                if not ex_rfq:
                    rfq = RFQ(
                        rfq_number=rfq_no,
                        buyer_id=buyer_entity.id,
                        title=r_title,
                        category=r_cat,
                        quantity=r_qty,
                        unit=r_unit,
                        target_price_min=p_min,
                        target_price_max=p_max,
                        currency="USD",
                        destination_country=dest_c,
                        destination_port=dest_p,
                        deadline=d_line,
                        status="active",
                        incoterm="CIF",
                        notes="Strict pesticide residue testing required as per EU regulation 396/2005.",
                    )
                    session.add(rfq)
                    session.flush()

                    # Add quote from Sri Bharat on the first one
                    if rfq_no == "RFQ-2026-SPICE-001" and sri_bharat:
                        ex_q = session.execute(select(Quotation).where(Quotation.rfq_id == rfq.id, Quotation.supplier_id == sri_bharat.id)).scalar_one_or_none()
                        if not ex_q:
                            q = Quotation(
                                quote_number=f"QT-SB-{rfq_no}",
                                rfq_id=rfq.id,
                                supplier_id=sri_bharat.id,
                                unit_price=Decimal("5.90"),
                                landed_cost=Decimal("6.15"),
                                lead_time_days=14,
                                valid_until=today + timedelta(days=30),
                                status="submitted",
                                ai_score=94.5,
                            )
                            session.add(q)

            # 6B. Orders & Shipments for Sri Bharat Spices
            if sri_bharat:
                sample_prod = session.execute(
                    select(Product).where(Product.supplier_id == sri_bharat.id, Product.name.like("%Pepper%")).limit(1)
                ).scalar_one_or_none()

                ex_order = session.execute(select(Order).where(Order.order_number == "ORD-SB-2026-901")).scalar_one_or_none()
                if not ex_order and sample_prod:
                    order = Order(
                        order_number="ORD-SB-2026-901",
                        buyer_id=buyer_entity.id,
                        supplier_id=sri_bharat.id,
                        total_amount=Decimal("29500.00"),
                        currency="USD",
                        status="in_transit",
                        incoterm="CIF",
                        payment_terms="LC at sight, 30% advance",
                        shipping_address="Bavaria Logistics Center, Hamburg Port, Germany",
                    )
                    session.add(order)
                    session.flush()

                    oi = OrderItem(
                        order_id=order.id,
                        product_id=sample_prod.id,
                        name=sample_prod.name,
                        quantity=5000,
                        unit="kg",
                        unit_price=Decimal("5.90"),
                        total_price=Decimal("29500.00"),
                    )
                    session.add(oi)
                    session.flush()

                    # Shipment for this order
                    shipment = Shipment(
                        shipment_number="SHP-SB-HAMBURG-01",
                        order_id=order.id,
                        carrier="Maersk Line",
                        tracking_number="MSK981240182",
                        origin="Nhava Sheva Port, Mumbai, India",
                        destination="Hamburg Port, Germany",
                        mode="sea",
                        vessel_or_flight="MV Maersk Mc-Kinney Moller",
                        container_number="MSKU7612984",
                        freight_forwarder="DHL Global Forwarding",
                        incoterm="CIF",
                        goods="Malabar Tellicherry Garbled Extra Bold Black Pepper 5,000 kg",
                        eta=today + timedelta(days=14),
                        estimated_delivery=today + timedelta(days=14),
                        current_location="Suez Canal Transit",
                        status="in_transit",
                    )
                    session.add(shipment)
                    session.flush()

                    se = ShipmentEvent(
                        shipment_id=shipment.id,
                        event_type="departure",
                        location="Nhava Sheva Port",
                        description="Container loaded onto vessel and departed Mumbai.",
                        status="completed",
                    )
                    session.add(se)

            # 6C. Buyer Inquiries (Threads & Messages) for Sri Bharat Spices
            if sri_bharat:
                ex_thread = session.execute(
                    select(Thread).where(Thread.supplier_id == sri_bharat.id, Thread.title == "Inquiry regarding Guntur Chilli Flakes bulk export")
                ).scalar_one_or_none()
                if not ex_thread:
                    thread = Thread(
                        title="Inquiry regarding Guntur Chilli Flakes bulk export",
                        buyer_id=buyer_entity.id,
                        supplier_id=sri_bharat.id,
                    )
                    session.add(thread)
                    session.flush()

                    m1 = Message(
                        thread_id=thread.id,
                        sender_id=buyer_user.id,
                        body="Hello Sri Bharat team! We need 5 MT of Guntur S4 stemless chillies with Certificate of Analysis for pesticide residues. What is your lead time for Hamburg?",
                        is_read=True,
                    )
                    m2 = Message(
                        thread_id=thread.id,
                        sender_id=sri_bharat.user_id,
                        body="Thank you for reaching out. We have ready stock tested by Eurofins. Lead time is 10 days to dispatch from Nhava Sheva. Best CIF Hamburg price is $2.95/kg.",
                        is_read=True,
                    )
                    session.add_all([m1, m2])

        session.commit()
        print("================================================================================")
        print(" Realistic Seeding Completed Successfully!")
        print("================================================================================")
        return 0
    except Exception as exc:
        session.rollback()
        print(f"ERROR during realistic seeding: {exc}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    import sys
    sys.exit(seed_catalogue_realistic())
