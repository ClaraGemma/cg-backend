// clearDatabase.js

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    await prisma.orderItem.deleteMany();

    console.log("Banco de dados limpo com sucesso.");
  } catch (error) {
    console.error("Erro ao limpar o banco de dados:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
