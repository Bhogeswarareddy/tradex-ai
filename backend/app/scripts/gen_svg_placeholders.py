import os

out_dir = os.path.join("frontend", "public", "images", "products")
os.makedirs(out_dir, exist_ok=True)

categories = {
    "spices": ("#EF4444", "Spices & Condiments"),
    "rice_grains": ("#F59E0B", "Rice & Grains"),
    "tea_coffee": ("#10B981", "Tea & Coffee"),
    "textiles": ("#6366F1", "Textiles & Fabrics"),
    "auto_components": ("#3B82F6", "Automotive Components"),
    "electronics": ("#06B6D4", "Electronics & Accessories"),
    "machinery": ("#64748B", "Industrial Machinery"),
    "chemicals": ("#8B5CF6", "Specialty Chemicals"),
    "packaging": ("#EC4899", "Sustainable Packaging"),
    "handicrafts": ("#D97706", "Artisanal Handicrafts"),
    "default": ("#2563EB", "TradeX Verified Product"),
}

for slug, (color, title) in categories.items():
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#0F172A"/>
  <rect x="20" y="20" width="360" height="260" rx="16" fill="#1E293B" stroke="{color}" stroke-width="2" stroke-opacity="0.4"/>
  <circle cx="200" cy="120" r="48" fill="{color}" fill-opacity="0.15" stroke="{color}" stroke-width="2"/>
  <text x="200" y="128" font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="{color}" text-anchor="middle">{title[0]}</text>
  <text x="200" y="200" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#F8FAFC" text-anchor="middle">{title}</text>
  <text x="200" y="224" font-family="system-ui, sans-serif" font-size="12" font-weight="500" fill="#94A3B8" text-anchor="middle">TradeX AI Verified Global Export</text>
</svg>"""
    with open(os.path.join(out_dir, f"{slug}.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)

print(f"Generated {len(categories)} placeholder SVG images in {out_dir}")
