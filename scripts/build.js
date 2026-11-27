#!/usr/bin/env node
// Renders the CMS-managed sections of index.html from the JSON under data/.

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const SERVICES_DIR = path.join(DATA_DIR, "services");
const POLICIES_DIR = path.join(DATA_DIR, "policies");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const INDEX_FILE = path.join(ROOT, "index.html");
const SERVICES_OUT_DIR = path.join(ROOT, "services");
const TEMPLATE_FILE = path.join(__dirname, "templates", "service.html");
const SITE_URL = "https://www.src-ed.co.uk";
const BUSINESS_INFO = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Stephanie Rumney Consultancy",
  alternateName: "src ed",
  description:
    "Specific Learning Difficulties Assessor and Specialist Teacher. Based in Northampton, UK. ",
  image: "https://www.src-ed.co.uk/images/logo.jpg",
  logo: "https://www.src-ed.co.uk/images/logo.jpg",
  url: "https://www.src-ed.co.uk",
  telephone: "+447974378350",
  email: "hello@src-ed.co.uk",
  address: {
    "@type": "PostalAddress",
    streetAddress: "9 Strixton Manor Business Centre, Strixton",
    addressLocality: "Wellingborough",
    addressRegion: "Northamptonshire",
    postalCode: "NN29 7PA",
    addressCountry: "GB",
  },
  geo: { "@type": "GeoCoordinates", latitude: "52.243304", longitude: "-0.686483" },
  priceRange: "££",
  openingHours: "Mo-Fr 09:00-17:00",
  sameAs: [
    "https://www.facebook.com/stephanierumneyconsultancy",
    "https://twitter.com/stephanierumne1",
    "https://www.linkedin.com/in/stephanie-rumney-033171234/",
  ],
  areaServed: [
    {
      "@type": "GeoCircle",
      geoMidpoint: { "@type": "GeoCoordinates", latitude: "52.243304", longitude: "-0.686483" },
      geoRadius: "50000",
    },
  ],
};

function slugFor(service) {
  return (
    service.slug ||
    service.id
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
  );
}

function pagePath(service) {
  return `/services/${slugFor(service)}/`;
}

function areaList(areas) {
  if (areas.length <= 1) return areas.join("");
  return areas.slice(0, -1).join(", ") + " and " + areas[areas.length - 1];
}

function fillLocation(text, location) {
  return (text || "")
    .replace("{baseDescription}", location.baseDescription || "")
    .replace("{areas}", areaList(location.areas || []));
}

function businessInfo(location) {
  const cities = (location.areas || []).map((name) => ({ "@type": "City", name }));
  return { ...BUSINESS_INFO, areaServed: [...BUSINESS_INFO.areaServed, ...cities] };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderJsonLd(services, location) {
  const offers = [];
  for (const service of services) {
    for (const offer of service.schemaOffers || []) {
      const entry = {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: offer.name,
          description: offer.description,
          provider: { "@type": "LocalBusiness", name: BUSINESS_INFO.name },
          url: service.card ? SITE_URL + pagePath(service) : undefined,
        },
      };
      if (offer.price !== undefined) {
        entry.price = String(offer.price);
        entry.priceCurrency = offer.priceCurrency || "GBP";
      }
      offers.push(entry);
    }
  }

  const payload = {
    ...businessInfo(location),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Educational Assessment and Support Services",
      itemListElement: offers,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  const indented = body
    .split("\n")
    .map((line) => "        " + line)
    .join("\n");
  return `      <script type="application/ld+json">\n${indented}\n      </script>`;
}

function renderCards(services) {
  const cards = services.filter((s) => s.card && s.modal);
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    const pair = cards.slice(i, i + 2);
    const cells = pair.map((svc, j) => {
      const delay = (i + j) * 100;
      const { card } = svc;
      return `            <div class="col-md-6 col-lg-6 mb-5" data-aos="fade-up" data-aos-delay="${delay}">
               <div class="unit-6 d-flex">
                  <div class="unit-4-icon mr-4"><span class="text-primary ${escapeHtml(card.icon)}"></span></div>
                  <div>
                     <h3>${escapeHtml(card.title)}</h3>
                     <p>${escapeHtml(card.shortDescription)}</p>
                     <p>
                        <a href="${pagePath(svc)}">Learn more about ${escapeHtml(card.title)}</a>
                     </p>
                  </div>
               </div>
            </div>`;
    });
    rows.push(
      `         <div class="row align-items-stretch">\n${cells.join("\n")}\n         </div>`
    );
  }
  return rows.join("\n");
}

function renderModals(services) {
  const blocks = [];
  for (const svc of services) {
    if (!svc.modal) continue;
    const modalId = `${svc.id}Modal`;
    const titleId = `${svc.id}ModalLongTitle`;
    const bullets = svc.modal.bullets
      .map((b) => `            <li>${escapeHtml(b)}</li>`)
      .join("\n");
    blocks.push(`      <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" aria-labelledby="${modalId}CenterTitle" aria-hidden="true">
         <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
               <div class="modal-header">
                  <h5 class="modal-title" id="${titleId}">${escapeHtml(svc.modal.title)}</h5>
                  <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                     <span aria-hidden="true">&times;</span>
                  </button>
               </div>
               <div class="modal-body">
                  <ul>
${bullets}
                  </ul>
               </div>
            </div>
         </div>
      </div>`);
  }
  return blocks.join("\n");
}

function renderServicesIntro(location) {
  const areas = areaList(location.areas || []);
  return `               <p class="lead mb-2">${escapeHtml(fillLocation(location.servicesIntro, location))}</p>
               <p class="mb-2">${escapeHtml(fillLocation("{baseDescription}", location))}. Working across ${escapeHtml(areas)}.</p>
               <p class="mb-0">${escapeHtml(location.credentials || "")}</p>`;
}

function renderWhyIndependent(block) {
  if (!block || !block.body) return "";
  const body = markdown(block.body)
    .split("\n")
    .map((line) => "               " + line)
    .join("\n");
  return `               <h3 class="h4 text-primary mt-5 mb-3">${escapeHtml(block.heading || "")}</h3>\n${body}`;
}

function renderServiceSchema(svc, location) {
  const offer = (svc.schemaOffers || [])[0] || {};
  const payload = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: svc.card.title,
    description: offer.description || svc.card.shortDescription,
    url: SITE_URL + pagePath(svc),
    serviceType: svc.card.title,
    provider: {
      "@type": "LocalBusiness",
      name: BUSINESS_INFO.name,
      url: BUSINESS_INFO.url,
      telephone: BUSINESS_INFO.telephone,
      address: BUSINESS_INFO.address,
    },
    areaServed: (location.areas || []).map((name) => ({ "@type": "City", name })),
  };
  if (offer.price !== undefined) {
    payload.offers = {
      "@type": "Offer",
      price: String(offer.price),
      priceCurrency: offer.priceCurrency || "GBP",
    };
  }
  return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
}

function renderServicePage(svc, services, location, template) {
  const page = svc.page || {};
  const title = page.seoTitle || `${svc.card.title} | Northampton & Wellingborough | SRC ED`;
  const metaDescription =
    page.metaDescription ||
    `${svc.card.shortDescription} ${fillLocation("{baseDescription}, serving {areas}.", location)}`;
  const bullets = (svc.modal ? svc.modal.bullets : [])
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n            ");
  const fees = (svc.feeRows || [])
    .map(
      (row) => `<tr><td>${escapeHtml(row.label)}</td><td align="right">${escapeHtml(row.price)}</td></tr>`
    )
    .join("\n            ");
  const feesBlock = fees
    ? `<h2 class="h4 text-primary mt-5 mb-3">Fees</h2>\n         <table class="col-12 fee-table">\n            ${fees}\n         </table>`
    : "";
  const intro = page.intro ? markdown(page.intro) : `<p>${escapeHtml(svc.card.shortDescription)}</p>`;
  const otherServices = services
    .filter((s) => s.card && s.id !== svc.id)
    .map((s) => `<li><a href="${pagePath(s)}">${escapeHtml(s.card.title)}</a></li>`)
    .join("\n            ");
  const areas = fillLocation("{baseDescription}, {areas}", location);
  const locationPara = `${escapeHtml(fillLocation("{baseDescription}", location))}, I work with families, schools and adult learners in ${escapeHtml(areaList(location.areas || []))} and across Northamptonshire.`;

  const vars = {
    TITLE: escapeHtml(title),
    META_DESCRIPTION: escapeHtml(metaDescription),
    CANONICAL: SITE_URL + pagePath(svc),
    SCHEMA: renderServiceSchema(svc, location),
    H1: escapeHtml(svc.card.title),
    INTRO: intro,
    BULLETS: bullets,
    BULLETS_HEADING: page.intro ? "At a glance" : "What this involves",
    FEES: feesBlock,
    LOCATION: locationPara,
    OTHER_SERVICES: otherServices,
    ICON: escapeHtml(svc.card.icon || "icon-file-text"),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ""));
}

function writeServicePages(services, location) {
  const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
  const written = [];
  for (const svc of services) {
    if (!svc.card) continue;
    const dir = path.join(SERVICES_OUT_DIR, slugFor(svc));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderServicePage(svc, services, location, template));
    written.push(pagePath(svc));
  }
  return written;
}

function writeSitemap(pages) {
  const urls = ["/", ...pages]
    .map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`)
    .join("\n");
  fs.writeFileSync(
    path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

function renderFeeRows(services) {
  const rows = [];
  for (const svc of services) {
    for (const row of svc.feeRows || []) {
      rows.push(`      <tr>
         <td>${escapeHtml(row.label)}</td>
         <td align="right">${escapeHtml(row.price)}</td>
      </tr>`);
    }
  }
  return rows.join("\n");
}

function renderPolicyLinks(policies) {
  return policies
    .map(
      (p) =>
        `            <li><a href="${escapeHtml(p.file)}" target="_blank">${escapeHtml(p.title)}</a></li>`
    )
    .join("\n");
}

function renderAbout(about) {
  const body = markdown(about.body)
    .split("\n")
    .map((line) => "                  " + line)
    .join("\n");
  return `                  <h2 class="section-title mb-3 text-primary">${escapeHtml(about.heading)}</h2>\n${body}`;
}

function renderAboutModal(about) {
  const body = markdown(about.moreBody)
    .split("\n")
    .map((line) => "      " + line)
    .join("\n");
  return `      <div class="modal-header">
      <h5 class="modal-title" id="aboutMeModalCenterTitle">${escapeHtml(about.moreTitle)}</h5>
      <button type="button" class="close" data-dismiss="modal" aria-label="Close">
      <span aria-hidden="true">&times;</span>
      </button>
      </div>
      <div class="modal-body">
${body}
      </div>`;
}

function renderFooterAbout(footer) {
  const body = markdown(footer.aboutBody)
    .split("\n")
    .map((line) => "      " + line)
    .join("\n");
  return `      <h2 class="footer-heading mb-4">${escapeHtml(footer.aboutHeading)}</h2>\n${body}`;
}

function markdown(text) {
  return marked.parse(text || "", { async: false }).trim();
}

function readCollection(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

function replaceMarker(html, name, content) {
  const re = new RegExp(`(<!-- BEGIN:${name} -->)([\\s\\S]*?)(<!-- END:${name} -->)`);
  if (!re.test(html)) {
    throw new Error(`marker pair not found in index.html: ${name}`);
  }
  return html.replace(re, (_, begin, _mid, end) => `${begin}\n${content}\n      ${end}`);
}

function main() {
  const services = readCollection(SERVICES_DIR);
  const policies = readCollection(POLICIES_DIR);
  const content = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));


  let html = fs.readFileSync(INDEX_FILE, "utf8");
  const location = content.location || { areas: [] };
  html = replaceMarker(html, "JSON_LD", renderJsonLd(services, location));
  html = replaceMarker(html, "SERVICES_INTRO", renderServicesIntro(location));
  html = replaceMarker(html, "WHY_INDEPENDENT", renderWhyIndependent(content.whyIndependent));
  html = replaceMarker(html, "SERVICE_CARDS", renderCards(services));
  html = replaceMarker(html, "SERVICE_MODALS", ""); // service detail now lives on /services/<slug>/
  html = replaceMarker(html, "FEE_ROWS", renderFeeRows(services));
  html = replaceMarker(html, "POLICY_LINKS", renderPolicyLinks(policies));
  html = replaceMarker(html, "ABOUT", renderAbout(content.about));
  html = replaceMarker(html, "ABOUT_MODAL", renderAboutModal(content.about));
  html = replaceMarker(html, "FOOTER_ABOUT", renderFooterAbout(content.footer));
  fs.writeFileSync(INDEX_FILE, html);
  const pages = writeServicePages(services, location);
  writeSitemap(pages);
  console.error(
    `built index.html, ${pages.length} service pages and sitemap.xml from ${services.length} services, ${policies.length} policies`
  );
}

main();
