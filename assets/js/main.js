(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  const header = document.querySelector("[data-header]");
  const closeNav = () => {
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "打开导航");
    nav?.classList.remove("is-open");
  };
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    nav?.classList.toggle("is-open", open);
  });
  nav
    ?.querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", closeNav));
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle?.getAttribute("aria-expanded") === "true"
    ) {
      closeNav();
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 801px)").addEventListener("change", closeNav);
  document.documentElement.classList.add("js");

  const content = document.querySelector("[data-post-content]");
  const progress = document.querySelector("[data-reading-progress]");
  const headings = content ? [...content.querySelectorAll("h2, h3")] : [];
  const toc = document.querySelector("[data-toc]");
  const tocLinks = [];
  if (toc && headings.length > 1) {
    headings.forEach((heading, index) => {
      if (!heading.id) {
        let id = `section-${index + 1}`;
        while (document.getElementById(id)) id += "-heading";
        heading.id = id;
      }
      const link = document.createElement("a");
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.textContent;
      if (heading.tagName === "H3") link.classList.add("toc-sub");
      toc.append(link);
      tocLinks.push(link);
    });
    document.querySelector("[data-outline]").hidden = false;
  }
  if (progress && content) progress.hidden = false;
  let scheduled = false;
  const updateScroll = () => {
    scheduled = false;
    header?.classList.toggle("is-scrolled", window.scrollY > 12);
    if (progress && content) {
      const rect = content.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight + 120);
      const fraction = Math.max(0, Math.min(1, (120 - rect.top) / travel));
      progress.firstElementChild.style.transform = `scaleX(${fraction})`;
    }
    if (tocLinks.length) {
      let active = 0;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= 140) active = index;
      });
      tocLinks.forEach((link, index) => {
        if (index === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }
  };
  const scheduleScroll = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateScroll);
    }
  };
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  window.addEventListener("resize", scheduleScroll, { passive: true });
  content
    ?.querySelectorAll("img")
    .forEach((image) => image.addEventListener("load", scheduleScroll));
  updateScroll();

  if (navigator.clipboard?.writeText) {
    content?.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      if (!code) return;
      const wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.before(wrapper);
      wrapper.append(pre);
      const button = document.createElement("button");
      button.className = "copy-code";
      button.type = "button";
      button.textContent = "复制代码";
      button.setAttribute("aria-live", "polite");
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(code.textContent);
          button.textContent = "已复制";
        } catch {
          button.textContent = "复制失败，请手动选择";
        }
        setTimeout(() => {
          button.textContent = "复制代码";
          button.disabled = false;
        }, 2200);
      });
      wrapper.append(button);
    });
  }
  // Content stays visible even if JavaScript or observers are unavailable.
  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll(".reveal")
      .forEach((element) => observer.observe(element));
  }
})();
