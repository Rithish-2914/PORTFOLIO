/* ===== THREE.JS SETUP ===== */
let scene, camera, renderer, particles, torus;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let animationId;
let isAnimating = true;
let webGLOk = true;

function isWebGLSupported() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
}

function initThree() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    if (!isWebGLSupported()) {
        webGLOk = false;
        canvas.style.background = 'radial-gradient(circle at center, rgba(212,175,55,0.08), transparent)';
        return;
    }

    try {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.devicePixelRatio <= 2 });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); isAnimating = false; cancelAnimationFrame(animationId); });
        canvas.addEventListener('webglcontextrestored', () => { isAnimating = true; animate(); });

        // Particles
        const geo = new THREE.BufferGeometry();
        const count = window.innerWidth < 768 ? 400 : 700;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 12;
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        particles = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.022, color: 0xd4af37, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending
        }));
        scene.add(particles);

        // Torus
        torus = new THREE.Mesh(
            new THREE.TorusGeometry(1.8, 0.25, 12, 80),
            new THREE.MeshBasicMaterial({ color: 0xc0c0c0, wireframe: true, transparent: true, opacity: 0.15 })
        );
        scene.add(torus);

        // Pause when not in view
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { if (!isAnimating && webGLOk) { isAnimating = true; animate(); } }
                else { isAnimating = false; cancelAnimationFrame(animationId); }
            });
        }, { threshold: 0.05 });
        obs.observe(canvas.parentElement);

        animate();
    } catch (err) {
        console.error('Three.js init failed:', err);
        webGLOk = false;
    }
}

function animate() {
    if (!isAnimating || !renderer) return;
    animationId = requestAnimationFrame(animate);
    if (particles) { particles.rotation.x += 0.0002; particles.rotation.y += 0.0004; }
    if (torus) { torus.rotation.x += 0.004; torus.rotation.y += 0.002; torus.rotation.z += 0.004; }
    camera.position.x += (targetX - camera.position.x) * 0.025;
    camera.position.y += (-targetY - camera.position.y) * 0.025;
    renderer.render(scene, camera);
}

/* ===== CURSOR ===== */
function initCursor() {
    const cursor = document.getElementById('cursor');
    const dot = document.getElementById('cursorDot');
    if (!cursor || !dot) return;
    if (window.matchMedia('(max-width: 768px)').matches) return;

    let cx = 0, cy = 0, dx = 0, dy = 0;

    document.addEventListener('mousemove', e => {
        cx = e.clientX; cy = e.clientY;
        targetX = (e.clientX / window.innerWidth) * 2 - 1;
        targetY = (e.clientY / window.innerHeight) * 2 - 1;
        dot.style.left = cx + 'px';
        dot.style.top = cy + 'px';
    }, { passive: true });

    function updateCursor() {
        dx += (cx - dx) * 0.12;
        dy += (cy - dy) * 0.12;
        cursor.style.left = dx + 'px';
        cursor.style.top = dy + 'px';
        requestAnimationFrame(updateCursor);
    }
    updateCursor();

    document.querySelectorAll('a, button, .skill-card, .project-card, .cert-card, .filter-btn').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
}

/* ===== PARTICLES (CSS) ===== */
function initParticles() {
    const container = document.getElementById('homeParticles');
    if (!container) return;
    for (let i = 0; i < 25; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.setProperty('--duration', (4 + Math.random() * 6) + 's');
        p.style.setProperty('--delay', (-Math.random() * 8) + 's');
        p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
        container.appendChild(p);
    }
}

/* ===== TYPEWRITER ===== */
function initTypewriter() {
    const el = document.getElementById('typewriter');
    if (!el) return;
    const lines = [
        "Let's not predict the future, let's build it!",
        "Building solutions that make a real impact.",
        "Turning vision into reality through innovation.",
        "The youngest solo startup founder in the world."
    ];
    let li = 0, ci = 0, deleting = false;

    function type() {
        const current = lines[li];
        if (!deleting) {
            el.textContent = current.slice(0, ci + 1);
            ci++;
            if (ci === current.length) { deleting = true; setTimeout(type, 2500); return; }
        } else {
            el.textContent = current.slice(0, ci - 1);
            ci--;
            if (ci === 0) { deleting = false; li = (li + 1) % lines.length; }
        }
        setTimeout(type, deleting ? 35 : 60);
    }
    setTimeout(type, 800);
}

/* ===== THEME ===== */
function initTheme() {
    const btn = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');
    const html = document.documentElement;
    const saved = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', saved);
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    if (btn) {
        btn.addEventListener('click', () => {
            const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        });
    }
}

/* ===== NAVBAR ===== */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const overlay = document.getElementById('navOverlay');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    // Active link on scroll
    const links = document.querySelectorAll('.nav-link[href^="#"]');
    const sections = document.querySelectorAll('.section');
    function setActive() {
        let cur = '';
        sections.forEach(s => {
            if (window.scrollY >= s.offsetTop - 120) cur = s.id;
        });
        links.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + cur);
        });
    }
    window.addEventListener('scroll', setActive, { passive: true });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            window.scrollTo({ top: target.offsetTop - 72, behavior: 'smooth' });
            if (navLinks) navLinks.classList.remove('open');
            if (hamburger) hamburger.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // Hamburger
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            const open = navLinks.classList.toggle('open');
            hamburger.classList.toggle('active', open);
            if (overlay) overlay.classList.toggle('active', open);
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (navLinks) navLinks.classList.remove('open');
            if (hamburger) hamburger.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

/* ===== SCROLL ANIMATIONS ===== */
function initScrollAnimations() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('aos-animate'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
    document.querySelectorAll('[data-aos]').forEach(el => obs.observe(el));
}

/* ===== CONTACT FORM ===== */
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const orig = btn.innerHTML;
        btn.innerHTML = '<span>Sending...</span><i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = '<span>Message Sent!</span><i class="fas fa-check"></i>';
            setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; form.reset(); }, 2500);
        }, 1500);
    });
}

/* ===== LIGHTBOX ===== */
function initLightbox() {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    const cls = document.getElementById('lightboxClose');
    if (!lb) return;

    document.querySelectorAll('.cert-overlay').forEach((el, i) => {
        el.addEventListener('click', () => {
            const src = el.previousElementSibling?.src;
            if (src) { img.src = src; lb.classList.add('open'); }
        });
    });

    cls?.addEventListener('click', () => lb.classList.remove('open'));
    lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
}

/* ===== RESIZE ===== */
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (renderer && camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }, 150);
}, { passive: true });

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavbar();
    initThree();
    initCursor();
    initParticles();
    initTypewriter();
    initScrollAnimations();
    initContactForm();
    initLightbox();
});
