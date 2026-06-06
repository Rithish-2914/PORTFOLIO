/* ===== COURSES PAGE ===== */

let allCourses = [];
let currentFilter = 'all';

async function loadCourses() {
    const grid = document.getElementById('coursesGrid');
    try {
        const res = await fetch('/courses.json');
        allCourses = await res.json();
        renderCourses(allCourses);
    } catch (err) {
        if (grid) grid.innerHTML = '<div class="courses-loading"><i class="fas fa-exclamation-circle"></i><p>Failed to load courses.</p></div>';
    }
}

function renderCourses(courses) {
    const grid = document.getElementById('coursesGrid');
    const noMsg = document.getElementById('noCoursesMsg');
    if (!grid) return;

    if (!courses || courses.length === 0) {
        grid.style.display = 'none';
        if (noMsg) noMsg.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    if (noMsg) noMsg.style.display = 'none';

    grid.innerHTML = courses.map(course => `
        <div class="course-card" data-type="${course.type}" onclick="openCourse('${course.id}')">
            <div class="course-thumb">
                ${course.thumbnail
                    ? `<img src="${course.thumbnail}" alt="${escapeHtml(course.title)}" loading="lazy">`
                    : `<div class="course-thumb-placeholder"><i class="fas fa-graduation-cap"></i></div>`
                }
                <span class="course-type-badge badge-${course.type}">
                    ${course.type === 'free' ? 'Free' : 'Paid'}
                </span>
                <div class="course-play-overlay">
                    <div class="play-circle"><i class="fas fa-play"></i></div>
                </div>
            </div>
            <div class="course-body">
                <p class="course-category">${escapeHtml(course.category || 'General')}</p>
                <h3 class="course-title">${escapeHtml(course.title)}</h3>
                <p class="course-desc">${escapeHtml(course.description || '')}</p>
                <div class="course-meta">
                    <span class="course-videos-count">
                        <i class="fas fa-play-circle"></i>
                        ${(course.videos || []).length} video${(course.videos || []).length !== 1 ? 's' : ''}
                    </span>
                    <span class="course-price ${course.type === 'free' ? 'price-free' : 'price-paid'}">
                        ${course.type === 'free' ? 'Free' : '₹' + (course.price || 0)}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

function filterCourses(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === type);
    });
    const filtered = type === 'all' ? allCourses : allCourses.filter(c => c.type === type);
    renderCourses(filtered);
}

function openCourse(id) {
    const course = allCourses.find(c => c.id === id);
    if (!course) return;

    const modal = document.getElementById('courseModal');
    const content = document.getElementById('cmContent');
    if (!modal || !content) return;

    content.innerHTML = renderCourseDetail(course);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Open first video by default
    const firstVideo = course.videos && course.videos[0];
    if (firstVideo) toggleVideo(firstVideo.id);
}

function renderCourseDetail(course) {
    const videos = course.videos || [];
    return `
        <div class="cd-thumb">
            ${course.thumbnail
                ? `<img src="${course.thumbnail}" alt="${escapeHtml(course.title)}">`
                : `<div class="cd-thumb-placeholder"><i class="fas fa-graduation-cap"></i></div>`
            }
        </div>
        <div class="cd-meta-row">
            <span class="course-type-badge badge-${course.type}">${course.type === 'free' ? 'Free' : 'Paid'}</span>
            <span class="course-category">${escapeHtml(course.category || 'General')}</span>
        </div>
        <h2 class="cd-title">${escapeHtml(course.title)}</h2>
        <p class="cd-desc">${escapeHtml(course.description || '')}</p>

        ${course.notesUrl ? `
            <a href="${course.notesUrl}" target="_blank" rel="noopener" class="notes-btn">
                <i class="fab fa-google-drive"></i> Access Course Notes & Files
            </a>
        ` : ''}

        <div class="cd-videos-header">
            <i class="fas fa-play-circle"></i>
            ${videos.length} Video${videos.length !== 1 ? 's' : ''}
        </div>

        ${videos.length === 0
            ? `<div class="cd-no-videos"><i class="fas fa-video-slash"></i><p>No videos yet in this course.</p></div>`
            : videos.map((v, i) => `
                <div class="video-item" data-id="${v.id}" data-embed="${escapeHtml(v.embedUrl || '')}">
                    <div class="video-item-header" onclick="toggleVideo('${v.id}')">
                        <div class="vi-number">${i + 1}</div>
                        <div class="vi-info">
                            <div class="vi-title">${escapeHtml(v.title)}</div>
                            ${v.description ? `<div class="vi-desc">${escapeHtml(v.description)}</div>` : ''}
                        </div>
                        <div class="vi-play-btn"><i class="fas fa-play"></i></div>
                    </div>
                    <div class="video-player-wrap">
                        <div class="gdrive-player" id="player-${v.id}"></div>
                    </div>
                </div>
            `).join('')
        }
    `;
}

function toggleVideo(id) {
    const item = document.querySelector(`.video-item[data-id="${id}"]`);
    if (!item) return;
    const isActive = item.classList.contains('active');

    // Close all open videos (clear iframe to stop playback)
    document.querySelectorAll('.video-item.active').forEach(el => {
        el.classList.remove('active');
        const player = el.querySelector('.gdrive-player');
        if (player) player.innerHTML = '';
    });

    if (!isActive) {
        item.classList.add('active');
        const embedUrl = item.dataset.embed;
        const player = item.querySelector('.gdrive-player');
        if (player && embedUrl) {
            player.innerHTML = `<iframe
                src="${embedUrl}"
                allow="autoplay; encrypted-media"
                allowfullscreen
                frameborder="0"
                style="width:100%;aspect-ratio:16/9;border-radius:8px;display:block;"
            ></iframe>`;
        }
    }
}

function closeCourseModal() {
    const modal = document.getElementById('courseModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    // Clear all iframes to stop playback
    document.querySelectorAll('.gdrive-player').forEach(p => p.innerHTML = '');
    document.querySelectorAll('.video-item').forEach(el => el.classList.remove('active'));
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadCourses();

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterCourses(btn.dataset.filter));
    });

    const cmClose = document.getElementById('cmClose');
    const cmBackdrop = document.getElementById('cmBackdrop');
    if (cmClose) cmClose.addEventListener('click', closeCourseModal);
    if (cmBackdrop) cmBackdrop.addEventListener('click', closeCourseModal);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCourseModal();
    });
});
