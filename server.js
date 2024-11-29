import express, { response } from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./multerConfig.js";
import reviewRoutes from "./routes/reviewRoutes.js";
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
app.use("/reviews", reviewRoutes);

const JWT_SECRET = "j/1~oe9zH>t]0rzq{XTFJ'K(EjxDZ7";

// ENDPOINT VERIFICAÇÃO ADMINISTRADOR
app.get("/api/check-admin", verifyToken, isAdmin, (req, res) => {
  res.status(200).json({ isAdmin: true });
});

// ENDPOINT POST REGISTRO
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(400).json({ message: "E-mail já cadastrado." });
  }

  // Criptografando a senha
  const hashedPassword = await bcrypt.hash(password, 10);

  // Criando novo usuário no banco de dados
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  // Gerando token JWT
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

// ENDPOINT POST LOGIN
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

// ENDPOINT POST POSTAGEM
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

// ENDPOINT GET POSTAGEM
app.get("/posts", async (req, res) => {
  const posts = await prisma.post.findMany();
  res.status(200).json(posts);
});

// ENDPOINT PUT POSTAGEM
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

// ENDPOINT DELETE POSTAGEM
app.delete("/posts/:id", async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  res.status(200).json({ message: "Deletado com sucesso!" });
});

// ENDPOINT POST PRODUTOS
app.post(
  "/products",
  verifyToken,
  isAdmin,
  upload.array("files"), // Para múltiplas imagens
  async (req, res) => {
    const { title, desc, sizes, colors, date_time } = req.body;
    console.log("Body recebido:", req.body);
    console.log("Arquivos recebidos no backend:", req.files);

    try {
      // Criação do produto principal
      const newProduct = await prisma.product.create({
        data: {
          title,
          desc,
          date_time: new Date(date_time),
        },
      });

      // Adiciona os tamanhos com preços
      const parsedSizes = JSON.parse(sizes); // Enviar como string JSON
      await Promise.all(
        parsedSizes.map((size) =>
          prisma.size.create({
            data: {
              productId: newProduct.id,
              size: size.size,
              price: parseFloat(size.price),
            },
          })
        )
      );

      // Adiciona as cores com imagens
      const parsedColors = JSON.parse(colors);
      await Promise.all(
        parsedColors.map((color, index) =>
          prisma.color.create({
            data: {
              productId: newProduct.id,
              color: color.color,
              image_url: req.files[index]
                ? `/uploads/${req.files[index].filename}`
                : null,
            },
          })
        )
      );

      res.status(201).json({ message: "Produto criado com sucesso!" });
    } catch (error) {
      console.error("Erro ao criar produto:", error);
      res.status(500).json({ message: "Erro ao criar produto." });
    }
  }
);

// ENDPOINT GET TODOS OS PRODUTOS COM PAGINAÇÃO
app.get("/products", async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    // Converte os parâmetros para números
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // Busca os produtos com paginação
    const products = await prisma.product.findMany({
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
      include: {
        sizes: true,
        colors: true,
      },
    });

    // Conta o total de produtos
    const totalProducts = await prisma.product.count();
    const totalPages = Math.ceil(totalProducts / limitNumber);

    res.status(200).json({ products, totalPages });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ message: "Erro ao buscar produtos." });
  }
});

// ENDPOINT PUT PRODUTO
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

// ENDPOINT DELETE PRODUTO DETALHES
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await prisma.product.delete({
      where: {
        id: id,
      },
    });

    res.json({ message: "Produto deletado com sucesso!", product });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erro ao deletar produto", error: error.message });
  }
});

// ENDPOINT GET PRODUTO DETALHES
app.get("/product/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        sizes: true, // Incluir tamanhos
        colors: true, // Incluir cores
        reviews: true, // Incluir avaliações
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar o produto.", error });
  }
});

// ENDPOINT POST AVALIAÇÃO
app.post(
  "/products/:id/reviews",
  verifyToken,
  isUser,
  hasPurchased,
  async (req, res) => {
    const { rating, comment } = req.body;

    const newReview = await prisma.review.create({
      data: {
        rating: parseInt(rating),
        comment,
        productId: req.params.id,
        userId: req.user.userId,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    res.status(201).json({
      ...newReview,
      userName: user.name,
    });
  }
);

// ENDPOINT GET AVALIAÇÃO
app.get("/products/:id/reviews", async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.id },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar avaliações.", error });
  }
});

// ENDPOINT GET COMENTÁRIOS
app.get("/products/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { productId: req.params.id },
  });

  res.status(200).json(comments);
});

// ENDPOINT POST COMENTÁRIOS
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

// ENDPOINT GET PESQUISAR PRODUTOS
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

// ENDPOINT POST CARRINHO
app.post("/cart/add", verifyToken, isUser, async (req, res) => {
  const { productId, quantity, color, size } = req.body;
  const userId = req.user.userId;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        sizes: true,
        colors: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    if (!quantity || !color || !size) {
      return res.status(400).json({
        message:
          "Por favor, forneça todos os detalhes: quantidade, cor e tamanho.",
      });
    }

    const selectedColor = product.colors.find((c) => c.color === color);
    const selectedSize = product.sizes.find((s) => s.size === size);

    if (!selectedColor) {
      return res
        .status(400)
        .json({ message: "Cor não encontrada para o produto." });
    }

    if (!selectedSize) {
      return res
        .status(400)
        .json({ message: "Tamanho não encontrado para o produto." });
    }

    const cartItem = await prisma.purchase.create({
      data: {
        userId: userId,
        productId: product.id,
        title: product.title,
        image_url: selectedColor.image_url || product.image_url,
        price: selectedSize.price,
        quantity: quantity,
        color: color,
        size: size,
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

// ENDPOINT GET CARRINHO
app.get("/cart", verifyToken, isUser, async (req, res) => {
  try {
    const userId = req.user?.userId; // Certifique-se de que req.user existe
    if (!userId) {
      return res.status(400).json({ error: "Usuário não autenticado." });
    }
    const cartItems = await prisma.purchase.findMany({
      where: { userId: req.user.userId },
      include: {
        product: {
          include: {
            sizes: true, // Inclui os tamanhos do produto
            colors: true, // Inclui as cores do produto
          },
        },
      },
    });

    res.status(200).json(cartItems);
  } catch (error) {
    console.error("Erro ao obter carrinho:", error.message);
    res
      .status(500)
      .json({ message: "Erro ao obter carrinho.", error: error.message });
  }
});

// ENDPOINT DELETE CARRINHO
app.delete("/cart/remove/:productId", verifyToken, isUser, async (req, res) => {
  const { productId } = req.params.productId;
  const userId = req.user.userId;

  try {
    const cartItem = await prisma.purchase.findFirst({
      where: {
        productId: productId,
        userId: userId,
      },
    });

    if (!cartItem) {
      return res
        .status(404)
        .json({ message: "Item não encontrado no carrinho." });
    }

    await prisma.purchase.delete({
      where: {
        id: cartItem.id,
      },
    });

    res.status(200).json({ message: "Item removido do carrinho com sucesso." });
  } catch (error) {
    console.error("Erro ao remover item do carrinho:", error);
    res
      .status(500)
      .json({ message: "Erro ao remover item do carrinho.", error });
  }
});

// ENDPOINT DELETE LIMPAR CARRINHO
app.delete("/cart/clear", verifyToken, async (req, res) => {
  try {
    await prisma.purchase.deleteMany({
      where: {
        userId: req.user.userId,
      },
    });
    res.status(200).json({ message: "Carrinho limpo com sucesso." });
  } catch (error) {
    console.error("Erro ao limpar o carrinho:", error);
    res.status(500).json({ message: "Erro ao limpar o carrinho." });
  }
});

// ENDPOINT PUT CARRINHO
app.put("/cart/update/:productId", verifyToken, isUser, async (req, res) => {
  const { quantity } = req.body;
  const userId = req.user.userId;
  const productId = req.params.productId;

  try {
    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "A quantidade deve ser maior que zero." });
    }

    const cartItem = await prisma.purchase.findFirst({
      where: {
        userId: userId,
        productId: productId,
      },
    });

    if (!cartItem) {
      return res
        .status(404)
        .json({ message: "Produto não encontrado no carrinho." });
    }

    const updatedCartItem = await prisma.purchase.update({
      where: {
        id: cartItem.id,
      },
      data: {
        quantity: quantity,
      },
    });

    res.status(200).json({
      message: "Quantidade do item no carrinho atualizada.",
      updatedCartItem,
    });
  } catch (error) {
    console.error("Erro ao atualizar quantidade no carrinho:", error);
    res.status(500).json({ message: "Erro ao atualizar a quantidade.", error });
  }
});

// ENDPOINT GET ATUALIZAR USUARIO
app.get("/user", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar usuário.", error });
  }
});

app.put("/user/update", verifyToken, async (req, res) => {
  const { userId } = req.user;
  const { name, currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!isCurrentPasswordValid) {
    return res.status(401).json({ message: "Senha atual inválida." });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name,
      password: await bcrypt.hash(newPassword, 10),
    },
  });

  res.status(200).json({ message: "Usuário atualizado com sucesso." });
});

// ENDPOINT POST PEDIDO DO USUÁRIO
app.post("/orders", verifyToken, isUser, async (req, res) => {
  const { orderItems, totalPrice } = req.body;

  // Verifica se há itens no pedido
  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({ message: "Não há itens no pedido." });
  }

  try {
    // Gera um protocolo único para o pedido
    const protocol = `ORD-${Date.now()}`;

    // Cria o pedido no banco de dados
    const newOrder = await prisma.order.create({
      data: {
        protocol,
        userId: req.user.userId, // ID do usuário logado
        orderItems: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: parseInt(item.quantity, 10),
            title: item.title, // Nome do produto
            price: item.price,
            color: item.color, // Cor do produto
            size: item.size, // Tamanho do produto
            totalPrice: item.totalPrice,
          })),
        },
        totalPrice, // Inclui os itens do pedido na resposta
      },
      include: {
        orderItems: true,
      },
    });

    res.status(201).json(newOrder); // Retorna o pedido criado
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao criar o pedido.", error });
  }
});

// ENDPOINT GET PEDIDO DO USUÁRIO
app.get("/orders", verifyToken, isUser, async (req, res) => {
  try {
    // Busca os pedidos do usuário logado
    const userOrders = await prisma.order.findMany({
      where: { userId: req.user.userId }, // Filtra pelos pedidos do usuário logado
      include: {
        orderItems: {
          include: {
            product: true, // Inclui informações do produto no item do pedido
          },
        },
      },
      orderBy: { createdAt: "desc" }, // Ordena os pedidos pela data de criação
    });

    // Verifica se os pedidos e itens foram encontrados
    if (!userOrders || userOrders.length === 0) {
      return res.status(404).json({ message: "Nenhum pedido encontrado." });
    }

    res.status(200).json(userOrders); // Retorna os pedidos do usuário
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar os pedidos.", error });
  }
});

// ENDPOINT GET DETALHES DO PEDIDO
app.get("/order/:id", verifyToken, isUser, async (req, res) => {
  const { id } = req.params;

  try {
    // Busca o pedido com base no ID fornecido
    const order = await prisma.order.findUnique({
      where: { id }, // ou { protocol: id } caso prefira buscar pelo protocolo
      include: {
        orderItems: {
          include: {
            product: true, // Inclui detalhes do produto, caso necessário
          },
        },
      },
    });

    // Verifica se o pedido existe
    if (!order) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    // Retorna os detalhes do pedido
    res.status(200).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar o pedido.", error });
  }
});

// ENDPOINT PARA ATUALIZAR O STATUS DO PEDIDO
app.patch("/orders/:id/status", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "O status é obrigatório." });
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Erro ao atualizar o status do pedido:", error);
    res.status(500).json({ message: "Erro ao atualizar o status do pedido." });
  }
});

// ENDPOINT GET TODOS OS PEDIDOS PARA ADMINISTRADOR
app.get("/ordersadm", verifyToken, isAdmin, async (req, res) => {
  try {
    // Busca todos os pedidos, independente do usuário
    const allOrders = await prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } }, // Inclui informações do usuário que fez o pedido
        orderItems: {
          include: {
            product: true, // Inclui detalhes do produto
          },
        },
      },
      orderBy: { createdAt: "desc" }, // Ordena os pedidos pela data de criação
    });

    // Verifica se há pedidos
    if (!allOrders || allOrders.length === 0) {
      return res.status(404).json({ message: "Nenhum pedido encontrado." });
    }

    res.status(200).json(allOrders); // Retorna todos os pedidos
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    res.status(500).json({ message: "Erro ao buscar pedidos.", error });
  }
});

// ENDPOINT USERS DASHBOARD
app.get("/api/usuarios/contagem", verifyToken, isAdmin, async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({ count });
  } catch (error) {
    console.error("Erro ao contar usuários:", error);
    res.status(500).json({ message: "Erro ao contar usuários" });
  }
});

// ENDPOINT PRODUTOS DASHBOARD
app.get("/api/produtos/contagem", verifyToken, isAdmin, async (req, res) => {
  try {
    const count = await prisma.product.count();
    res.json({ count });
  } catch (error) {
    console.error("Erro ao contar produtos:", error);
    res.status(500).json({ message: "Erro ao contar produtos" });
  }
});

// ENDPOINT POSTAGENS DASHBOARD
app.get("/api/noticias/contagem", verifyToken, isAdmin, async (req, res) => {
  try {
    const count = await prisma.post.count();
    res.json({ count });
  } catch (error) {
    console.error("Erro ao contar notícias:", error);
    res.status(500).json({ message: "Erro ao contar notícias" });
  }
});

// ENDPOINT PEDIDOS DASHBOARD
app.get("/api/pedidos/contagem", verifyToken, isAdmin, async (req, res) => {
  try {
    const count = await prisma.order.count();
    res.json({ count });
  } catch (error) {
    console.error("Erro ao contar pedidos:", error);
    res.status(500).json({ message: "Erro ao contar pedidos" });
  }
});

// ENDPOINT GET PESQUISAR PEDIDOS
app.get("/orders/search", async (req, res) => {
  const { protocol, page = 1, limit = 12 } = req.query;

  // Define os parâmetros de paginação
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  // Se o protocolo estiver vazio, retorna todos os pedidos
  if (!protocol) {
    try {
      const totalOrders = await prisma.order.count();
      const orders = await prisma.order.findMany({
        skip,
        take,
      });
      return res.status(200).json({
        orders,
        totalPages: Math.ceil(totalOrders / limit),
        currentPage: parseInt(page),
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Erro ao buscar pedidos.", error });
    }
  }

  // Filtra os pedidos com base no protocolo
  try {
    const [orders, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          protocol: { contains: protocol, mode: "insensitive" },
        },
        skip,
        take,
      }),
      prisma.order.count({
        where: {
          protocol: { contains: protocol, mode: "insensitive" },
        },
      }),
    ]);

    res.status(200).json({
      orders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar pedidos.", error });
  }
});
