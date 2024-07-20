import express from "express";
import cors from "cors";
import multer from "multer";
import { storage } from "./multerConfig.js";
import { PrismaClient } from "@prisma/client";

const upload = multer({ storage: storage });
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use("/uploads", express.static("uploads"));

app.post("/posts", upload.single("file"), async (req, res) => {
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const newPost = await prisma.post.create({
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image_url: imagePath,
      date_time: new Date(req.body.date_time),
    },
  });

  res.status(201).json(newPost);
});

app.get("/posts", async (req, res) => {
  const posts = await prisma.post.findMany();
  res.status(200).json(posts);
});

app.put("/posts/:id", async (req, res) => {
  const updatedPost = await prisma.post.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image_url: req.body.image_url,
      date_time: new Date(req.body.date_time),
    },
  });

  res.status(201).json(updatedPost);
});

app.delete("/posts/:id", async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Usuário deletado com sucesso!" });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
