import { kv } from "@vercel/kv";
import { put, del as blobDel } from "@vercel/blob";
import Busboy from "busboy";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim().split("="))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, v.join("=")])
  );
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    const fields = {};
    const fileBlobMap = {};

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("file", (name, stream, info) => {
      const safeName = `${genId()}-${info.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const uploadPromise = put(safeName, stream, {
        access: "public",
        contentType: info.mimeType,
      });
      if (!fileBlobMap[name]) fileBlobMap[name] = [];
      fileBlobMap[name].push(uploadPromise);
    });

    bb.on("close", async () => {
      const files = {};
      for (const [name, promises] of Object.entries(fileBlobMap)) {
        const resolved = await Promise.all(promises);
        files[name] = resolved.length === 1 ? resolved[0] : resolved;
      }
      resolve({ fields, files });
    });

    bb.on("error", reject);
    req.pipe(bb);
  });
}

async function isAdmin(req) {
  const { admin_token } = parseCookies(req);
  if (!admin_token) return false;
  return !!(await kv.get(`admin:${admin_token}`));
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  const method = req.method;
  const rawPath = new URL(req.url, "http://x").pathname;
  const path = rawPath.replace(/^\/api/, "") || "/";

  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (method === "OPTIONS") return res.status(200).end();

  // ── Health ───────────────────────────────────────────────────────────────
  if (path === "/healthz") return res.json({ status: "ok" });

  // ── Admin login ──────────────────────────────────────────────────────────
  if (path === "/admin/login" && method === "POST") {
    const { password } = await parseJson(req);
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "rithish@admin";
    if (password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(32).toString("hex");
      await kv.set(`admin:${token}`, 1, { ex: 86400 });
      setCookie(res, "admin_token", token, { maxAge: 86400 });
      return res.json({ success: true });
    }
    return res.status(401).json({ error: "Invalid password" });
  }

  // ── Admin logout ─────────────────────────────────────────────────────────
  if (path === "/admin/logout" && method === "POST") {
    const { admin_token } = parseCookies(req);
    if (admin_token) await kv.del(`admin:${admin_token}`);
    setCookie(res, "admin_token", "", { maxAge: 0 });
    return res.json({ success: true });
  }

  // ── Admin check ──────────────────────────────────────────────────────────
  if (path === "/admin/check" && method === "GET") {
    return res.json({ isAdmin: await isAdmin(req) });
  }

  // ── GET /courses ─────────────────────────────────────────────────────────
  if (path === "/courses" && method === "GET") {
    const ids = (await kv.lrange("courses", 0, -1)) || [];
    const courses = (
      await Promise.all(ids.map((id) => kv.get(`course:${id}`)))
    ).filter(Boolean);
    return res.json(
      courses.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        type: c.type,
        price: c.price,
        category: c.category,
        videoCount: (c.videos || []).length,
        createdAt: c.createdAt,
      }))
    );
  }

  // ── GET /courses/:id ─────────────────────────────────────────────────────
  const courseIdMatch = path.match(/^\/courses\/([^/]+)$/);
  if (courseIdMatch && method === "GET") {
    const course = await kv.get(`course:${courseIdMatch[1]}`);
    if (!course) return res.status(404).json({ error: "Course not found" });
    return res.json(course);
  }

  // All routes below require admin
  const admin = await isAdmin(req);

  // ── POST /admin/courses ──────────────────────────────────────────────────
  if (path === "/admin/courses" && method === "POST") {
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const ct = req.headers["content-type"] || "";
    let title, description, type, price, category;
    let thumbnail = null;

    if (ct.includes("multipart")) {
      const { fields, files } = await parseMultipart(req);
      ({ title, description, type, price, category } = fields);
      if (files.thumbnail) thumbnail = files.thumbnail.url;
    } else {
      ({ title, description, type, price, category } = await parseJson(req));
    }

    const course = {
      id: genId(),
      title,
      description,
      thumbnail,
      type: type || "free",
      price: parseFloat(price) || 0,
      category: category || "General",
      videos: [],
      createdAt: new Date().toISOString(),
    };
    await kv.rpush("courses", course.id);
    await kv.set(`course:${course.id}`, course);
    return res.json(course);
  }

  // ── PUT / DELETE /admin/courses/:id ──────────────────────────────────────
  const adminCourseMatch = path.match(/^\/admin\/courses\/([^/]+)$/);
  if (adminCourseMatch) {
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const course = await kv.get(`course:${adminCourseMatch[1]}`);
    if (!course) return res.status(404).json({ error: "Course not found" });

    if (method === "PUT") {
      const ct = req.headers["content-type"] || "";
      let title, description, type, price, category;
      let thumbnail = course.thumbnail;

      if (ct.includes("multipart")) {
        const { fields, files } = await parseMultipart(req);
        ({ title, description, type, price, category } = fields);
        if (files.thumbnail) thumbnail = files.thumbnail.url;
      } else {
        ({ title, description, type, price, category } = await parseJson(req));
      }

      const updated = {
        ...course,
        title: title || course.title,
        description: description || course.description,
        thumbnail,
        type: type || course.type,
        price: price !== undefined ? parseFloat(price) : course.price,
        category: category || course.category,
      };
      await kv.set(`course:${course.id}`, updated);
      return res.json(updated);
    }

    if (method === "DELETE") {
      const ids = (await kv.lrange("courses", 0, -1)) || [];
      const newIds = ids.filter((id) => id !== adminCourseMatch[1]);
      await kv.del("courses");
      if (newIds.length) await kv.rpush("courses", ...newIds);
      await kv.del(`course:${adminCourseMatch[1]}`);
      return res.json({ success: true });
    }
  }

  // ── POST /admin/courses/:courseId/videos ─────────────────────────────────
  const videosMatch = path.match(/^\/admin\/courses\/([^/]+)\/videos$/);
  if (videosMatch && method === "POST") {
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const course = await kv.get(`course:${videosMatch[1]}`);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const ct = req.headers["content-type"] || "";
    let title, description, order;
    let videoFile = null, videoFilename = null;

    if (ct.includes("multipart")) {
      const { fields, files } = await parseMultipart(req);
      ({ title, description, order } = fields);
      if (files.video) {
        videoFile = files.video.url;
        videoFilename = files.video.pathname?.split("/").pop() || title;
      }
    } else {
      ({ title, description, order, videoFile, videoFilename } = await parseJson(req));
    }

    if (!videoFile) return res.status(400).json({ error: "No video provided" });

    const video = {
      id: genId(),
      title,
      description: description || "",
      videoFile,
      videoFilename: videoFilename || title,
      order: parseInt(order) || course.videos.length + 1,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    course.videos.push(video);
    course.videos.sort((a, b) => a.order - b.order);
    await kv.set(`course:${course.id}`, course);
    return res.json(video);
  }

  // ── DELETE /admin/courses/:courseId/videos/:videoId ───────────────────────
  const videoDeleteMatch = path.match(
    /^\/admin\/courses\/([^/]+)\/videos\/([^/]+)$/
  );
  if (videoDeleteMatch && method === "DELETE") {
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const course = await kv.get(`course:${videoDeleteMatch[1]}`);
    if (!course) return res.status(404).json({ error: "Course not found" });
    course.videos = course.videos.filter((v) => v.id !== videoDeleteMatch[2]);
    await kv.set(`course:${course.id}`, course);
    return res.json({ success: true });
  }

  // ── POST /admin/courses/:courseId/videos/:videoId/attachments ─────────────
  const attachMatch = path.match(
    /^\/admin\/courses\/([^/]+)\/videos\/([^/]+)\/attachments$/
  );
  if (attachMatch && method === "POST") {
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const course = await kv.get(`course:${attachMatch[1]}`);
    if (!course) return res.status(404).json({ error: "Course not found" });
    const video = course.videos.find((v) => v.id === attachMatch[2]);
    if (!video) return res.status(404).json({ error: "Video not found" });

    const { files } = await parseMultipart(req);
    const allFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];
    const added = allFiles.map((f) => ({
      id: genId(),
      name: f.pathname?.split("/").pop() || "file",
      path: f.url,
      size: 0,
      mimetype: f.contentType,
    }));
    video.attachments.push(...added);
    await kv.set(`course:${course.id}`, course);
    return res.json(added);
  }

  // ── DELETE /admin/courses/:courseId/videos/:videoId/attachments/:attachId ──
  const attachDeleteMatch = path.match(
    /^\/admin\/courses\/([^/]+)\/videos\/([^/]+)\/attachments\/([^/]+)$/
  );
  if (attachDeleteMatch && method === "DELETE") {
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const course = await kv.get(`course:${attachDeleteMatch[1]}`);
    if (!course) return res.status(404).json({ error: "Course not found" });
    const video = course.videos.find((v) => v.id === attachDeleteMatch[2]);
    if (!video) return res.status(404).json({ error: "Video not found" });
    const att = video.attachments.find((a) => a.id === attachDeleteMatch[3]);
    if (att) {
      try { await blobDel(att.path); } catch {}
    }
    video.attachments = video.attachments.filter(
      (a) => a.id !== attachDeleteMatch[3]
    );
    await kv.set(`course:${course.id}`, course);
    return res.json({ success: true });
  }

  return res.status(404).json({ error: "Not found" });
}
