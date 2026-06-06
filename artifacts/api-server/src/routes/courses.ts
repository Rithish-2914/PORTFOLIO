import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../../");

const dataFile = path.join(serverRoot, "data", "courses.json");

function readData(): { courses: Course[] } {
  if (!fs.existsSync(dataFile)) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify({ courses: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeData(data: { courses: Course[] }) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

interface Attachment {
  id: string;
  name: string;
  path: string;
  size: number;
  mimetype: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  videoFile: string;
  videoFilename: string;
  order: number;
  attachments: Attachment[];
  createdAt: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  type: string;
  price: number;
  category: string;
  videos: Video[];
  createdAt: string;
}

const thumbnailStorage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(serverRoot, "uploads/thumbnails")),
  filename: (_req, file, cb) =>
    cb(null, generateId() + path.extname(file.originalname)),
});

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(serverRoot, "uploads/videos")),
  filename: (_req, file, cb) =>
    cb(null, generateId() + path.extname(file.originalname)),
});

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(serverRoot, "uploads/files")),
  filename: (_req, file, cb) =>
    cb(null, generateId() + "_" + file.originalname),
});

const uploadThumbnail = multer({
  storage: thumbnailStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});
const uploadFiles = multer({
  storage: fileStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  // @ts-ignore
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

const router = Router();

router.post("/admin/login", (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }
  if (password === ADMIN_PASSWORD) {
    // @ts-ignore
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

router.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ success: true });
});

router.get("/admin/check", (req, res) => {
  // @ts-ignore
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

router.get("/courses", (_req, res) => {
  const data = readData();
  res.json(
    data.courses.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      type: c.type,
      price: c.price,
      category: c.category,
      videoCount: (c.videos || []).length,
      createdAt: c.createdAt,
    })),
  );
});

router.get("/courses/:id", (req, res) => {
  const data = readData();
  const course = data.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found" });
  res.json(course);
});

router.post(
  "/admin/courses",
  requireAdmin,
  uploadThumbnail.single("thumbnail"),
  (req, res) => {
    const { title, description, type, price, category } = req.body;
    const data = readData();
    const course: Course = {
      id: generateId(),
      title,
      description,
      thumbnail: req.file ? "/api/uploads/thumbnails/" + req.file.filename : null,
      type: type || "free",
      price: parseFloat(price) || 0,
      category: category || "General",
      videos: [],
      createdAt: new Date().toISOString(),
    };
    data.courses.push(course);
    writeData(data);
    res.json(course);
  },
);

router.put(
  "/admin/courses/:id",
  requireAdmin,
  uploadThumbnail.single("thumbnail"),
  (req, res) => {
    const { title, description, type, price, category } = req.body;
    const data = readData();
    const idx = data.courses.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Course not found" });
    data.courses[idx] = {
      ...data.courses[idx],
      title: title || data.courses[idx].title,
      description: description || data.courses[idx].description,
      thumbnail: req.file
        ? "/api/uploads/thumbnails/" + req.file.filename
        : data.courses[idx].thumbnail,
      type: type || data.courses[idx].type,
      price:
        price !== undefined ? parseFloat(price) : data.courses[idx].price,
      category: category || data.courses[idx].category,
    };
    writeData(data);
    res.json(data.courses[idx]);
  },
);

router.delete("/admin/courses/:id", requireAdmin, (req, res) => {
  const data = readData();
  data.courses = data.courses.filter((c) => c.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

router.post(
  "/admin/courses/:id/videos",
  requireAdmin,
  uploadVideo.single("video"),
  (req, res) => {
    const { title, description, order } = req.body;
    const data = readData();
    const course = data.courses.find((c) => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    if (!req.file) return res.status(400).json({ error: "No video file uploaded" });
    const video: Video = {
      id: generateId(),
      title,
      description: description || "",
      videoFile: "/api/uploads/videos/" + req.file.filename,
      videoFilename: req.file.originalname,
      order: parseInt(order) || course.videos.length + 1,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    course.videos.push(video);
    course.videos.sort((a, b) => a.order - b.order);
    writeData(data);
    res.json(video);
  },
);

router.delete(
  "/admin/courses/:courseId/videos/:videoId",
  requireAdmin,
  (req, res) => {
    const data = readData();
    const course = data.courses.find((c) => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });
    course.videos = course.videos.filter((v) => v.id !== req.params.videoId);
    writeData(data);
    res.json({ success: true });
  },
);

router.post(
  "/admin/courses/:courseId/videos/:videoId/attachments",
  requireAdmin,
  uploadFiles.array("files", 20),
  (req, res) => {
    const data = readData();
    const course = data.courses.find((c) => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });
    const video = course.videos.find((v) => v.id === req.params.videoId);
    if (!video) return res.status(404).json({ error: "Video not found" });
    const files = req.files as Express.Multer.File[];
    const added = (files || []).map((f) => ({
      id: generateId(),
      name: f.originalname,
      path: "/api/uploads/files/" + f.filename,
      size: f.size,
      mimetype: f.mimetype,
    }));
    video.attachments.push(...added);
    writeData(data);
    res.json(added);
  },
);

router.delete(
  "/admin/courses/:courseId/videos/:videoId/attachments/:attachId",
  requireAdmin,
  (req, res) => {
    const data = readData();
    const course = data.courses.find((c) => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });
    const video = course.videos.find((v) => v.id === req.params.videoId);
    if (!video) return res.status(404).json({ error: "Video not found" });
    const att = video.attachments.find((a) => a.id === req.params.attachId);
    if (att) {
      const diskPath = path.join(serverRoot, att.path.replace("/api/", ""));
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    }
    video.attachments = video.attachments.filter(
      (a) => a.id !== req.params.attachId,
    );
    writeData(data);
    res.json({ success: true });
  },
);

export default router;
