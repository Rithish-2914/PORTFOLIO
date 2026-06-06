const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rithish@admin';

const dataFile = path.join(__dirname, 'data', 'courses.json');
function readData() {
    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(dataFile, JSON.stringify({ courses: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}
function writeData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const thumbnailStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/thumbnails'),
    filename: (req, file, cb) => cb(null, generateId() + path.extname(file.originalname))
});
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/videos'),
    filename: (req, file, cb) => cb(null, generateId() + path.extname(file.originalname))
});
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/files'),
    filename: (req, file, cb) => cb(null, generateId() + '_' + file.originalname)
});

const uploadThumbnail = multer({ storage: thumbnailStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } });
const uploadFiles = multer({ storage: fileStorage, limits: { fileSize: 100 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'portfolio_secret_key_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

app.get('/api/courses', (req, res) => {
    const data = readData();
    res.json(data.courses.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        type: c.type,
        price: c.price,
        category: c.category,
        videoCount: (c.videos || []).length,
        createdAt: c.createdAt
    })));
});

app.get('/api/courses/:id', (req, res) => {
    const data = readData();
    const course = data.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
});

app.post('/api/admin/courses', requireAdmin, uploadThumbnail.single('thumbnail'), (req, res) => {
    const { title, description, type, price, category } = req.body;
    const data = readData();
    const course = {
        id: generateId(),
        title,
        description,
        thumbnail: req.file ? '/uploads/thumbnails/' + req.file.filename : null,
        type: type || 'free',
        price: parseFloat(price) || 0,
        category: category || 'General',
        videos: [],
        createdAt: new Date().toISOString()
    };
    data.courses.push(course);
    writeData(data);
    res.json(course);
});

app.put('/api/admin/courses/:id', requireAdmin, uploadThumbnail.single('thumbnail'), (req, res) => {
    const { title, description, type, price, category } = req.body;
    const data = readData();
    const idx = data.courses.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Course not found' });
    data.courses[idx] = {
        ...data.courses[idx],
        title: title || data.courses[idx].title,
        description: description || data.courses[idx].description,
        thumbnail: req.file ? '/uploads/thumbnails/' + req.file.filename : data.courses[idx].thumbnail,
        type: type || data.courses[idx].type,
        price: price !== undefined ? parseFloat(price) : data.courses[idx].price,
        category: category || data.courses[idx].category
    };
    writeData(data);
    res.json(data.courses[idx]);
});

app.delete('/api/admin/courses/:id', requireAdmin, (req, res) => {
    const data = readData();
    data.courses = data.courses.filter(c => c.id !== req.params.id);
    writeData(data);
    res.json({ success: true });
});

app.post('/api/admin/courses/:id/videos', requireAdmin, uploadVideo.single('video'), (req, res) => {
    const { title, description, order } = req.body;
    const data = readData();
    const course = data.courses.find(c => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });
    const video = {
        id: generateId(),
        title,
        description: description || '',
        videoFile: '/uploads/videos/' + req.file.filename,
        videoFilename: req.file.originalname,
        order: parseInt(order) || course.videos.length + 1,
        attachments: [],
        createdAt: new Date().toISOString()
    };
    course.videos.push(video);
    course.videos.sort((a, b) => a.order - b.order);
    writeData(data);
    res.json(video);
});

app.delete('/api/admin/courses/:courseId/videos/:videoId', requireAdmin, (req, res) => {
    const data = readData();
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    course.videos = course.videos.filter(v => v.id !== req.params.videoId);
    writeData(data);
    res.json({ success: true });
});

app.post('/api/admin/courses/:courseId/videos/:videoId/attachments', requireAdmin,
    uploadFiles.array('files', 20), (req, res) => {
    const data = readData();
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const video = course.videos.find(v => v.id === req.params.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    const added = (req.files || []).map(f => ({
        id: generateId(),
        name: f.originalname,
        path: '/uploads/files/' + f.filename,
        size: f.size,
        mimetype: f.mimetype
    }));
    video.attachments.push(...added);
    writeData(data);
    res.json(added);
});

app.delete('/api/admin/courses/:courseId/videos/:videoId/attachments/:attachId', requireAdmin, (req, res) => {
    const data = readData();
    const course = data.courses.find(c => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const video = course.videos.find(v => v.id === req.params.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    const att = video.attachments.find(a => a.id === req.params.attachId);
    if (att) {
        const diskPath = path.join(__dirname, att.path);
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    }
    video.attachments = video.attachments.filter(a => a.id !== req.params.attachId);
    writeData(data);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Admin panel: http://0.0.0.0:${PORT}/admin.html`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);
});
