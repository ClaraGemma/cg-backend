import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./multerConfig.js";
import { PrismaClient } from "@prisma/client";
import {
  verifyToken,
  isAdmin,
  isUser,
  hasPurchased,
} from "./middlewares/authMiddleware.js";

const upload = multer({ storage: storage });
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use("/uploads", express.static("uploads"));

const JWT_SECRET = "j/1~oe9zH>t]0rzq{XTFJ'K(EjxDZ7";

// ENDPOINT VERIFICAÇÃO ADMINISTRADOR
app.get("/api/check-admin", verifyToken, isAdmin, (req, res) => {
  res.status(200).json({ isAdmin: true });
});

// ENDPOINT REGISTRO
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(400).json({ message: "E-mail já cadastrado." });
  }

  // Criptografa a senha
  const hashedPassword = await bcrypt.hash(password, 10);

  // Cria o novo usuário no banco de dados
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  // Gera o token JWT
  const token = jwt.sign(
    {
      userId: newUser.id,
      role: "user",
      name: newUser.name,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.status(201).json({ message: "Usuário registrado com sucesso!", newUser });
});

// ENDPOINT LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  const user = await prisma.user.findUnique({
    where: { email },
  });

  const userType = admin ? "admin" : user ? "user" : null;

  if (!userType) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    admin ? admin.password : user.password
  );
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const token = jwt.sign(
    {
      userId: admin ? admin.id : user.id,
      role: userType,
      name: admin ? admin.name : user.name,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res
    .status(200)
    .json({ token, role: userType, name: user ? user.name : admin.name });
});

// ENDPOINT POSTAGEM
app.post(
  "/posts",
  verifyToken,
  isAdmin,
  upload.single("file"),
  async (req, res) => {
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
  }
);

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

app.delete("/posts/:id", verifyToken, isAdmin, async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Deletado com sucesso!" });
});

// ENDPOINT PRODUTO
app.post(
  "/products",
  verifyToken,
  isAdmin,
  upload.single("file"),
  async (req, res) => {
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
  }
);

app.get("/products", verifyToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;

  const products = await prisma.product.findMany({
    skip: (page - 1) * limit,
    take: limit,
    include: {
      reviews: true,
      comments: true,
    },
  });

  const totalProducts = await prisma.product.count();
  const totalPages = Math.ceil(totalProducts / limit);

  res.status(200).json({
    products,
    totalPages,
    currentPage: page,
  });
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

app.delete("/products/:id", verifyToken, isAdmin, async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Produto deletado com sucesso!" });
});

// ENDPOINT PRODUTO DETALHES

app.get("/product/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar o produto.", error });
  }
});

// ENDPOINT AVALIAÇÃO
app.post(
  "/products/:id/reviews",
  verifyToken,
  isUser,
  hasPurchased,
  async (req, res) => {
    const { rating } = req.body;

    const newReview = await prisma.review.create({
      data: {
        rating: parseInt(rating),
        productId: req.params.id,
        userId: req.user.userId,
      },
    });

    res.status(201).json(newReview);
  }
);

app.get("/products/:id/reviews", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.id },
  });

  res.status(200).json(reviews);
});

// ENDPOINT COMENTÁRIOS
app.post(
  "/products/:id/comments",
  verifyToken,
  isUser,
  hasPurchased,
  async (req, res) => {
    const { text } = req.body;

    const newComment = await prisma.comment.create({
      data: {
        text,
        productId: req.params.id,
        userId: req.user.userId,
      },
    });

    res.status(201).json(newComment);
  }
);

app.get("/products/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { productId: req.params.id },
  });

  res.status(200).json(comments);
});

// ENDPOINT PESQUISAR PRODUTOS
app.get("/products/search", async (req, res) => {
  const { query, page = 1, limit = 12 } = req.query;

  // Define os parâmetros de paginação
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  // Se a consulta estiver vazia, retorna todos os produtos
  if (!query) {
    try {
      const totalProducts = await prisma.product.count();
      const products = await prisma.product.findMany({
        skip,
        take,
      });
      return res.status(200).json({
        products,
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: parseInt(page),
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Erro ao buscar produtos.", error });
    }
  }

  // Filtra produtos com base na consulta
  try {
    const [products, totalProducts] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { desc: { contains: query, mode: "insensitive" } },
          ],
        },
        skip,
        take,
      }),
      prisma.product.count({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { desc: { contains: query, mode: "insensitive" } },
          ],
        },
      }),
    ]);

    res.status(200).json({
      products,
      totalPages: Math.ceil(totalProducts / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar produtos.", error });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// ENDPOINT ADICIONAR AO CARRINHO
app.post("/cart/add", verifyToken, isUser, async (req, res) => {
  const { productId } = req.body; // Recebe o productId do frontend
  const userId = req.user.userId; // Obtém o ID do usuário logado

  try {
    // Verifica se o produto existe
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    // Adiciona o produto ao carrinho
    const cartItem = await prisma.purchase.create({
      data: {
        userId: userId, // Associa o item ao usuário logado
        productId: product.id, // Associa o item ao produto
        title: product.title, // Título do produto
        image_url: product.image_url, // Imagem do produto
        price: product.price, // Preço do produto
      },
    });

    res
      .status(201)
      .json({ message: "Produto adicionado ao carrinho!", cartItem });
  } catch (error) {
    console.error("Erro ao adicionar ao carrinho:", error);
    res.status(500).json({ message: "Erro ao adicionar ao carrinho.", error });
  }
});

app.get("/cart", verifyToken, isUser, async (req, res) => {
  try {
    // Busca os itens do carrinho do usuário
    const cartItems = await prisma.purchase.findMany({
      where: { userId: req.user.userId },
      include: {
        product: true,
      },
    });

    res.status(200).json(cartItems);
  } catch (error) {
    res.status(500).json({ message: "Erro ao obter carrinho", error });
  }
});

app.delete("/cart/remove/:id", verifyToken, isUser, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se o item do carrinho existe
    const cartItem = await prisma.purchase.findUnique({
      where: { id: parseInt(id) },
    });

    if (!cartItem) {
      return res
        .status(404)
        .json({ message: "Item do carrinho não encontrado" });
    }

    // Remove o item do carrinho
    await prisma.cartItem.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Item removido do carrinho com sucesso!" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao remover do carrinho", error });
  }
});
