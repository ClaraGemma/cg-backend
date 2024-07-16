import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

/*
    DB_USER: matheus
    DB_PASSWORD: MFQklfbF31Rj7zpO
*/

const prisma = new PrismaClient();

const app = express();
app.use(express.json());
app.use(cors());

app.post("/posts", async (req, res) => {
  await prisma.post.create({
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image_url: req.body.image_url,
      date_time: req.body.date_time,
    },
  });

  res.status(201).json(req.body);
});

app.get("/posts", async (req, res) => {
  const posts = await prisma.post.findMany();

  res.status(200).json(posts);
});

app.put("/posts/:id", async (req, res) => {
  await prisma.post.update({
    where: {
      id: req.params.id,
    },
    data: {
      title: req.body.title,
      desc: req.body.desc,
      image_url: req.body.image_url,
      date_time: req.body.date_time,
    },
  });

  res.status(201).json(req.body);
});

app.delete("/posts/:id", async (req, res) => {
  await prisma.post.delete({
    where: {
      id: req.params.id,
    },
  });

  res.status(200).json({ message: "Usuário deletado com sucesso!" });
});

app.listen(3000);
