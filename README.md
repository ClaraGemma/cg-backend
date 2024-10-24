# Backend API

Repositório do Backend da "Clara && Gemma arte e resina" desenvolvido em Node.js com Express; MongoDB e Prisma como ORM.

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Contribuição](#contribuição)

## Sobre o Projeto

Este projeto tem como objetivo fornecer uma API para gerenciamento de dados do website Clara && Gemma.

## Tecnologias Utilizadas

- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Prisma](https://www.prisma.io/)
- [Nodemon](https://nodemon.io/)

## Instalação

1. Clone o repositório:
    ```bash
    git clone https://github.com/ClaraGemma/cg-backend.git
    ```

2. Navegue até o diretório do projeto:
    ```bash
    cd nome-do-diretório
    ```

3. Instale as dependências:
    ```bash
    npm install
    ```

## Configuração

1. Crie um arquivo `.env` na raiz do projeto e adicione as variáveis de ambiente conforme necessário. Exemplo:
    ```env
    DATABASE_URL="mongodb+srv://seu-usuario:senha@cluster0.mongodb.net/nome-do-banco"
    ```

2. Configure o Prisma:
    ```bash
    npx prisma generate
    ```

3. Execute as migrações do Prisma:
    ```bash
    npx prisma migrate dev --name init
    ```
4. Para mais informações, acesse a documentação disponível na plataforma:
- Documentação [Prisma](https://www.prisma.io/docs/orm/overview/databases/mongodb)

## Uso

1. Inicie o servidor:
    ```bash
    npm run dev
    ```

2. A API estará disponível em `http://localhost:3000`.

## Contribuição

Contribuições são bem-vindas! Por favor, abra um pull request ou uma issue para discutir mudanças.

---

Desenvolvido por [Matheus Romeiro](https://github.com/matheusromeiro).
