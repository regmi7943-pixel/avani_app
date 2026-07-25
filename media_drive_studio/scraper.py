import re
import json
import urllib.parse
import urllib.request
import ssl
import sys
from typing import List, Dict, Any

# Ensure stdout handles UTF-8 on Windows cmd/powershell without UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    except Exception:
        pass

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8'
}

REGIONAL_KEYWORDS = ["Nepal", "India", "South Asia"]
REGIONAL_DOMAINS = [
    'imimg.com', 'indiamart.com', 'narcnepal.org', 'thulo.com.np',
    'agribegri.com', 'ugaoo.com', 'bighaat.com', 'amazon.in', 'flipkart.com',
    'krishiseva.com', 'nurserylive.com', '.in', '.np'
]

def safe_log(prefix: str, text: str, err: Any = ""):
    """Logs messages safely without crashing on Windows non-ASCII characters."""
    msg = f"{prefix} {text}: {err}" if err else f"{prefix} {text}"
    try:
        print(msg)
    except Exception:
        safe_msg = msg.encode('ascii', 'backslashreplace').decode('ascii')
        print(safe_msg)

def clean_query_term(item_name: str, category: str = "") -> str:
    """
    Cleans up query strings for optimal web image search results.
    Strips Devanagari/Nepali script in parentheses, pack sizes (50kg, 100ml),
    and special characters that disrupt search engines or cause encoding issues.
    """
    if not item_name:
        return category or "Agriculture"

    query = item_name

    # Strip non-latin scripts (like Nepali/Devanagari \u0900-\u097F) inside or outside parentheses
    query = re.sub(r'[\u0900-\u097F]+', '', query)

    # Strip weight/volume/pack specifications (e.g. "50kg Bag", "100ml Bottle", "25 kg")
    query = re.sub(r'\b\d+\s*(kg|g|l|ml|pack|bag|tins?|bottles?|units?|liter|litres?)\b', '', query, flags=re.IGNORECASE)

    # Remove empty brackets/parentheses and special symbols
    query = re.sub(r'[\(\)\[\]/\\_\-\|\:\;]+', ' ', query)

    # Clean up multiple spaces
    query = re.sub(r'\s+', ' ', query).strip()

    # If clean query is too short (e.g. was only Nepali text), fall back to original stripped of parentheses
    if len(query) < 3:
        query = re.sub(r'[\(\)\[\]]', '', item_name).strip()

    return query or item_name

def is_regional_url(url: str) -> bool:
    """Checks if image URL belongs to South Asian / Indian / Nepali domain."""
    url_lower = url.lower()
    return any(domain in url_lower for domain in REGIONAL_DOMAINS)

def search_bing_images(query: str, category: str = "", max_results: int = 8) -> List[Dict[str, str]]:
    """Scrapes direct image URLs from Bing Image Search targeting South Asia / Nepal / India."""
    results = []
    try:
        clean = clean_query_term(query)
        # Add Asian regional agricultural context to search query
        search_term = f"{clean} Nepal India"
        encoded_query = urllib.parse.quote(search_term.encode('utf-8'))
        # mkt=en-IN and cc=IN targets Indian & South Asian market regions
        url = f"https://www.bing.com/images/search?q={encoded_query}&mkt=en-IN&cc=IN&form=HDRSC2"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_context, timeout=8) as response:
            html = response.read().decode('utf-8', errors='ignore')

            murls = re.findall(r'&quot;murl&quot;:&quot;(.*?)&quot;', html)
            turls = re.findall(r'&quot;turl&quot;:&quot;(.*?)&quot;', html)
            titles = re.findall(r'&quot;t&quot;:&quot;(.*?)&quot;', html)

            for i in range(min(len(murls), max_results)):
                img_url = murls[i]
                thumb_url = turls[i] if i < len(turls) else img_url
                title = titles[i] if i < len(titles) else f"{query} Image"

                source_label = 'South Asian Market' if is_regional_url(img_url) else 'Bing Imagery'
                results.append({
                    'url': img_url,
                    'thumbnail': thumb_url,
                    'title': title,
                    'source': source_label,
                    'is_regional': is_regional_url(img_url)
                })
    except Exception as e:
        safe_log("[Bing Scraper Error]", query, e)
    return results

def search_duckduckgo_images(query: str, max_results: int = 6) -> List[Dict[str, str]]:
    """Scrapes images using DuckDuckGo API targeting India/South Asia."""
    results = []
    try:
        clean = clean_query_term(query)
        search_term = f"{clean} India Nepal"
        params = urllib.parse.urlencode({'q': search_term})
        req1 = urllib.request.Request(f"https://duckduckgo.com/?{params}", headers=HEADERS)
        with urllib.request.urlopen(req1, context=ssl_context, timeout=6) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        vqd_match = re.search(r'vqd=([\d-]+)&', html) or re.search(r'vqd="([\d-]+)"', html)
        vqd = vqd_match.group(1) if vqd_match else ""

        if vqd:
            img_params = urllib.parse.urlencode({
                'l': 'in-en', # Region: India / South Asia
                'o': 'json',
                'q': search_term,
                'vqd': vqd,
                'f': ',,,',
                'p': '1'
            })
            req2 = urllib.request.Request(f"https://duckduckgo.com/i.js?{img_params}", headers=HEADERS)
            with urllib.request.urlopen(req2, context=ssl_context, timeout=6) as img_resp:
                data = json.loads(img_resp.read().decode('utf-8', errors='ignore'))
                for item in data.get('results', [])[:max_results]:
                    img_url = item.get('image')
                    thumb_url = item.get('thumbnail')
                    if img_url:
                        source_label = 'South Asian Web' if is_regional_url(img_url) else 'DuckDuckGo'
                        results.append({
                            'url': img_url,
                            'thumbnail': thumb_url or img_url,
                            'title': item.get('title', query),
                            'source': source_label,
                            'is_regional': is_regional_url(img_url)
                        })
    except Exception as e:
        safe_log("[DDG Scraper Warning]", query, e)
    return results

def search_wikimedia_commons(query: str, max_results: int = 4) -> List[Dict[str, str]]:
    """Fetches images from Wikimedia Commons API targeting South Asian agriculture."""
    results = []
    try:
        cleaned = clean_query_term(query)
        params = urllib.parse.urlencode({
            'action': 'query',
            'format': 'json',
            'generator': 'search',
            'gsrsearch': f"{cleaned} Nepal India agriculture",
            'gsrnamespace': '6',
            'gsrlimit': max_results,
            'prop': 'imageinfo',
            'iiprop': 'url|size'
        })
        url = f"https://commons.wikimedia.org/w/api.php?{params}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context, timeout=6) as response:
            data = json.loads(response.read().decode('utf-8', errors='ignore'))
            pages = data.get('query', {}).get('pages', {})
            for page_id, page in pages.items():
                imageinfo = page.get('imageinfo', [])
                if imageinfo:
                    img_url = imageinfo[0].get('url')
                    if img_url:
                        results.append({
                            'url': img_url,
                            'thumbnail': img_url,
                            'title': page.get('title', '').replace('File:', ''),
                            'source': 'Wikimedia Asia',
                            'is_regional': True
                        })
    except Exception as e:
        safe_log("[Wikimedia Error]", query, e)
    return results

def get_category_fallback_images(category: str) -> List[Dict[str, str]]:
    """Curated fallback high quality South Asian agricultural photos by category."""
    fallbacks = {
        'Seeds': [
            {'url': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300', 'title': 'South Asian Grain Seeds', 'source': 'Unsplash HD', 'is_regional': True},
            {'url': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300', 'title': 'Golden Paddy Seeds', 'source': 'Unsplash HD', 'is_regional': True}
        ],
        'Fertilizer': [
            {'url': 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1628352081506-83c43123ed6d?w=300', 'title': 'Organic Soil Fertilizer', 'source': 'Unsplash HD', 'is_regional': True},
            {'url': 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1475a?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1475a?w=300', 'title': 'Granular NPK Fertilizer', 'source': 'Unsplash HD', 'is_regional': True}
        ],
        'Tools': [
            {'url': 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?w=300', 'title': 'Agriculture Hand Tools (Kuto/Kodalo)', 'source': 'Unsplash HD', 'is_regional': True},
            {'url': 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1589923188900-85dae523342b?w=300', 'title': 'Asian Farm Tools & Sprayer', 'source': 'Unsplash HD', 'is_regional': True}
        ]
    }
    return fallbacks.get(category, [
        {'url': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', 'thumbnail': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=300', 'title': 'Asian Agriculture Stock', 'source': 'Unsplash HD', 'is_regional': True}
    ])

def scrape_item_candidates(item_name: str, category: str = "", description: str = "") -> List[Dict[str, str]]:
    """Gathers candidate images for an item prioritizing South Asian / Nepal / India region."""
    candidates = []
    seen_urls = set()

    clean_name = clean_query_term(item_name, category)

    # 1. Bing Image search with IN/NP regional market parameters
    bing_res = search_bing_images(clean_name, category, max_results=6)
    for res in bing_res:
        if res['url'] not in seen_urls:
            candidates.append(res)
            seen_urls.add(res['url'])

    # 2. DuckDuckGo Image search with IN region setting
    ddg_res = search_duckduckgo_images(clean_name, max_results=4)
    for res in ddg_res:
        if res['url'] not in seen_urls:
            candidates.append(res)
            seen_urls.add(res['url'])

    # 3. Wikimedia Commons search with Nepal/India context
    wiki_res = search_wikimedia_commons(clean_name, max_results=3)
    for res in wiki_res:
        if res['url'] not in seen_urls:
            candidates.append(res)
            seen_urls.add(res['url'])

    # Sort candidates so South Asian / Indian / Nepali domains appear FIRST
    candidates.sort(key=lambda c: 0 if c.get('is_regional') else 1)

    # 4. Fallback images if total candidates < 3
    if len(candidates) < 3:
        fallbacks = get_category_fallback_images(category)
        for fb in fallbacks:
            if fb['url'] not in seen_urls:
                candidates.append(fb)
                seen_urls.add(fb['url'])

    return candidates[:8]

if __name__ == '__main__':
    test_query = 'Stainless Steel Hand Hoe (कुटो / कोदालो)'
    print(f"Testing Regional Scraper for: {test_query}")
    results = scrape_item_candidates(test_query, "Tools")
    print(f"Found {len(results)} candidate images:")
    for r in results:
        print(f"- [{r['source']}] {r['title']} -> {r['url'][:75]}...")
