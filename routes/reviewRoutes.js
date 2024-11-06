import express from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/authMiddleware.js";
const router = express.Router();
const prisma = new PrismaClient();

// Adiciona uma nova avaliação para um produto específico
router.post("/products/:id/reviews", async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const userId = req.userId;

  try {
    // Verifique se o usuário já avaliou o produto
    const existingReview = await prisma.review.findFirst({
      where: { productId: id, userId },
    });

    if (existingReview) {
      return res.status(400).json({ message: "Você já avaliou este produto." });
    }

    const newReview = await prisma.review.create({
      data: {
        rating,
        comment,
        productId: id,
        userId,
      },
    });

    res.status(201).json(newReview);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao adicionar avaliação." });
  }
});

export default router;
