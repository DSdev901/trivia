document.documentElement.classList.add("js");

const nav = document.getElementById("page-nav");
const list = document.getElementById("nav-list");
const toggle = document.getElementById("nav-toggle");
const altBtn = document.getElementById("alt-display");
const printBtn = document.getElementById("print-btn");

const sectionEls = [...document.querySelectorAll("[data-section]")];

function markNav(id) {
  for (const a of list.querySelectorAll("a")) {
    a.setAttribute("aria-current", a.hash === `#${id}` ? "true" : "false");
  }
}

const navIo = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
    if (visible[0]?.target?.id) markNav(visible[0].target.id);
  },
  { root: null, rootMargin: "-35% 0px -45% 0px", threshold: 0 }
);

for (const el of sectionEls) navIo.observe(el);

const revealIo = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) e.target.classList.add("vis");
    }
  },
  { threshold: 0.15 }
);

for (const el of document.querySelectorAll(".rv")) revealIo.observe(el);

toggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});

list?.addEventListener("click", (e) => {
  if (e.target.closest("a")) nav.classList.remove("is-open");
});

printBtn?.addEventListener("click", () => window.print());

altBtn?.addEventListener("click", () => {
  const on = document.documentElement.getAttribute("data-alt-display") === "b";
  document.documentElement.setAttribute("data-alt-display", on ? "a" : "b");
  altBtn.setAttribute("aria-pressed", String(!on));
  altBtn.querySelector("[data-alt-label]").textContent = on ? "Fraunces" : "Source Sans";
});
