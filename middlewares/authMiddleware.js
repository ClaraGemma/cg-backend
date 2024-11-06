import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const JWT_SECRET = "j/1~oe9zH>t]0rzq{XTFJ'K(EjxDZ7";
const prisma = new PrismaClient();

// Middleware para verificar o token JWT
export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Pega o token do cabeçalho Authorization

  if (!token) {
    return res.status(401).json({ message: "Acesso não autorizado." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token inválido." });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  });
};

// Middleware para verificar se o usuário é Admin
export const isAdmin = async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user.userId },
    });

    if (!admin) {
      return res
        .status(403)
        .json({ message: "Acesso negado: não é administrador" });
    }

    next(); // O usuário é admin, continua para a próxima função
  } catch (error) {
    res.status(500).json({ message: "Erro ao verificar administrador", error });
  }
};

// Middleware para verificar se o usuário é User
export const isUser = (req, res, next) => {
  if (req.user.role !== "user") {
    return res
      .status(403)
      .json({ message: "Acesso negado: não é usuário autorizado" });
  }

  next(); // O usuário tem o papel de User, continua para a próxima função
};

export const hasPurchased = async (req, res, next) => {
  const { userId } = req.user;
  const { productId } = req.params;

  // Verifica se o usuário comprou o produto
  const purchase = await prisma.purchase.findFirst({
    where: {
      userId: userId,
      productId: productId,
    },
  });

  if (!purchase) {
    return res.status(403).json({
      message: "Você precisa comprar o produto para comentar ou avaliar",
    });
  }

  next();
};
