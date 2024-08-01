import bcrypt from "bcryptjs";

const passwordAdmin = "Miranda!@#";

bcrypt.hash(passwordAdmin, 10, (err, hash) => {
  if (err) {
    console.error("Erro ao gerar hash:", err);
  } else {
    console.log("Senha criptografada:", hash);
  }
});
