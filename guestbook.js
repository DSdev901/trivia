function netscapeBadgeHtml() {
  return `<span class="web-badge web-badge--netscape" role="img" aria-label="Netscape Site of the Day">
    <svg viewBox="0 0 88 31" width="88" height="31" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="88" height="31" fill="#000"/>
      <rect x="1" y="1" width="86" height="29" fill="#1a1048"/>
      <rect x="2" y="2" width="84" height="1" fill="#6e5cb8"/>
      <rect x="2" y="28" width="84" height="1" fill="#09041c"/>
      <rect x="3" y="5" width="20" height="21" fill="#4b1d7a"/>
      <rect x="4" y="6" width="18" height="1" fill="#7b3aad"/>
      <text x="13" y="20" text-anchor="middle" fill="#f4f0ff" font-family="Georgia, Times, serif" font-size="15" font-weight="700">N</text>
      <text x="27" y="14" fill="#f4f0ff" font-family="Tahoma, Geneva, sans-serif" font-size="7" font-weight="700">NETSCAPE</text>
      <text x="27" y="24" fill="#f4f0ff" font-family="Tahoma, Geneva, sans-serif" font-size="5.4" font-weight="700">SITE OF THE DAY</text>
    </svg>
  </span>`;
}

function y2kBadgeHtml() {
  return `<span class="web-badge web-badge--y2k" role="img" aria-label="Y2K compliant">
    <svg viewBox="0 0 88 31" width="88" height="31" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <rect width="88" height="31" fill="#06281f"/>
      <rect x="1" y="1" width="86" height="29" fill="#0b5f4b"/>
      <rect x="2" y="2" width="84" height="1" fill="#3d9a80"/>
      <rect x="2" y="28" width="84" height="1" fill="#05281f"/>
      <text x="44" y="13" text-anchor="middle" fill="#f4f0ff" font-family="Tahoma, Geneva, sans-serif" font-size="8" font-weight="700">Y2K</text>
      <text x="44" y="24" text-anchor="middle" fill="#f4f0ff" font-family="Tahoma, Geneva, sans-serif" font-size="6.2" font-weight="700">COMPLIANT</text>
    </svg>
  </span>`;
}

export function homeWebBadgesHtml() {
  return `<div class="web-badges">${netscapeBadgeHtml()}${y2kBadgeHtml()}</div>`;
}
