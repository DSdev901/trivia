/** Hash routes so each category and section has a copyable directory: #/geography/world */

export function parseHash(hash = location.hash) {
  const raw = String(hash || "")
    .replace(/^#/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = raw
    ? raw.split("/").map((p) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      })
    : [];
  return {
    category: parts[0] || "",
    rest: parts.slice(1),
    parts,
  };
}

export function href(parts) {
  const segs = (Array.isArray(parts) ? parts : [parts]).filter(
    (p) => p != null && String(p) !== ""
  );
  if (!segs.length) return "#/";
  return `#/${segs.map((p) => encodeURIComponent(String(p))).join("/")}`;
}

export function hashPath(hash = location.hash) {
  return href(parseHash(hash).parts);
}

export function toSlug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function crumbsHtml(items, escape) {
  const list = (items || []).filter((it) => it?.label);
  if (list.length < 2) return "";
  const esc = escape || ((v) => String(v));
  return `<nav class="crumbs" aria-label="Directory">${list
    .map((it, i) => {
      const label = esc(it.label);
      if (i === list.length - 1) {
        return `<span class="crumbs-now">${label}</span>`;
      }
      return `<a href="${it.href}">${label}</a><span class="crumbs-sep" aria-hidden="true">/</span>`;
    })
    .join("")}</nav>`;
}
