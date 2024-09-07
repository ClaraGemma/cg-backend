import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./multerConfig.js";
import { PrismaClient } from "@prisma/client";

const upload = multer({ storage: storage });
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use("/uploads", express.static("uploads"));

const JWT_SECRET = "j/1~oe9zH>t]0rzq{XTFJ'K(EjxDZ7";

// ENDPOINT LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.admin.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });

  res.status(200).json({ token });
});

// ENDPOINT POSTAGEM
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
  res.status(200).json({ message: "Deletado com sucesso!" });
});

// ENDPOINT PRODUTO
app.post("/products", upload.single("file"), async (req, res) => {
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const newProduct = await prisma.product.create({
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image_url: imagePath,
      price: parseFloat(req.body.price),
      date_time: new Date(req.body.date_time),
    },
  });

  res.status(201).json(newProduct);
});

app.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({
    include: {
      reviews: true,
      comments: true,
    },
  });
  res.status(200).json(products);
});

app.put("/products/:id", async (req, res) => {
  const updatedProduct = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image_url: req.body.image_url,
      price: parseFloat(req.body.price),
      date_time: new Date(req.body.date_time),
    },
  });

  res.status(201).json(updatedProduct);
});

app.delete("/products/:id", async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Produto deletado com sucesso!" });
});

// ENDPOINT AVALIAÇÃO
app.post("/products/:id/reviews", async (req, res) => {
  const { rating } = req.body;

  const newReview = await prisma.review.create({
    data: {
      rating: parseInt(rating),
      productId: req.params.id,
    },
  });

  res.status(201).json(newReview);
});

app.get("/products/:id/reviews", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.id },
  });

  res.status(200).json(reviews);
});

// ENDPOINT COMENTÁRIOS
app.post("/products/:id/comments", async (req, res) => {
  const { text } = req.body;

  const newComment = await prisma.comment.create({
    data: {
      text,
      productId: req.params.id,
    },
  });

  res.status(201).json(newComment);
});

app.get("/products/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { productId: req.params.id },
  });

  res.status(200).json(comments);
});

// ENDPOINT PESQUISAR PRODUTOS
app.get("/products/search", async (req, res) => {
  const { query } = req.query;

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { desc: { contains: query, mode: "insensitive" } },
      ],
    },
  });

  res.status(200).json(products);
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
