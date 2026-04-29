"""
Cavanal AI - Python Extraction Microservice
Runs on port 5000 alongside Java Spring Boot (port 8080)
Handles: PDF text, images (OCR), deep page crawling

Install: pip install flask requests beautifulsoup4 PyPDF2 pillow pytesseract
Run:     python extractor.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import json
import os
import traceback

app = Flask(__name__)
CORS(app)

# ── PDF extraction (PyPDF2 — no OCR needed for text PDFs)
try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("PyPDF2 not installed.")

# OCR disabled — not supported on MSYS2 Python
OCR_AVAILABLE = False


# ============================================================
# 1. DEEP URL CRAWL — fetch sub-pages for richer context
# ============================================================
@app.route("/crawl", methods=["POST"])
def crawl():
    """
    Crawl a URL and extract ALL text content from it.
    Called by Java when the main page doesn't have enough context.
    """
    data = request.json
    url = data.get("url", "")
    depth = data.get("depth", 2)  # how many sub-pages to follow

    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        result = crawl_page(url, depth)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


def crawl_page(url, depth=2):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove noise
    for tag in soup(["script", "style", "noscript", "svg", "footer", "iframe"]):
        tag.decompose()

    extracted = {
        "url": url,
        "title": soup.title.string if soup.title else "",
        "sections": []
    }

    # Meta description
    meta = soup.find("meta", attrs={"name": "description"})
    if meta:
        extracted["metaDescription"] = meta.get("content", "")

    # All headings with context
    for tag in ["h1", "h2", "h3", "h4"]:
        for h in soup.find_all(tag):
            text = h.get_text(strip=True)
            if text and 2 < len(text) < 300:
                # Get next sibling paragraphs
                context = text
                next_el = h.find_next_sibling()
                count = 0
                while next_el and count < 3:
                    t = next_el.get_text(strip=True)
                    if t and len(t) > 10:
                        context += " " + t[:300]
                    next_el = next_el.find_next_sibling()
                    count += 1

                # Find nearest anchor
                nearest_a = h.find_parent("a") or h.find("a")
                link = nearest_a["href"] if nearest_a and nearest_a.get("href") else url

                extracted["sections"].append({
                    "type": "heading",
                    "tag": tag,
                    "content": context[:600],
                    "url": make_absolute(link, url),
                    "label": text
                })

    # Paragraphs
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if 30 < len(text) < 1500:
            # Find nearest section/id for URL anchoring
            parent = p.find_parent(id=True)
            anchor = f"#{parent['id']}" if parent else ""
            nearest_a = p.find("a")
            link = nearest_a["href"] if nearest_a and nearest_a.get("href") else f"{url}{anchor}"

            extracted["sections"].append({
                "type": "paragraph",
                "content": text,
                "url": make_absolute(link, url),
                "label": text[:60]
            })

    # List items
    for li in soup.find_all("li"):
        text = li.get_text(strip=True)
        if 8 < len(text) < 400:
            a = li.find("a")
            link = a["href"] if a and a.get("href") else url
            extracted["sections"].append({
                "type": "list",
                "content": text,
                "url": make_absolute(link, url),
                "label": a.get_text(strip=True) if a else text[:50]
            })

    # Tables
    for table in soup.find_all("table"):
        rows = []
        for row in table.find_all("tr"):
            cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
            if cells:
                rows.append(" | ".join(cells))
        if rows:
            parent = table.find_parent(id=True)
            anchor = f"#{parent['id']}" if parent else ""
            extracted["sections"].append({
                "type": "table",
                "content": "\n".join(rows[:20]),
                "url": f"{url}{anchor}",
                "label": "Table data"
            })

    # All links (for navigation)
    links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = make_absolute(a["href"], url)
        text = a.get_text(strip=True)
        if href and href not in seen and text and 1 < len(text) < 100:
            seen.add(href)
            links.append({"text": text, "href": href})
    extracted["links"] = links[:100]

    # If depth > 1, crawl sub-pages (limited to avoid overload)
    if depth > 1:
        from urllib.parse import urlparse
        base_domain = urlparse(url).netloc
        sub_pages = []
        crawled = 0

        for link in links[:5]:  # only first 5 sub-pages
            href = link["href"]
            if urlparse(href).netloc == base_domain and href != url:
                try:
                    sub = crawl_page(href, depth=0)
                    sub_pages.append(sub)
                    crawled += 1
                    if crawled >= 3:
                        break
                except Exception:
                    pass

        extracted["subPages"] = sub_pages

    extracted["sections"] = extracted["sections"][:200]
    return extracted


# ============================================================
# 2. PDF TEXT EXTRACTION
# ============================================================
@app.route("/extract-pdf", methods=["POST"])
def extract_pdf():
    """
    Extract text from a PDF URL or base64 content.
    Returns structured sections with page numbers as URL anchors.
    """
    if not PDF_AVAILABLE:
        return jsonify({"error": "PyPDF2 not installed"}), 501

    data = request.json
    pdf_url = data.get("url", "")
    pdf_base64 = data.get("base64", "")

    try:
        if pdf_url:
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = requests.get(pdf_url, headers=headers, timeout=15)
            pdf_bytes = resp.content
        elif pdf_base64:
            import base64 as b64
            pdf_bytes = b64.b64decode(pdf_base64)
        else:
            return jsonify({"error": "No PDF URL or base64 provided"}), 400

        import io
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))

        sections = []
        full_text = []

        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            text = text.strip()
            if len(text) > 20:
                full_text.append(text)
                # Split into paragraphs
                paras = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
                for para in paras[:10]:
                    sections.append({
                        "type": "pdf_paragraph",
                        "content": para[:800],
                        "url": f"{pdf_url}#page={i+1}",
                        "label": f"Page {i+1}",
                        "page": i + 1
                    })

        return jsonify({
            "success": True,
            "pages": len(reader.pages),
            "sections": sections[:100],
            "fullText": "\n\n".join(full_text)[:15000]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# 3. IMAGE OCR
# ============================================================
@app.route("/extract-image", methods=["POST"])
def extract_image():
    """
    Extract text from an image URL using OCR (Tesseract).
    """
    if not OCR_AVAILABLE:
        return jsonify({"error": "pytesseract not installed"}), 501

    data = request.json
    image_url = data.get("url", "")
    image_base64 = data.get("base64", "")

    try:
        if image_url:
            resp = requests.get(image_url, timeout=10)
            img = Image.open(io.BytesIO(resp.content))
        elif image_base64:
            img_bytes = base64.b64decode(image_base64)
            img = Image.open(io.BytesIO(img_bytes))
        else:
            return jsonify({"error": "No image URL or base64"}), 400

        # Run OCR
        text = pytesseract.image_to_string(img, lang="eng")
        text = text.strip()

        return jsonify({
            "success": True,
            "text": text,
            "wordCount": len(text.split())
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# 4. FIND PERSON/FACULTY ON A WEBSITE
# ============================================================
@app.route("/find-person", methods=["POST"])
def find_person():
    """
    Search for a specific person's name across multiple pages of a website.
    Called when user asks about a professor, faculty member, etc.
    """
    data = request.json
    name = data.get("name", "").lower()
    base_url = data.get("baseUrl", "")
    search_urls = data.get("urls", [])  # nav links to search through

    if not name or not base_url:
        return jsonify({"error": "Name and baseUrl required"}), 400

    results = []
    checked = set()

    # Also add likely faculty pages
    faculty_paths = [
        "/faculty", "/staff", "/people", "/team",
        "/about/faculty", "/academics/faculty",
        "/department/faculty", "/our-team",
        "/about-us/faculty", "/faculties"
    ]
    for path in faculty_paths:
        search_urls.append(base_url.rstrip("/") + path)

    for url in search_urls[:15]:  # limit pages checked
        if url in checked:
            continue
        checked.add(url)

        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            resp = requests.get(url, headers=headers, timeout=8)
            if resp.status_code != 200:
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            text = soup.get_text(separator=" ", strip=True).lower()

            if name in text:
                # Found! Extract surrounding context
                full_text = soup.get_text(separator=" ", strip=True)
                idx = full_text.lower().find(name)
                if idx >= 0:
                    start = max(0, idx - 200)
                    end = min(len(full_text), idx + 500)
                    context = full_text[start:end].strip()

                    results.append({
                        "url": url,
                        "context": context,
                        "found": True
                    })

        except Exception:
            continue

    return jsonify({
        "name": name,
        "found": len(results) > 0,
        "results": results[:5]
    })


# ============================================================
# HELPERS
# ============================================================
def make_absolute(href, base_url):
    if not href:
        return base_url
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        return f"{parsed.scheme}://{parsed.netloc}{href}"
    return base_url


# ============================================================
# HEALTH CHECK
# ============================================================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "pdf_support": PDF_AVAILABLE,
        "ocr_support": OCR_AVAILABLE,
        "port": 5000
    })


if __name__ == "__main__":
    import os

    port = int(os.environ.get("PORT", 5000))

    print("=" * 50)
    print("AVA Python Extraction Service")
    print(f"Running on port {port}")
    print(f"PDF support: {PDF_AVAILABLE}")
    print(f"OCR support: {OCR_AVAILABLE}")
    print("=" * 50)

    app.run(host="0.0.0.0", port=port, debug=False)