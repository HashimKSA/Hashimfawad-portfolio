/* script.js
   Particle background plus ambient glow, GSAP animations,
   navigation, smooth scroll, and contact form handling.
*/

document.addEventListener("DOMContentLoaded", () => {
  // Basic DOM refs
  const canvas = document.getElementById("bg-canvas");
  const glow = document.getElementById("ambient-glow");
  const ctx = canvas.getContext("2d", { alpha: true });
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");
  const navLinks = mainNav.querySelectorAll("a[href^='#']");
  const yearEl = document.getElementById("year");
  const contactForm = document.getElementById("contact-form");
  const formFeedback = document.getElementById("form-feedback");

  // Set year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Respect reduced motion
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Navigation toggle for mobile ----
  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    mainNav.classList.toggle("open");
  });

  // Close mobile nav on link click
  navLinks.forEach(a => a.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }));

  // Smooth scroll for internal links
  navLinks.forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const id = a.getAttribute("href");
      const target = document.querySelector(id);
      if (!target) return;
      const offset = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 64);
      window.scrollTo({ top: offset, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  });

  // ---- Canvas: ambient slow particles ----
  let width = 0;
  let height = 0;
  let particles = [];
  const PARTICLE_COUNT = Math.max(50, Math.round((window.innerWidth * window.innerHeight) / 90000)); // scale with viewport
  const MAX_RADIUS = 2.6;
  const MIN_RADIUS = 0.6;

  // device pixel ratio handling
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = Math.random() * (MAX_RADIUS - MIN_RADIUS) + MIN_RADIUS;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r,
        alpha: 0.08 + Math.random() * 0.18,
        vx: (Math.random() - 0.5) * 0.12, // very slow
        vy: (Math.random() - 0.5) * 0.12
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, width, height);

    // soft background overlay to create faint trail effect
    ctx.fillStyle = "rgba(3,7,16,0.28)";
    ctx.fillRect(0, 0, width, height);

    particles.forEach(p => {
      // move
      p.x += p.vx;
      p.y += p.vy;

      // subtle wrap-around
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      // glow gradient per particle
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
      grad.addColorStop(0, `rgba(0,209,196,${p.alpha * 0.9})`);
      grad.addColorStop(0.2, `rgba(63,197,255,${p.alpha * 0.4})`);
      grad.addColorStop(1, "rgba(3,7,16,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
      ctx.fill();

      // core dot
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, p.alpha + 0.05)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  let rafId = null;
  function animate() {
    drawParticles();
    rafId = requestAnimationFrame(animate);
  }

  // initialize canvas and particles
  function startCanvas() {
    resizeCanvas();
    initParticles();
    if (!prefersReducedMotion) {
      if (!rafId) animate();
    } else {
      // If reduced motion, draw once and stop
      drawParticles();
    }
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    initParticles();
  });

  startCanvas();

  // ---- Ambient glow follows cursor subtly ----
  // We set CSS variables for mouse position percentage and update glow background
  const root = document.documentElement;
  function updateGlow(clientX, clientY) {
    const xPct = (clientX / window.innerWidth) * 100;
    const yPct = (clientY / window.innerHeight) * 100;
    root.style.setProperty("--mouse-x", xPct + "%");
    root.style.setProperty("--mouse-y", yPct + "%");
    // increase subtle alpha on movement for brief time
    glow.style.transition = "background 160ms linear";
  }

  let lastMove = 0;
  window.addEventListener("mousemove", e => {
    if (prefersReducedMotion) return;
    updateGlow(e.clientX, e.clientY);
    lastMove = performance.now();
  });

  // For touch devices, place glow near center on touch
  window.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (t) updateGlow(t.clientX, t.clientY);
  }, { passive: true });

  // subtle idle drift of glow center to avoid static feel
  let glowAngle = 0;
  function glowIdleLoop() {
    glowAngle += 0.002;
    const idleX = 50 + Math.cos(glowAngle) * 4;
    const idleY = 50 + Math.sin(glowAngle * 1.2) * 3;
    if ((performance.now() - lastMove) > 3000) {
      root.style.setProperty("--mouse-x", idleX + "%");
      root.style.setProperty("--mouse-y", idleY + "%");
    }
    requestAnimationFrame(glowIdleLoop);
  }
  glowIdleLoop();

  // ---- GSAP animations and ScrollTrigger ----
  // only initialize if GSAP exists
  if (typeof gsap !== "undefined") {
    // register plugin if available
    if (gsap && gsap.registerPlugin) {
      try { gsap.registerPlugin(ScrollTrigger); } catch (e) {}
    }

    // hero entrance
    if (!prefersReducedMotion) {
      gsap.from(".title", { y: 30, opacity: 0, duration: 0.9, ease: "power3.out" });
      gsap.from(".subtitle", { y: 18, opacity: 0, duration: 0.9, delay: 0.12, ease: "power3.out" });
      gsap.from(".hero-cta .btn", { y: 8, opacity: 0, stagger: 0.08, duration: 0.6, delay: 0.28, ease: "power3.out" });
    }

    // reveal sections on scroll
    document.querySelectorAll(".section").forEach(section => {
      const tHead = section.querySelector("h2, .title");
      const targets = Array.from(section.querySelectorAll("h2, p, .project-card, .project-body, .project-media, .skills-grid li, .form-row, .btn"));
      if (prefersReducedMotion) {
        targets.forEach(el => el.classList.add("visible"));
      } else {
        targets.forEach((el, index) => {
          gsap.fromTo(el, { y: 18, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.7, delay: index * 0.05,
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none none"
            },
            ease: "power2.out"
          });
        });
      }
    });

    // subtle parallax for project media on mouse move over card
    document.querySelectorAll(".project-card").forEach(card => {
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const tiltX = (py - 0.5) * 6;
        const tiltY = (px - 0.5) * -6;
        gsap.to(card, { rotationX: tiltX, rotationY: tiltY, transformPerspective: 800, duration: 0.6, ease: "power2.out" });
      });
      card.addEventListener("mouseleave", () => {
        gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.6, ease: "power2.out" });
      });
    });
  }

  // ---- Simple active link highlighting based on scroll ----
  const sections = Array.from(document.querySelectorAll("section[id]"));
  function onScroll() {
    const mid = window.scrollY + window.innerHeight * 0.45;
    let current = sections[0];
    for (const sec of sections) {
      if (sec.offsetTop <= mid) current = sec;
      else break;
    }
    const id = current.getAttribute("id");
    mainNav.querySelectorAll("a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#${id}`));
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---- Contact form validation and simulated send ----
  contactForm.addEventListener("submit", e => {
    e.preventDefault();
    formFeedback.textContent = "";
    const name = contactForm.name.value.trim();
    const email = contactForm.email.value.trim();
    const message = contactForm.message.value.trim();
    if (name.length < 2) {
      formFeedback.textContent = "Please provide your name.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formFeedback.textContent = "Please provide a valid email address.";
      return;
    }
    if (message.length < 10) {
      formFeedback.textContent = "Please write a short message (at least 10 characters).";
      return;
    }

    // show sending state
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    // Simulate async send, then provide success message
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      contactForm.reset();
      formFeedback.textContent = "Message sent. I will reply by email if relevant.";
    }, 900);
  });

  // ---- Clean up on unload ----
  window.addEventListener("pagehide", () => {
    if (rafId) cancelAnimationFrame(rafId);
  });
});
