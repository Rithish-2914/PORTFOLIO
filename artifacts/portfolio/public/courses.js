/* ===== COURSES PAGE ===== */

let allCourses = [];
let currentFilter = 'all';
let activeVideoId = null;

async function loadCourses() {
    const grid = document.getElementById('coursesGrid');
    const noMsg = document.getElementById('noCoursesMsg');
    try {
        const res = await fetch('/api/courses');
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
                        ${course.videoCount || 0} video${(course.videoCount || 0) !== 1 ? 's' : ''}
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

async function openCourse(id) {
    const modal = document.getElementById('courseModal');
    const content = document.getElementById('cmContent');
    if (!modal || !content) return;

    content.innerHTML = '<div style="text-align:center;padding:4rem 2rem;color:var(--text-secondary)"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary-color)"></i><p style="margin-top:1rem">Loading course...</p></div>';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    activeVideoId = null;

    try {
        const res = await fetch('/api/courses/' + id);
        const course = await res.json();
        content.innerHTML = renderCourseDetail(course);
        initVideoItems();
    } catch (err) {
        content.innerHTML = '<div style="text-align:center;padding:4rem;color:var(--text-secondary)"><i class="fas fa-exclamation-circle" style="font-size:2rem"></i><p style="margin-top:1rem">Failed to load course.</p></div>';
    }
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

        <div class="cd-videos-header">
            <i class="fas fa-play-circle"></i>
            ${videos.length} Video${videos.length !== 1 ? 's' : ''}
        </div>

        ${videos.length === 0
            ? `<div class="cd-no-videos"><i class="fas fa-video-slash"></i><p>No videos yet in this course.</p></div>`
            : videos.map((v, i) => `
                <div class="video-item" data-id="${v.id}">
                    <div class="video-item-header" onclick="toggleVideo('${v.id}')">
                        <div class="vi-number">${i + 1}</div>
                        <div class="vi-info">
                            <div class="vi-title">${escapeHtml(v.title)}</div>
                            ${v.description ? `<div class="vi-desc">${escapeHtml(v.description)}</div>` : ''}
                        </div>
                        <div class="vi-play-btn"><i class="fas fa-play"></i></div>
                    </div>
                    <div class="video-player-wrap">
                        <video controls preload="none" src="${v.videoFile}">
                            Your browser does not support video playback.
                        </video>
                        ${v.attachments && v.attachments.length > 0 ? `
                            <div class="video-attachments">
                                <div class="va-title"><i class="fas fa-paperclip"></i> Attachments</div>
                                <div class="attach-list">
                                    ${v.attachments.map(a => `
                                        <a href="${a.path}" download="${escapeHtml(a.name)}" class="attach-item">
                                            <i class="${getFileIcon(a.name)}"></i>
                                            <span class="attach-name">${escapeHtml(a.name)}</span>
                                            <span class="attach-size">${formatSize(a.size)}</span>
                                            <span class="attach-download"><i class="fas fa-download"></i></span>
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
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

    // Close all
    document.querySelectorAll('.video-item.active').forEach(el => {
        el.classList.remove('active');
        const v = el.querySelector('video');
        if (v) { v.pause(); }
    });

    if (!isActive) {
        item.classList.add('active');
        const v = item.querySelector('video');
        if (v) {
            v.load();
            setTimeout(() => v.play().catch(() => {}), 100);
        }
        activeVideoId = id;
    } else {
        activeVideoId = null;
    }
}

function initVideoItems() {
    // Open first video by default
    const first = document.querySelector('.video-item');
    if (first) {
        const id = first.dataset.id;
        if (id) toggleVideo(id);
    }
}

function closeCourseModal() {
    const modal = document.getElementById('courseModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    document.querySelectorAll('.video-item video').forEach(v => v.pause());
    activeVideoId = null;
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: 'fas fa-file-pdf',
        doc: 'fas fa-file-word', docx: 'fas fa-file-word',
        xls: 'fas fa-file-excel', xlsx: 'fas fa-file-excel',
        ppt: 'fas fa-file-powerpoint', pptx: 'fas fa-file-powerpoint',
        zip: 'fas fa-file-archive', rar: 'fas fa-file-archive', '7z': 'fas fa-file-archive',
        mp4: 'fas fa-file-video', mov: 'fas fa-file-video', avi: 'fas fa-file-video',
        jpg: 'fas fa-file-image', jpeg: 'fas fa-file-image', png: 'fas fa-file-image', gif: 'fas fa-file-image',
        mp3: 'fas fa-file-audio', wav: 'fas fa-file-audio',
        js: 'fas fa-file-code', ts: 'fas fa-file-code', html: 'fas fa-file-code', css: 'fas fa-file-code', py: 'fas fa-file-code',
        txt: 'fas fa-file-alt',
    };
    return icons[ext] || 'fas fa-file';
}

function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadCourses();

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterCourses(btn.dataset.filter));
    });

    // Modal close
    const cmClose = document.getElementById('cmClose');
    const cmBackdrop = document.getElementById('cmBackdrop');
    if (cmClose) cmClose.addEventListener('click', closeCourseModal);
    if (cmBackdrop) cmBackdrop.addEventListener('click', closeCourseModal);

    // ESC key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCourseModal();
    });
});
