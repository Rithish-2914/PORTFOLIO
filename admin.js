/* ===== ADMIN PANEL ===== */

let currentCourseId = null;
let thumbnailFile = null;
let videoFile = null;
let attachFiles = [];

/* ===== LOGIN ===== */
async function checkAuth() {
    try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        if (data.isAdmin) showDashboard();
    } catch (e) {}
}

function showDashboard() {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    loadCourses();
}

document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    const err = document.getElementById('loginError');
    const btn = e.target.querySelector('button[type="submit"]');

    btn.innerHTML = '<span>Logging in...</span><i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    if (err) err.textContent = '';

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
            showDashboard();
        } else {
            if (err) err.textContent = 'Invalid password. Please try again.';
            btn.innerHTML = '<span>Login</span><i class="fas fa-sign-in-alt"></i>';
            btn.disabled = false;
        }
    } catch (e) {
        if (err) err.textContent = 'Connection error. Is the server running?';
        btn.innerHTML = '<span>Login</span><i class="fas fa-sign-in-alt"></i>';
        btn.disabled = false;
    }
});

document.getElementById('togglePwd')?.addEventListener('click', () => {
    const inp = document.getElementById('adminPassword');
    const icon = document.querySelector('#togglePwd i');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
});

/* ===== PANEL SWITCHING ===== */
function switchPanel(name) {
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.anav-btn').forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('panel-' + name);
    if (panel) panel.classList.add('active');
    const navBtn = document.querySelector(`.anav-btn[data-panel="${name}"]`);
    if (navBtn) navBtn.classList.add('active');
}

document.querySelectorAll('.anav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
});

/* ===== LOAD COURSES ===== */
async function loadCourses() {
    const list = document.getElementById('adminCoursesList');
    if (!list) return;
    list.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const res = await fetch('/api/courses');
        const courses = await res.json();
        if (courses.length === 0) {
            list.innerHTML = '<div class="loading-state">No courses yet. <button class="btn btn-primary btn-sm" onclick="switchPanel(\'add-course\')">Create your first course</button></div>';
            return;
        }
        list.innerHTML = courses.map(c => `
            <div class="admin-course-item">
                <div class="aci-thumb">
                    ${c.thumbnail ? `<img src="${c.thumbnail}" alt="">` : '<div class="aci-thumb-placeholder"><i class="fas fa-graduation-cap"></i></div>'}
                </div>
                <div class="aci-info">
                    <div class="aci-title">${escapeHtml(c.title)}</div>
                    <div class="aci-meta">
                        <span class="aci-badge badge-${c.type}">${c.type === 'free' ? 'Free' : '₹' + c.price}</span>
                        <span>${c.videoCount || 0} videos</span>
                        <span>${c.category || 'General'}</span>
                    </div>
                </div>
                <div class="aci-actions">
                    <button class="aci-btn" title="Manage videos" onclick="openManageCourse('${c.id}', '${escapeHtml(c.title)}')">
                        <i class="fas fa-film"></i>
                    </button>
                    <button class="aci-btn" title="Edit course" onclick="editCourse('${c.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="aci-btn danger" title="Delete course" onclick="deleteCourse('${c.id}', '${escapeHtml(c.title)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<div class="loading-state">Failed to load courses.</div>';
    }
}

/* ===== CREATE/EDIT COURSE ===== */
document.getElementById('courseType')?.addEventListener('change', function() {
    const priceGroup = document.getElementById('priceGroup');
    if (priceGroup) priceGroup.style.display = this.value === 'paid' ? 'block' : 'none';
});

// Thumbnail drop zone
setupFileDrop('thumbnailDropZone', 'courseThumbnail', (files) => {
    thumbnailFile = files[0];
    const preview = document.getElementById('thumbPreview');
    const img = document.getElementById('thumbImg');
    if (preview && img) {
        img.src = URL.createObjectURL(thumbnailFile);
        preview.style.display = 'block';
    }
});

document.getElementById('removeThumb')?.addEventListener('click', () => {
    thumbnailFile = null;
    const preview = document.getElementById('thumbPreview');
    if (preview) preview.style.display = 'none';
    const input = document.getElementById('courseThumbnail');
    if (input) input.value = '';
});

document.getElementById('courseForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('editCourseId').value;
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.querySelector('span').textContent;

    btn.disabled = true;
    btn.querySelector('span').textContent = editId ? 'Saving...' : 'Creating...';

    const fd = new FormData();
    fd.append('title', document.getElementById('courseTitle').value);
    fd.append('description', document.getElementById('courseDesc').value);
    fd.append('type', document.getElementById('courseType').value);
    fd.append('price', document.getElementById('coursePrice').value || '0');
    fd.append('category', document.getElementById('courseCategory').value || 'General');
    if (thumbnailFile) fd.append('thumbnail', thumbnailFile);

    try {
        const url = editId ? '/api/admin/courses/' + editId : '/api/admin/courses';
        const method = editId ? 'PUT' : 'POST';
        const res = await fetch(url, { method, body: fd });
        if (res.ok) {
            showToast(editId ? 'Course updated!' : 'Course created!', 'success');
            resetCourseForm();
            loadCourses();
            switchPanel('courses');
        } else {
            showToast('Error saving course.', 'error');
        }
    } catch (err) {
        showToast('Network error.', 'error');
    }
    btn.disabled = false;
    btn.querySelector('span').textContent = origText;
});

function resetCourseForm() {
    document.getElementById('courseForm')?.reset();
    document.getElementById('editCourseId').value = '';
    document.getElementById('courseFormTitle').textContent = 'Create New Course';
    document.getElementById('courseSubmitText').textContent = 'Create Course';
    thumbnailFile = null;
    const preview = document.getElementById('thumbPreview');
    if (preview) preview.style.display = 'none';
}

async function editCourse(id) {
    try {
        const res = await fetch('/api/courses/' + id);
        const course = await res.json();
        document.getElementById('editCourseId').value = id;
        document.getElementById('courseTitle').value = course.title || '';
        document.getElementById('courseDesc').value = course.description || '';
        document.getElementById('courseType').value = course.type || 'free';
        document.getElementById('coursePrice').value = course.price || '';
        document.getElementById('courseCategory').value = course.category || '';
        document.getElementById('courseFormTitle').textContent = 'Edit Course';
        document.getElementById('courseSubmitText').textContent = 'Save Changes';
        const priceGroup = document.getElementById('priceGroup');
        if (priceGroup) priceGroup.style.display = course.type === 'paid' ? 'block' : 'none';
        switchPanel('add-course');
    } catch (err) {
        showToast('Failed to load course.', 'error');
    }
}

async function deleteCourse(id, title) {
    if (!confirm(`Delete course "${title}"? This cannot be undone.`)) return;
    try {
        const res = await fetch('/api/admin/courses/' + id, { method: 'DELETE' });
        if (res.ok) { showToast('Course deleted.', 'success'); loadCourses(); }
        else showToast('Failed to delete.', 'error');
    } catch (err) { showToast('Network error.', 'error'); }
}

/* ===== MANAGE VIDEOS ===== */
async function openManageCourse(id, title) {
    currentCourseId = id;
    document.getElementById('manageCourseTitle').textContent = title;
    document.getElementById('addVideoForm').style.display = 'none';
    switchPanel('manage-course');
    loadVideos();
}

async function loadVideos() {
    const list = document.getElementById('videosList');
    if (!list || !currentCourseId) return;
    list.innerHTML = '<p class="empty-msg"><i class="fas fa-spinner fa-spin"></i></p>';
    try {
        const res = await fetch('/api/courses/' + currentCourseId);
        const course = await res.json();
        const videos = course.videos || [];
        if (videos.length === 0) {
            list.innerHTML = '<p class="empty-msg">No videos yet. Add your first video!</p>';
            return;
        }
        list.innerHTML = videos.map(v => `
            <div class="admin-video-row">
                <div class="avr-order">${v.order}</div>
                <div class="avr-info">
                    <div class="avr-title">${escapeHtml(v.title)}</div>
                    <div class="avr-meta">
                        ${v.attachments?.length || 0} attachment${(v.attachments?.length || 0) !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="avr-actions">
                    <button class="aci-btn danger" title="Delete video" onclick="deleteVideo('${v.id}', '${escapeHtml(v.title)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p class="empty-msg">Failed to load videos.</p>';
    }
}

document.getElementById('addVideoBtn')?.addEventListener('click', () => {
    document.getElementById('addVideoForm').style.display = 'block';
    document.getElementById('addVideoForm').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('cancelAddVideo')?.addEventListener('click', () => {
    document.getElementById('addVideoForm').style.display = 'none';
});
document.getElementById('cancelVideoBtn')?.addEventListener('click', () => {
    document.getElementById('addVideoForm').style.display = 'none';
});

// Video file drop
setupFileDrop('videoDropZone', 'videoFile', (files) => {
    videoFile = files[0];
    const nameEl = document.getElementById('videoFileName');
    if (nameEl) nameEl.textContent = videoFile.name + ' (' + formatSize(videoFile.size) + ')';
});

// Attachment drop
setupFileDrop('attachDropZone', 'attachFiles', (files) => {
    attachFiles = Array.from(files);
    renderAttachPreviews();
}, true);

function renderAttachPreviews() {
    const list = document.getElementById('attachPreviewList');
    if (!list) return;
    list.innerHTML = attachFiles.map((f, i) => `
        <div class="attach-preview-item">
            <i class="fas fa-file"></i>
            <span>${escapeHtml(f.name)}</span>
            <span style="color:var(--text-secondary);font-size:0.78rem;margin-left:auto">${formatSize(f.size)}</span>
        </div>
    `).join('');
}

document.getElementById('videoForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!videoFile) { showToast('Please select a video file.', 'error'); return; }
    if (!currentCourseId) { showToast('No course selected.', 'error'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    const progress = document.getElementById('uploadProgress');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');

    btn.disabled = true;
    if (progress) progress.style.display = 'block';

    // Upload video first
    const vfd = new FormData();
    vfd.append('title', document.getElementById('videoTitle').value);
    vfd.append('description', document.getElementById('videoDesc').value);
    vfd.append('order', document.getElementById('videoOrder').value || '1');
    vfd.append('video', videoFile);

    try {
        if (text) text.textContent = 'Uploading video...';
        if (fill) fill.style.width = '30%';

        const vres = await fetch('/api/admin/courses/' + currentCourseId + '/videos', {
            method: 'POST', body: vfd
        });
        if (!vres.ok) throw new Error('Video upload failed');
        const video = await vres.json();

        if (fill) fill.style.width = '60%';

        // Upload attachments if any
        if (attachFiles.length > 0) {
            if (text) text.textContent = 'Uploading attachments...';
            const afd = new FormData();
            attachFiles.forEach(f => afd.append('files', f));
            await fetch('/api/admin/courses/' + currentCourseId + '/videos/' + video.id + '/attachments', {
                method: 'POST', body: afd
            });
        }

        if (fill) fill.style.width = '100%';
        if (text) text.textContent = 'Done!';

        setTimeout(() => {
            showToast('Video uploaded successfully!', 'success');
            document.getElementById('videoForm').reset();
            videoFile = null;
            attachFiles = [];
            const nameEl = document.getElementById('videoFileName');
            if (nameEl) nameEl.textContent = 'MP4, MOV, AVI up to 2GB';
            renderAttachPreviews();
            if (progress) progress.style.display = 'none';
            if (fill) fill.style.width = '0%';
            document.getElementById('addVideoForm').style.display = 'none';
            loadVideos();
        }, 600);
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
        if (progress) progress.style.display = 'none';
        if (fill) fill.style.width = '0%';
    }
    btn.disabled = false;
});

async function deleteVideo(videoId, title) {
    if (!confirm(`Delete video "${title}"?`)) return;
    try {
        const res = await fetch(`/api/admin/courses/${currentCourseId}/videos/${videoId}`, { method: 'DELETE' });
        if (res.ok) { showToast('Video deleted.', 'success'); loadVideos(); }
        else showToast('Failed to delete.', 'error');
    } catch (err) { showToast('Network error.', 'error'); }
}

/* ===== UTILITIES ===== */
function setupFileDrop(zoneId, inputId, callback, multiple = false) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) callback(files);
    });

    input.multiple = multiple;
    input.addEventListener('change', () => {
        if (input.files.length) callback(input.files);
    });
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => { t.className = 'toast ' + type; }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
