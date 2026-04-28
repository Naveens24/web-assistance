// ============================================================
// Cavanal AI - content.js v10.0
// Dark clean theme · Stack logo · Side panel default · Natural border radius
// ============================================================

(function () {
  if (document.getElementById("cavanal-root")) return;

  // ============================================================
  // 1. PAGE EXTRACTION
  // ============================================================
  function extractCurrentPage() {
    const url = window.location.href;
    const sections = [];
    const title = document.title || "";
    const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
    const metaKw   = document.querySelector('meta[name="keywords"]')?.content || "";
    sections.push({ type:"meta", content:`${title}. ${metaDesc}. ${metaKw}`, url });

    const navSels = ["nav a","header a",".navbar a",".nav a",".menu a",".navigation a",'[role="navigation"] a',"#nav a","#menu a",".header-menu a",".main-menu a",".primary-menu a",".dropdown-menu a",".submenu a"];
    const navLinks = [], seenNav = new Set();
    navSels.forEach(sel => {
      document.querySelectorAll(sel).forEach(a => {
        const text = a.innerText?.trim(), href = a.href;
        if (text && href && text.length > 1 && text.length < 80 && !seenNav.has(href) && href.startsWith("http")) {
          seenNav.add(href); navLinks.push({ text, href });
          sections.push({ type:"nav", content:`Menu: ${text}`, url:href, label:text });
        }
      });
    });

    document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(h => {
      const text = h.innerText?.trim();
      if (!text || text.length < 2 || text.length > 300) return;
      let ctx = text, next = h.nextElementSibling, c = 0;
      while (next && c < 3) { const t = next.innerText?.trim(); if (t && t.length > 10) ctx += " " + t.substring(0,300); next = next.nextElementSibling; c++; }
      sections.push({ type:"heading", content:ctx, url:h.closest("a")?.href || h.querySelector("a")?.href || url, label:text });
    });

    document.querySelectorAll("p,article p,section p,main p,.content p").forEach(p => {
      const text = p.innerText?.trim();
      if (!text || text.length < 30 || text.length > 1500) return;
      const ns = p.closest("section") || p.closest("article") || p.closest("div[id]");
      sections.push({ type:"paragraph", content:text, url:ns?.querySelector("a")?.href || (ns?.id ? `${url}#${ns.id}` : url) });
    });

    document.querySelectorAll("ul li,ol li").forEach(li => {
      const text = li.innerText?.trim();
      if (!text || text.length < 8 || text.length > 400) return;
      sections.push({ type:"list", content:text, url:li.querySelector("a")?.href || url });
    });

    const seenLinks = new Set();
    document.querySelectorAll("a").forEach(a => {
      const text = a.innerText?.trim(), href = a.href;
      if (!text || !href || text.length < 2 || text.length > 150 || seenLinks.has(href) || !href.startsWith("http")) return;
      seenLinks.add(href);
      sections.push({ type:"link", content:`Link: ${text}`, url:href, label:text });
    });

    document.querySelectorAll("table").forEach(table => {
      const rows = [];
      table.querySelectorAll("tr").forEach(row => {
        const cells = Array.from(row.querySelectorAll("td,th")).map(c => c.innerText?.trim()).filter(Boolean);
        if (cells.length > 0) rows.push(cells.join(" | "));
      });
      if (rows.length > 0) {
        const ns = table.closest("section") || table.closest("div[id]");
        sections.push({ type:"table", content:rows.join("\n"), url:ns?.id ? `${url}#${ns.id}` : url });
      }
    });

    // Universal card selectors — covers all website types
    [
      // Generic cards
      ".card",".item",".tile",".block",".panel",".widget",
      // Products (e-commerce)
      ".product",".product-card",".product-item","[class*='product']",
      // Services / features (SaaS, corporate)
      ".service",".feature",".offer",".solution","[class*='service']","[class*='feature']",
      // Blog / news
      ".post",".article",".blog-post",".news-item","[class*='post']","[class*='article']",
      // Education
      ".course",".program",".department",".faculty","[class*='course']","[class*='program']",
      // Team / people
      ".team-member",".member",".staff",".author","[class*='team']","[class*='member']",
      // Pricing
      ".pricing",".plan",".package","[class*='pricing']","[class*='plan']",
      // Portfolio / projects
      ".project",".portfolio",".work","[class*='project']",
      // Events
      ".event","[class*='event']",
    ].forEach(sel => {
      document.querySelectorAll(sel).forEach(card => {
        const name = card.querySelector("h1,h2,h3,h4,.title,.name")?.innerText?.trim();
        const desc = card.querySelector("p,.description")?.innerText?.trim();
        if (!name || name.length > 200) return;
        sections.push({ type:"card", content:name+(desc?". "+desc:""), url:card.querySelector("a")?.href||url, label:name });
      });
    });

    return { title, url, baseUrl:window.location.origin, sections:sections.slice(0,300), navLinks, importantPages:detectImportantPages(navLinks,sections), metaDesc };
  }

  function detectImportantPages(navLinks, sections) {
    // Universal categories — work for all website types
    // e-commerce, news, corporate, university, healthcare, SaaS, government, blog
    const pages = {
      contact:null, about:null, products:null, services:null,
      pricing:null, blog:null, team:null, careers:null,
      support:null, login:null, shop:null, portfolio:null,
      news:null, events:null, gallery:null, search:null, faq:null
    };
    const kw = {
      contact:    ["contact","enquiry","reach us","get in touch","write to","message us","helpline"],
      about:      ["about","overview","our story","who we are","profile","history","mission","vision","company"],
      products:   ["product","course","program","catalog","listing","collection","shop","store","item","buy","service","solution","offering","department","faculty","academic"],
      services:   ["service","solution","what we do","offering","capabilities","feature"],
      pricing:    ["pricing","price","cost","plan","package","fee","rate","tariff","charge","subscribe","subscription"],
      blog:       ["blog","article","post","insight","editorial","write","publication","journal","magazine","news"],
      team:       ["team","people","staff","member","faculty","professor","doctor","expert","leadership","founder","director","employee","who we are"],
      careers:    ["career","job","hiring","vacancy","opening","recruitment","work with","join us","opportunity","position"],
      support:    ["support","help","faq","guide","documentation","docs","kb","knowledge","ticket","issue","problem","assist"],
      login:      ["login","signin","sign in","log in","register","signup","sign up","account","portal","dashboard","my account","samarth"],
      shop:       ["shop","store","buy","purchase","cart","order","checkout","ecommerce","marketplace"],
      portfolio:  ["portfolio","project","work","case study","showcase","gallery","exhibit","demo"],
      news:       ["news","press","media","announcement","update","release","notice","circular","notification","latest","event"],
      events:     ["event","seminar","webinar","conference","workshop","meetup","fest","celebration","calendar","schedule"],
      gallery:    ["gallery","photo","image","media","video","album","picture"],
      search:     ["search"],
      faq:        ["faq","frequently asked","question","answer","help","query"]
    };
    const allLinks = [...navLinks,...sections.filter(s=>s.type==="link").map(s=>({text:s.label||"",href:s.url}))];
    allLinks.forEach(link => {
      const combined = (link.text+" "+link.href).toLowerCase();
      for (const [key,words] of Object.entries(kw)) {
        if (!pages[key] && words.some(w=>combined.includes(w))) pages[key]={text:link.text,href:link.href};
      }
    });
    return pages;
  }

  // ============================================================
  // 2. WEBSITE SEARCH FUNCTION (searches internal site search)
  // ============================================================
  async function searchWebsite(query, baseUrl, importantPages) {
    const searchResults = [];

    // Try common search URL patterns
    const searchPatterns = [
      `${baseUrl}/search?q=${encodeURIComponent(query)}`,
      `${baseUrl}/search?query=${encodeURIComponent(query)}`,
      `${baseUrl}/?s=${encodeURIComponent(query)}`,
      `${baseUrl}/search/${encodeURIComponent(query)}`,
      importantPages.search?.href ? `${importantPages.search.href}?q=${encodeURIComponent(query)}` : null,
    ].filter(Boolean);

    for (const searchUrl of searchPatterns.slice(0,2)) {
      try {
        const resp = await fetch(searchUrl, { headers:{"Accept":"text/html"}, signal:AbortSignal.timeout(6000) });
        if (!resp.ok) continue;
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html,"text/html");
        ["script","style","noscript","footer"].forEach(tag => doc.querySelectorAll(tag).forEach(el=>el.remove()));

        const results = [];
        // Look for search result elements
        const resultSels = [".search-result",".result","article",".post",".entry","[class*='result']","[class*='search']"];
        resultSels.forEach(sel => {
          doc.querySelectorAll(sel).forEach(el => {
            const title = el.querySelector("h1,h2,h3,h4,a")?.innerText?.trim();
            const text  = el.innerText?.trim();
            const link  = el.querySelector("a")?.href;
            if (title && text && text.length > 30) {
              results.push(`SEARCH RESULT: ${title}\n${text.substring(0,500)}\n${link ? `URL: ${link}` : ""}`);
            }
          });
        });

        if (results.length > 0) {
          searchResults.push(`=== WEBSITE SEARCH: "${query}" ===\nSearch URL: ${searchUrl}\n\n${results.slice(0,5).join("\n\n")}`);
          break;
        }
      } catch(e) {}
    }

    return searchResults.join("\n");
  }

  // ============================================================
  // 3. BACKGROUND CRAWLER
  // ============================================================
  let crawledData = {}, crawlQueue = [], crawlVisited = new Set(), crawlDone = false, statusCb = null;
  function setStatus(msg) { if (statusCb) statusCb(msg); }

  async function startCrawl(navLinks, baseUrl) {
    // Universal crawl priorities — works for all website types
    const priorityKw = [
      // People & team (any site)
      "team","staff","people","faculty","professor","doctor","expert","author","employee","founder","director","leadership",
      // Products & services (e-commerce, SaaS, university)
      "product","service","solution","course","program","plan","catalog","shop","store","department","school",
      // Info pages (all sites)
      "about","pricing","price","fee","contact","faq","help","support","career","job",
      // News & updates (all sites)
      "news","blog","article","notice","event","update","announcement","press","media",
      // Admission / registration (education, gov, SaaS)
      "admission","apply","register","signup","enroll","login","portal",
      // Results & data (education, gov, e-commerce)
      "result","report","data","statistic","rank","placement","gallery","portfolio"
    ];
    const sameDomain = navLinks.filter(l => { try { return new URL(l.href).hostname === new URL(baseUrl).hostname; } catch { return false; } });
    sameDomain.sort((a,b) => {
      const as=priorityKw.some(k=>(a.text+a.href).toLowerCase().includes(k))?1:0;
      const bs=priorityKw.some(k=>(b.text+b.href).toLowerCase().includes(k))?1:0;
      return bs-as;
    });
    crawlQueue = [...sameDomain];
    while (crawlQueue.length > 0) {
      const batch = crawlQueue.splice(0,3);
      await Promise.all(batch.map(async link => {
        if (crawlVisited.has(link.href)) return;
        crawlVisited.add(link.href);
        try {
          const { text, newLinks } = await fetchPageDeep(link.href, baseUrl);
          if (text) crawledData[link.href] = { text, label:link.text, url:link.href };
          newLinks.forEach(nl => { if (!crawlVisited.has(nl.href) && !crawlQueue.find(q=>q.href===nl.href)) crawlQueue.push(nl); });
        } catch(e) {}
      }));
      await sleep(300);
    }
    crawlDone = true; setStatus("ready");
  }

  async function fetchPageDeep(url, baseUrl) {
    const resp = await fetch(url, { headers:{"Accept":"text/html"}, signal:AbortSignal.timeout(10000) });
    if (!resp.ok) return { text:null, newLinks:[] };
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html,"text/html");
    ["script","style","noscript","svg","iframe","footer"].forEach(tag => doc.querySelectorAll(tag).forEach(el=>el.remove()));
    const lines = [];
    doc.querySelectorAll("h1,h2,h3,h4").forEach(h => { const t=(h.innerText||h.textContent)?.trim(); if(t&&t.length>2&&t.length<400) lines.push(`[H] ${t} [URL:${url}]`); });
    doc.querySelectorAll("p").forEach(p => { const t=(p.innerText||p.textContent)?.trim(); if(t&&t.length>20&&t.length<1200) lines.push(`${t} [URL:${url}]`); });
    doc.querySelectorAll("li").forEach(li => { const t=(li.innerText||li.textContent)?.trim(); if(t&&t.length>8&&t.length<400) lines.push(`• ${t} [URL:${url}]`); });
    doc.querySelectorAll("table tr").forEach(row => { const cells=Array.from(row.querySelectorAll("td,th")).map(c=>(c.innerText||c.textContent)?.trim()).filter(Boolean); if(cells.length>0) lines.push(`${cells.join(" | ")} [URL:${url}]`); });
    const newLinks = [], seenNew = new Set();
    doc.querySelectorAll("a[href]").forEach(a => {
      try {
        const href = new URL(a.getAttribute("href"),url).href;
        const text = (a.innerText||a.textContent)?.trim()||"";
        if (new URL(href).hostname===new URL(baseUrl).hostname&&!seenNew.has(href)&&href.startsWith("http")&&!href.includes("#")&&!href.match(/\.(pdf|jpg|jpeg|png|gif|zip|doc|xls)$/i)) { seenNew.add(href); newLinks.push({text,href}); }
      } catch(e) {}
    });
    return { text:lines.slice(0,150).join("\n"), newLinks };
  }

  function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

  function buildFullContext(extracted) {
    let ctx = `WEBSITE: ${extracted.title}\nURL: ${extracted.url}\n\n`;
    if (extracted.navLinks.length>0) { ctx+=`=== NAVIGATION ===\n`; extracted.navLinks.forEach(n=>ctx+=`- ${n.text}: ${n.href}\n`); ctx+="\n"; }
    const impE=Object.entries(extracted.importantPages).filter(([,v])=>v);
    if (impE.length>0) { ctx+=`=== KEY PAGES ===\n`; impE.forEach(([k,v])=>ctx+=`${k.toUpperCase()}: ${v.text} → ${v.href}\n`); ctx+="\n"; }
    const byType=(type,limit)=>extracted.sections.filter(s=>s.type===type).slice(0,limit);
    const h=byType("heading",25),p=byType("paragraph",20),l=byType("list",30),c=byType("card",20),t=byType("table",10);
    if(h.length>0){ctx+=`=== HEADINGS ===\n`;h.forEach(x=>ctx+=`• ${x.content} [URL:${x.url}]\n`);ctx+="\n";}
    if(c.length>0){ctx+=`=== PROGRAMS/COURSES ===\n`;c.forEach(x=>ctx+=`• ${x.content} [URL:${x.url}]\n`);ctx+="\n";}
    if(l.length>0){ctx+=`=== KEY INFO ===\n`;l.forEach(x=>ctx+=`• ${x.content} [URL:${x.url}]\n`);ctx+="\n";}
    if(p.length>0){ctx+=`=== CONTENT ===\n`;p.forEach(x=>ctx+=`${x.content} [URL:${x.url}]\n\n`);}
    if(t.length>0){ctx+=`=== TABLES ===\n`;t.forEach(x=>ctx+=`${x.content}\n[URL:${x.url}]\n\n`);}
    const cl=Object.values(crawledData);
    if(cl.length>0){ctx+=`\n=== FULL WEBSITE CONTENT ===\n`;cl.forEach(page=>ctx+=`\n--- ${page.label} ---\n${page.url}\n${page.text.substring(0,3000)}\n`);}
    return ctx;
  }

  function generateSuggestions(extracted) {
    // Universal suggestions — adapt based on what the site actually has
    const s = ["Summarize this website"];
    const imp = extracted.importantPages;
    const title = (extracted.title || "").toLowerCase();
    const url   = (extracted.url || "").toLowerCase();

    // Products / courses / services
    if (imp.products)  s.push("What products or services are offered?");
    else if (imp.services) s.push("What services are available?");

    // Pricing
    if (imp.pricing)   s.push("What are the prices or plans?");

    // Team / people
    if (imp.team)      s.push("Who is on the team?");

    // News / blog
    if (imp.news || imp.blog) s.push("What are the latest updates?");

    // Events
    if (imp.events)    s.push("What events are coming up?");

    // Support / FAQ
    if (imp.support || imp.faq) s.push("How can I get help?");

    // Contact (always useful)
    if (imp.contact)   s.push("How to contact?");

    // Careers
    if (imp.careers)   s.push("Are there any job openings?");

    // Login / portal
    if (imp.login)     s.push("How do I login or register?");

    // Generic fallback if nothing detected
    if (s.length < 3) {
      s.push("What can I find on this website?");
      s.push("How do I get started?");
    }

    return s.slice(0, 5);
  }

  // ============================================================
  // 4. INIT
  // ============================================================
  const extracted   = extractCurrentPage();
  const suggestions = generateSuggestions(extracted);
  const convHistory = [];
  let viewMode = 0; // 0=closed, 1=mini, 2=side, 3=center

  startCrawl(extracted.navLinks, extracted.baseUrl);

  // ============================================================
  // 5. SHADOW DOM
  // ============================================================
  const rootEl = document.createElement("div");
  rootEl.id = "cavanal-root";
  document.body.appendChild(rootEl);
  const shadow = rootEl.attachShadow({ mode:"open" });

  shadow.innerHTML = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :host{
      --bg:        #ffffff;
      --bg2:       #f7f8fc;
      --bg3:       #f0f2f8;
      --border:    #e4e7f0;
      --border2:   #d0d4e4;
      --text:      #111827;
      --text2:     #6b7280;
      --text3:     #9ca3af;
      --dark:      #111827;
      --dark2:     #1f2937;
      --dark3:     #374151;
      --green:     #10b981;
      --amber:     #f59e0b;
      --blue:      #3b82f6;
      --blue-lt:   #eff6ff;
      --blue-md:   #bfdbfe;
      --sh-sm:     0 1px 6px rgba(0,0,0,0.08),0 1px 3px rgba(0,0,0,0.05);
      --sh-md:     0 6px 24px rgba(0,0,0,0.10),0 2px 8px rgba(0,0,0,0.06);
      --sh-lg:     0 16px 56px rgba(0,0,0,0.14),0 4px 16px rgba(0,0,0,0.07);
      --font:      'Inter',-apple-system,sans-serif;
      --tr:        0.2s cubic-bezier(0.4,0,0.2,1);
      --r:         12px;
      --r-pill:    999px;
    }

    /* ══ STICKY SIDE TAB ══ */
    #cv-tab{
      position:fixed; right:0; top:50%; transform:translateY(-50%);
      width:36px; background:var(--dark); border:none;
      cursor:pointer; z-index:2147483647;
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:8px; padding:20px 0;
      border-radius:12px 0 0 12px;
      box-shadow:-4px 0 20px rgba(0,0,0,0.35),-1px 0 6px rgba(0,0,0,0.2);
      transition:width var(--tr),background var(--tr);
      font-family:var(--font);
    }
    #cv-tab:hover{ width:40px; background:var(--dark2); }
    #cv-tab-icon svg{ width:18px; height:18px; display:block; }
    #cv-tab-dot{
      width:7px; height:7px; border-radius:50%;
      background:var(--green); box-shadow:0 0 7px rgba(16,185,129,0.7);
      animation:glow 2.5s infinite;
    }
    @keyframes glow{0%,100%{opacity:1;}50%{opacity:0.4;}}
    #cv-tab-label{
      writing-mode:vertical-rl; transform:rotate(180deg);
      font-size:8.5px; font-weight:700; letter-spacing:0.12em;
      color:rgba(255,255,255,0.6); text-transform:uppercase; white-space:nowrap;
    }

    /* ══ OVERLAY ══ */
    #cv-overlay{
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      backdrop-filter:blur(2px); z-index:2147483644; display:none;
      animation:fadeIn 0.18s ease;
    }
    #cv-overlay.show{display:block;}
    @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}

    /* ══ SHARED PANEL BASE ══ */
    .cv-panel{
      position:fixed; background:var(--bg);
      display:flex; flex-direction:column;
      z-index:2147483646; font-family:var(--font); overflow:hidden;
    }

    /* ══ VIEW 1: MINI FLOAT ══ */
    #cv-mini{
      bottom:20px; right:20px;
      width:380px; height:580px;
      border-radius:var(--r);
      border:1px solid var(--border);
      box-shadow:var(--sh-lg); display:none;
      animation:popUp 0.24s cubic-bezier(0.34,1.4,0.64,1);
    }
    #cv-mini.show{display:flex;}
    @keyframes popUp{from{opacity:0;transform:scale(0.88) translateY(16px);}to{opacity:1;transform:scale(1) translateY(0);}}

    /* ══ VIEW 2: SIDE PANEL ══ */
    #cv-side{
      top:0; right:-400px; width:385px; height:100vh;
      border-left:1px solid var(--border);
      box-shadow:-6px 0 28px rgba(0,0,0,0.09);
      display:flex; border-radius:0;
      transition:right var(--tr);
    }
    #cv-side.show{right:0;}

    /* ══ VIEW 3: CENTER ══ */
    #cv-center{
      top:50%; left:50%;
      transform:translate(-50%,-50%) scale(0.94);
      width:min(860px,92vw); height:min(640px,88vh);
      border-radius:var(--r); border:1px solid var(--border);
      box-shadow:var(--sh-lg); display:none; opacity:0;
      transition:transform 0.22s cubic-bezier(0.34,1.3,0.64,1),opacity 0.18s ease;
    }
    #cv-center.show{display:flex;opacity:1;transform:translate(-50%,-50%) scale(1);}

    /* ══ HEADER ══ */
    .cv-header{
      padding:12px 14px; flex-shrink:0;
      background:var(--dark); border-bottom:1px solid rgba(255,255,255,0.06);
      display:flex; align-items:center; justify-content:space-between;
    }
    #cv-mini .cv-header{border-radius:var(--r) var(--r) 0 0;}
    #cv-center .cv-header{border-radius:var(--r) var(--r) 0 0;}
    .cv-hLeft{display:flex;align-items:center;gap:9px;flex:1;min-width:0;}

    /* STACK LOGO MARK */
    .cv-logo{
      width:32px; height:32px; border-radius:9px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      background:rgba(255,255,255,0.1);
      border:1px solid rgba(255,255,255,0.15);
    }
    .cv-logo svg{width:18px;height:18px;}
    .cv-brand-name{
      font-size:13px; font-weight:700; color:#ffffff;
      letter-spacing:-0.01em; line-height:1.1; white-space:nowrap;
    }
    .cv-brand-name span{color:rgba(255,255,255,0.5);}
    .cv-tagline{
      font-size:10.5px; color:rgba(255,255,255,0.45); margin-top:2px;
      display:flex; align-items:center; gap:5px; font-weight:400;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .cv-live{
      width:5px; height:5px; border-radius:50%;
      background:var(--green); box-shadow:0 0 5px rgba(16,185,129,0.6);
      flex-shrink:0; animation:glow 2.5s infinite;
    }
    .cv-hRight{display:flex;align-items:center;gap:2px;flex-shrink:0;}

    /* View switcher buttons in header */
    .cv-vbtn{
      background:none; border:1.5px solid transparent; cursor:pointer;
      width:28px; height:28px; border-radius:7px;
      display:flex; align-items:center; justify-content:center;
      color:rgba(255,255,255,0.4); transition:all var(--tr);
      font-family:var(--font); padding:0;
    }
    .cv-vbtn svg{width:15px;height:15px;}
    .cv-vbtn:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.8);}
    .cv-vbtn.active{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.2);color:#ffffff;}
    .cv-sep{width:1px;height:14px;background:rgba(255,255,255,0.1);margin:0 2px;}
    .cv-xbtn{
      background:none;border:none;cursor:pointer;
      width:26px;height:26px;border-radius:6px;
      display:flex;align-items:center;justify-content:center;
      color:rgba(255,255,255,0.4);font-size:13px;
      transition:all var(--tr);font-family:var(--font);margin-left:2px;
    }
    .cv-xbtn:hover{background:rgba(255,255,255,0.1);color:#fff;}

    /* ══ SCAN BAR ══ */
    .cv-scanbar{height:2px;background:var(--bg3);flex-shrink:0;overflow:hidden;position:relative;}
    .cv-scanbar-inner{
      position:absolute;top:0;height:100%;width:45%;
      background:linear-gradient(90deg,transparent,var(--dark3),transparent);
      animation:scan 1.8s infinite;display:none;
    }
    .cv-scanbar.active .cv-scanbar-inner{display:block;}
    @keyframes scan{0%{left:-45%;}100%{left:100%;}}

    /* ══ SITE BAR ══ */
    .cv-sitebar{
      padding:5px 13px;background:var(--bg2);border-bottom:1px solid var(--border);
      display:flex;align-items:center;gap:6px;flex-shrink:0;
    }
    .cv-sitebar-name{font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-weight:500;}
    .cv-sitebar-name strong{color:var(--dark);font-weight:600;}

    /* ══ MESSAGES ══ */
    .cv-msgs{
      flex:1;overflow-y:auto;padding:14px 14px 8px;
      display:flex;flex-direction:column;gap:10px;
      background:var(--bg2);scroll-behavior:smooth;
    }
    .cv-msgs::-webkit-scrollbar{width:3px;}
    .cv-msgs::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}

    .cv-msg{display:flex;flex-direction:column;animation:msgIn 0.16s ease;}
    @keyframes msgIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
    .cv-msg.user{align-items:flex-end;}
    .cv-msg.bot{align-items:flex-start;}

    .cv-bubble{
      padding:10px 13px;font-size:13.5px;line-height:1.65;
      word-break:break-word;
    }
    /* User: dark bubble, slight roundness not full pill */
    .cv-msg.user .cv-bubble{
      background:var(--dark);color:#fff;max-width:82%;
      border-radius:14px 14px 4px 14px;
      box-shadow:0 2px 10px rgba(17,24,39,0.2);
    }
    /* Bot: white card, very slight rounding like Sider */
    .cv-msg.bot .cv-bubble{
      background:var(--bg);color:var(--text);max-width:96%;
      border-radius:4px 14px 14px 14px;
      border:1px solid var(--border);box-shadow:var(--sh-sm);
    }
    .cv-bubble strong{color:var(--dark);font-weight:600;}
    .cv-bubble em{color:var(--amber);font-style:normal;font-weight:600;}
    .cv-bubble code{font-size:11.5px;background:var(--bg3);color:var(--dark2);padding:1px 5px;border-radius:4px;font-family:monospace;font-weight:600;}

    .cv-source{
      display:inline-flex;align-items:center;gap:4px;margin-top:7px;
      padding:4px 10px;background:var(--bg3);border:1px solid var(--border2);
      border-radius:var(--r-pill);font-size:11px;color:var(--text2);
      text-decoration:none;font-weight:500;transition:all var(--tr);
      max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    .cv-source:hover{background:var(--border);color:var(--text);}

    .cv-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text3);margin-bottom:4px;font-weight:500;}
    .cv-badge-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
    .cv-badge-dot.web{background:var(--amber);}
    .cv-badge-dot.page{background:var(--dark3);}
    .cv-time{font-size:10px;color:var(--text3);margin-top:4px;}

    /* Typing */
    .cv-typing{display:flex;align-items:center;gap:5px;padding:10px 13px;}
    .cv-dt{width:7px;height:7px;border-radius:50%;background:var(--border2);animation:tdt 1.2s infinite ease-in-out;}
    .cv-dt:nth-child(2){animation-delay:.15s;}
    .cv-dt:nth-child(3){animation-delay:.3s;}
    @keyframes tdt{0%,60%,100%{transform:translateY(0);opacity:0.4;}30%{transform:translateY(-6px);opacity:1;}}

    /* ══ QUICK QUESTIONS ══ */
    .cv-qqs{
      border-top:1px solid var(--border);background:var(--bg);
      flex-shrink:0;padding:8px 13px 9px;
    }
    .cv-qqs-hd{
      display:flex;align-items:center;justify-content:space-between;
      margin-bottom:7px;
    }
    .cv-qqs-label{font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.07em;}
    .cv-qqs-close{
      background:none;border:none;cursor:pointer;
      width:18px;height:18px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:var(--text3);font-size:11px;transition:all var(--tr);font-family:var(--font);
    }
    .cv-qqs-close:hover{background:var(--bg3);color:var(--text);}
    .cv-chips{display:flex;flex-wrap:wrap;gap:5px;}
    .cv-chip{
      background:var(--bg3);color:var(--text2);
      border:1px solid var(--border2);
      border-radius:var(--r-pill);padding:4px 11px;
      font-size:11.5px;cursor:pointer;font-family:var(--font);
      font-weight:500;transition:all 0.14s;white-space:nowrap;
    }
    .cv-chip:hover{background:var(--dark);color:#fff;border-color:var(--dark);transform:translateY(-1px);box-shadow:0 3px 8px rgba(17,24,39,0.18);}
    .cv-qqs.hidden{display:none;}

    /* ══ INPUT ══ */
    .cv-foot{
      display:flex;align-items:center;gap:8px;
      padding:9px 11px 11px;background:var(--bg);
      border-top:1px solid var(--border);flex-shrink:0;
    }
    #cv-mini .cv-foot{border-radius:0 0 var(--r) var(--r);}
    #cv-center .cv-foot{border-radius:0 0 var(--r) var(--r);}
    .cv-inp{
      flex:1;background:var(--bg2);border:1.5px solid var(--border);
      border-radius:var(--r-pill);padding:8px 15px;font-size:13px;
      font-family:var(--font);outline:none;color:var(--text);
      transition:border-color var(--tr),box-shadow var(--tr);
    }
    .cv-inp:focus{border-color:var(--dark2);background:var(--bg);box-shadow:0 0 0 3px rgba(17,24,39,0.07);}
    .cv-inp::placeholder{color:var(--text3);}
    .cv-send{
      width:36px;height:36px;border-radius:50%;
      background:var(--dark);border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      box-shadow:0 2px 10px rgba(17,24,39,0.25);
      transition:transform var(--tr),box-shadow var(--tr),background var(--tr);
    }
    .cv-send:hover{transform:scale(1.07);box-shadow:0 4px 16px rgba(17,24,39,0.35);background:var(--dark2);}
    .cv-send:active{transform:scale(0.96);}
    .cv-send svg{width:14px;height:14px;fill:white;}

    .cv-links-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}

    /* Welcome */
    .cv-welcome{
      background:var(--bg);border:1px solid var(--border);
      border-radius:12px;padding:14px 15px;
    }
    .cv-welcome-title{font-size:14px;font-weight:700;color:var(--dark);display:flex;align-items:center;gap:7px;margin-bottom:5px;}
    .cv-welcome-sub{font-size:12.5px;color:var(--text2);line-height:1.6;}
    .cv-welcome-sub strong{color:var(--dark);font-weight:600;}
  </style>

  <!-- STICKY SIDE TAB -->
  <button id="cv-tab" title="Cavanal AI">
    <div id="cv-tab-icon">
      <!-- Stack of layers icon -->
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9"/>
        <path d="M2 12l10 5 10-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
        <path d="M2 17l10 5 10-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
      </svg>
    </div>
    <div id="cv-tab-dot"></div>
    <span id="cv-tab-label">AI</span>
  </button>

  <div id="cv-overlay"></div>

  <!-- LOGO SVG (stack icon, reused in panels) -->
  <svg id="cv-logo-tpl" style="display:none" viewBox="0 0 24 24" fill="none">
    <path d="M12 3L3 8l9 4.5L21 8 12 3z" fill="white" opacity="0.95"/>
    <path d="M3 13l9 4.5L21 13" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>
    <path d="M3 18l9 4.5L21 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
  </svg>

  <!-- VIEW 1: MINI FLOAT -->
  <div class="cv-panel" id="cv-mini">
    <div class="cv-header">
      <div class="cv-hLeft">
        <div class="cv-logo">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L3 8l9 4.5L21 8 12 3z" fill="white" opacity="0.95"/><path d="M3 13l9 4.5L21 13" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/><path d="M3 18l9 4.5L21 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/></svg>
        </div>
        <div class="cv-brand">
          <div class="cv-brand-name">Cavanal<span> AI</span></div>
          <div class="cv-tagline"><span class="cv-live"></span><span class="tl1">Scanning website...</span></div>
        </div>
      </div>
      <div class="cv-hRight">
        <button class="cv-vbtn active" data-from="1" data-to="1" title="Mini chat">
          <svg viewBox="0 0 24 24" fill="none"><path d="M17 2H7C5.9 2 5 2.9 5 4v16l4-4h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <button class="cv-vbtn" data-from="1" data-to="2" title="Side panel">
          <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" stroke-width="1.7"/></svg>
        </button>
        <button class="cv-vbtn" data-from="1" data-to="3" title="Full view">
          <svg viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="cv-sep"></div>
        <button class="cv-xbtn" data-close="1">✕</button>
      </div>
    </div>
    <div class="cv-scanbar active" id="scan1"><div class="cv-scanbar-inner"></div></div>
    <div class="cv-sitebar"><span style="font-size:10px;opacity:0.5;">🌐</span><span class="cv-sitebar-name" id="site1">Loading...</span></div>
    <div class="cv-msgs" id="msgs1"></div>
    <div class="cv-qqs" id="qqs1"><div class="cv-qqs-hd"><span class="cv-qqs-label">Quick questions</span><button class="cv-qqs-close" data-qqs="1">✕</button></div><div class="cv-chips" id="chips1"></div></div>
    <div class="cv-foot"><input class="cv-inp" id="inp1" type="text" placeholder="Ask anything..." autocomplete="off"/><button class="cv-send" data-send="1"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></div>
  </div>

  <!-- VIEW 2: SIDE PANEL -->
  <div class="cv-panel" id="cv-side">
    <div class="cv-header">
      <div class="cv-hLeft">
        <div class="cv-logo">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L3 8l9 4.5L21 8 12 3z" fill="white" opacity="0.95"/><path d="M3 13l9 4.5L21 13" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/><path d="M3 18l9 4.5L21 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/></svg>
        </div>
        <div class="cv-brand">
          <div class="cv-brand-name">Cavanal<span> AI</span></div>
          <div class="cv-tagline"><span class="cv-live"></span><span class="tl2">Scanning website...</span></div>
        </div>
      </div>
      <div class="cv-hRight">
        <button class="cv-vbtn" data-from="2" data-to="1" title="Mini chat">
          <svg viewBox="0 0 24 24" fill="none"><path d="M17 2H7C5.9 2 5 2.9 5 4v16l4-4h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <button class="cv-vbtn active" data-from="2" data-to="2" title="Side panel">
          <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" stroke-width="1.7"/></svg>
        </button>
        <button class="cv-vbtn" data-from="2" data-to="3" title="Full view">
          <svg viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="cv-sep"></div>
        <button class="cv-xbtn" data-close="2">✕</button>
      </div>
    </div>
    <div class="cv-scanbar active" id="scan2"><div class="cv-scanbar-inner"></div></div>
    <div class="cv-sitebar"><span style="font-size:10px;opacity:0.5;">🌐</span><span class="cv-sitebar-name" id="site2">Loading...</span></div>
    <div class="cv-msgs" id="msgs2"></div>
    <div class="cv-qqs" id="qqs2"><div class="cv-qqs-hd"><span class="cv-qqs-label">Quick questions</span><button class="cv-qqs-close" data-qqs="2">✕</button></div><div class="cv-chips" id="chips2"></div></div>
    <div class="cv-foot"><input class="cv-inp" id="inp2" type="text" placeholder="Ask anything about this website..." autocomplete="off"/><button class="cv-send" data-send="2"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></div>
  </div>

  <!-- VIEW 3: CENTER POPUP -->
  <div class="cv-panel" id="cv-center">
    <div class="cv-header">
      <div class="cv-hLeft">
        <div class="cv-logo">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L3 8l9 4.5L21 8 12 3z" fill="white" opacity="0.95"/><path d="M3 13l9 4.5L21 13" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/><path d="M3 18l9 4.5L21 18" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/></svg>
        </div>
        <div class="cv-brand">
          <div class="cv-brand-name">Cavanal<span> AI</span></div>
          <div class="cv-tagline"><span class="cv-live"></span><span class="tl3">Scanning website...</span></div>
        </div>
      </div>
      <div class="cv-hRight">
        <button class="cv-vbtn" data-from="3" data-to="1" title="Mini chat">
          <svg viewBox="0 0 24 24" fill="none"><path d="M17 2H7C5.9 2 5 2.9 5 4v16l4-4h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <button class="cv-vbtn" data-from="3" data-to="2" title="Side panel">
          <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" stroke-width="1.7"/></svg>
        </button>
        <button class="cv-vbtn active" data-from="3" data-to="3" title="Full view">
          <svg viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="cv-sep"></div>
        <button class="cv-xbtn" data-close="3">✕</button>
      </div>
    </div>
    <div class="cv-scanbar active" id="scan3"><div class="cv-scanbar-inner"></div></div>
    <div class="cv-sitebar"><span style="font-size:10px;opacity:0.5;">🌐</span><span class="cv-sitebar-name" id="site3">Loading...</span></div>
    <div class="cv-msgs" id="msgs3"></div>
    <div class="cv-qqs" id="qqs3"><div class="cv-qqs-hd"><span class="cv-qqs-label">Quick questions</span><button class="cv-qqs-close" data-qqs="3">✕</button></div><div class="cv-chips" id="chips3"></div></div>
    <div class="cv-foot"><input class="cv-inp" id="inp3" type="text" placeholder="Ask anything about this website..." autocomplete="off"/><button class="cv-send" data-send="3"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></div>
  </div>
  `;

  // ============================================================
  // 6. REFS
  // ============================================================
  const tab      = shadow.getElementById("cv-tab");
  const overlay  = shadow.getElementById("cv-overlay");
  const panels   = { 1:shadow.getElementById("cv-mini"), 2:shadow.getElementById("cv-side"), 3:shadow.getElementById("cv-center") };
  const msgsEls  = { 1:shadow.getElementById("msgs1"), 2:shadow.getElementById("msgs2"), 3:shadow.getElementById("msgs3") };
  const inpEls   = { 1:shadow.getElementById("inp1"),  2:shadow.getElementById("inp2"),  3:shadow.getElementById("inp3") };
  const scanEls  = { 1:shadow.getElementById("scan1"), 2:shadow.getElementById("scan2"), 3:shadow.getElementById("scan3") };
  const siteEls  = { 1:shadow.getElementById("site1"), 2:shadow.getElementById("site2"), 3:shadow.getElementById("site3") };
  const qqsEls   = { 1:shadow.getElementById("qqs1"),  2:shadow.getElementById("qqs2"),  3:shadow.getElementById("qqs3") };

  const shortTitle = extracted.title.length > 42 ? extracted.title.substring(0,42)+"…" : extracted.title;
  [1,2,3].forEach(i => { siteEls[i].innerHTML = `<strong>${shortTitle}</strong>`; });

  statusCb = () => {
    const count = Object.keys(crawledData).length;
    [1,2,3].forEach(i => {
      scanEls[i].classList.remove("active");
      const el = shadow.querySelector(`.tl${i}`);
      if (el) el.textContent = count > 0 ? `${count} pages indexed · Ready` : "Ready · Ask anything";
    });
  };

  // ============================================================
  // 7. HELPERS
  // ============================================================
  function getTime() { const d=new Date(); return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0"); }

  function formatBotText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
      .replace(/\b(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}[\-\/]\d{2}[\-\/]\d{2})\b/g,"<strong>$1</strong>")
      .replace(/\b(Rs\.?|INR|₹)\s?([\d,]+)\b/g,"<em>$1 $2</em>")
      .replace(/\b(CUET|JEE|NEET|NTA|NAAC|NIRF|UGC|AICTE)\b/g,"<code>$1</code>")
      .replace(/\n\n/g,"<br><br>").replace(/\n/g,"<br>");
  }

  function addMsgToPanel(i, html, role, sourceUrl, sourceLabel, fromWeb) {
    const container = msgsEls[i];
    if (!container) return;
    const wrap = document.createElement("div");
    wrap.className = `cv-msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "cv-bubble";
    let inner = "";
    if (role==="bot" && fromWeb)  inner+=`<div class="cv-badge"><span class="cv-badge-dot web"></span>Web search result</div>`;
    else if (role==="bot")        inner+=`<div class="cv-badge"><span class="cv-badge-dot page"></span>From website content</div>`;
    inner += html;
    bubble.innerHTML = inner;
    wrap.appendChild(bubble);
    if (role==="bot" && sourceUrl) {
      const src=document.createElement("a");
      src.className="cv-source"; src.href=sourceUrl; src.target="_blank";
      src.innerHTML=`🔗 ${sourceLabel||"View source"}`;
      wrap.appendChild(src);
    }
    const t=document.createElement("div"); t.className="cv-time"; t.textContent=getTime();
    wrap.appendChild(t);
    container.appendChild(wrap);

    // SCROLL FIX: user msg → scroll bottom; bot msg → scroll to TOP of answer
    if (role === 'user') {
      container.scrollTop = container.scrollHeight;
    } else {
      setTimeout(() => {
        const cTop = container.getBoundingClientRect().top;
        const mTop = wrap.getBoundingClientRect().top;
        container.scrollTop = container.scrollTop + (mTop - cTop) - 10;
      }, 40);
    }
  }

  function addMsgToAll(html, role, sourceUrl, sourceLabel, fromWeb) {
    [1,2,3].forEach(i => addMsgToPanel(i, html, role, sourceUrl, sourceLabel, fromWeb));
  }

  function showTypingAll() {
    [1,2,3].forEach(i => {
      const wrap=document.createElement("div"); wrap.className="cv-msg bot"; wrap.id=`typ${i}`;
      const b=document.createElement("div"); b.className="cv-bubble cv-typing";
      b.innerHTML=`<div class="cv-dt"></div><div class="cv-dt"></div><div class="cv-dt"></div>`;
      wrap.appendChild(b); msgsEls[i].appendChild(wrap); msgsEls[i].scrollTop=msgsEls[i].scrollHeight; // typing indicator always scroll to bottom
    });
  }

  function removeTypingAll() {
    [1,2,3].forEach(i => { const t=shadow.getElementById(`typ${i}`); if(t) t.remove(); });
  }

  function renderChipsAll(list) {
    [1,2,3].forEach(i => {
      const el=shadow.getElementById(`chips${i}`);
      if(!el) return;
      el.innerHTML="";
      list.slice(0,5).forEach(s => {
        const c=document.createElement("button"); c.className="cv-chip"; c.textContent=s;
        c.onclick=()=>sendMsg(s); el.appendChild(c);
      });
    });
  }

  // Quick questions close
  shadow.querySelectorAll(".cv-qqs-close").forEach(btn => {
    btn.addEventListener("click", () => {
      const qqsEl = shadow.getElementById(`qqs${btn.dataset.qqs}`);
      if (qqsEl) qqsEl.classList.add("hidden");
    });
  });

  // ============================================================
  // 8. SEND MESSAGE (with website search enhancement)
  // ============================================================
  async function sendMsg(text) {
    text = text.trim(); if (!text) return;
    [1,2,3].forEach(i => { inpEls[i].value = ""; });
    addMsgToAll(text, "user");
    convHistory.push({ role:"user", content:text });
    showTypingAll();

    // Try website search if query seems like a person/specific search
    let websiteSearchCtx = "";
    // Trigger website search for: person queries, specific item searches,
    // product lookups, job/event searches — universal across all site types
    const isPersonOrSpecific = (
      // Person / name queries (2+ capitalized words)
      (text.split(" ").filter(w => w.length > 2 && w[0] === w[0]?.toUpperCase() && /[a-zA-Z]/.test(w[0])).length >= 2) ||
      // Explicit search-type queries
      /who is|find|search|where is|how to|what is|show me|tell me about|details of|information on|contact of/i.test(text) ||
      // Specific entity lookups
      /professor|faculty|doctor|author|founder|ceo|director|manager|employee|staff|team/i.test(text) ||
      // Product/service specific
      /product|item|price|cost|feature|plan|package|model|version|specification/i.test(text) ||
      // Event/news specific
      /event|news|update|announcement|latest|upcoming|schedule|date|deadline/i.test(text)
    );
    if (isPersonOrSpecific) {
      websiteSearchCtx = await searchWebsite(text, extracted.baseUrl, extracted.importantPages);
    }

    const fullContext = buildFullContext(extracted) + (websiteSearchCtx ? `\n\n=== WEBSITE SEARCH RESULTS ===\n${websiteSearchCtx}\n` : "");

    try {
      const res = await fetch("https://cavanal-ai-backend.onrender.com", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ query:text, pageContext:fullContext, pageUrl:extracted.url, pageTitle:extracted.title, conversationHistory:convHistory.slice(-6), importantPages:extracted.importantPages, content:extracted.navLinks.slice(0,30).map(l=>({text:l.text,link:l.href})) })
      });
      const data = await res.json();
      removeTypingAll();
      const replyText   = data.reply || data.answer || "I couldn't find that. Please try rephrasing.";
      const sourceUrl   = data.sourceUrl || data.link || null;
      const sourceLabel = data.sourceLabel || "View source";
      const fromWeb     = data.fromWeb || false;
      addMsgToAll(formatBotText(replyText), "bot", sourceUrl, sourceLabel, fromWeb);
      if (data.suggestedLinks?.length > 0) {
        const linksHtml=`<span style="font-size:11px;color:#9ca3af;">📎 Related</span><div class="cv-links-row">`+data.suggestedLinks.map(l=>`<a href="${l.href}" target="_blank" class="cv-source">🔗 ${l.text}</a>`).join("")+`</div>`;
        addMsgToAll(linksHtml, "bot");
      }
      convHistory.push({ role:"assistant", content:replyText });
    } catch(e) {
      removeTypingAll();
      addMsgToAll("⚠️ Cannot connect to server. Make sure Spring Boot is running .", "bot");
    }
  }

  // ============================================================
  // 9. VIEW MANAGEMENT
  // ============================================================
  function closeAll() {
    [1,2,3].forEach(i => panels[i].classList.remove("show"));
    overlay.classList.remove("show");
    document.body.style.marginRight = "";
    viewMode = 0;
  }

  function showWelcomeIfFirst() {
    if (msgsEls[1].children.length > 0) return;
    const desc = extracted.metaDesc ? extracted.metaDesc.split(".")[0] : "";
    const html = `<div class="cv-welcome"><div class="cv-welcome-title">👋 Welcome to Cavanal AI</div><div class="cv-welcome-sub">You're on <strong>${extracted.title}</strong>.${desc?`<br><span style="font-size:12px;color:#9ca3af;">${desc}</span>`:""}<br><br>Scanning the entire website in background. Ask anything — I'll find it!</div></div>`;
    addMsgToAll(html, "bot");
    renderChipsAll(suggestions);
  }

  function openView(mode) {
    closeAll();
    viewMode = mode;
    showWelcomeIfFirst();

    // Update active state on all view buttons
    shadow.querySelectorAll(".cv-vbtn").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.to) === mode);
    });

    if (mode === 1) {
      panels[1].classList.add("show");
      setTimeout(() => inpEls[1].focus(), 200);
    } else if (mode === 2) {
      panels[2].classList.add("show");
      document.body.style.transition = "margin-right 0.22s cubic-bezier(0.4,0,0.2,1)";
      document.body.style.marginRight = "385px";
      setTimeout(() => inpEls[2].focus(), 280);
    } else if (mode === 3) {
      panels[3].classList.add("show");
      overlay.classList.add("show");
      setTimeout(() => inpEls[3].focus(), 200);
    }
  }

  // Tab → opens SIDE PANEL by default
  tab.addEventListener("click", () => { viewMode > 0 ? closeAll() : openView(2); });
  overlay.addEventListener("click", closeAll);

  // View switcher buttons
  shadow.querySelectorAll(".cv-vbtn").forEach(btn => {
    btn.addEventListener("click", () => openView(parseInt(btn.dataset.to)));
  });

  // Close buttons
  shadow.querySelectorAll(".cv-xbtn").forEach(btn => {
    btn.addEventListener("click", closeAll);
  });

  // Send
  shadow.querySelectorAll(".cv-send").forEach(btn => {
    btn.addEventListener("click", () => sendMsg(inpEls[parseInt(btn.dataset.send)].value));
  });
  [1,2,3].forEach(i => {
    inpEls[i].addEventListener("keydown", e => { if(e.key==="Enter") sendMsg(inpEls[i].value); });
  });

  // Chrome extension
  chrome.runtime.onMessage.addListener(req => {
    if (req.action === "TOGGLE_CHAT") { viewMode > 0 ? closeAll() : openView(2); }
  });

})();