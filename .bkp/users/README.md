# API de Usuários

Módulo de usuários da API (Express 5, Mongoose, Zod, JWT).

**URL base:** `http://localhost:3001/api/v1`

## Papéis (roles)

| Role         | Como é criado                          |
| ------------ | -------------------------------------- |
| `fornecedor` | Cadastro público ou admin              |
| `motorista`  | Cadastro público ou admin              |
| `recebedor`  | Cadastro público ou admin (padrão)     |
| `admin`      | **Somente** por outro admin            |

Se `role` for omitido, o padrão é `recebedor`.

## Regras de validação

- `name`: 3 a 100 caracteres
- `email`: formato válido; é salvo em minúsculas
- `password`: 8 a 72 caracteres (72 é o limite do bcrypt)
- `companyId`: ObjectId de 24 caracteres hexadecimais (apenas admin)
- `:id` nas rotas: ObjectId de 24 caracteres hexadecimais

## Formato das respostas

Sucesso:

```json
{
  "success": true,
  "message": "Mensagem opcional",
  "data": {},
  "timestamp": "2026-11-20T12:00:00.000Z"
}
```

`message` e `data` só aparecem quando existem. O `DELETE` responde `204` sem corpo.

Erro de negócio/autenticação (`401`, `403`, `404`, `409`...):

```json
{
  "success": false,
  "error": "Email já cadastrado por outro usuário",
  "code": "CONFLICT"
}
```

Erro de validação (corpo inválido):

```json
{
  "success": false,
  "message": "Erro de validação",
  "errors": [{ "path": "role", "message": "...", "code": "invalid_value" }]
}
```

> Em desenvolvimento, as respostas de erro também incluem o campo `stack`.

**Atenção ao identificador:** o login devolve `user.id`, mas as demais rotas
devolvem o usuário com `_id`.

## Endpoints

| Método | Rota               | Acesso      | Descrição                              |
| ------ | ------------------ | ----------- | -------------------------------------- |
| GET    | `/health`          | Público     | Verifica se a API está no ar           |
| POST   | `/users/register`  | Público     | Cadastro (nunca cria admin)            |
| POST   | `/users/login`     | Público     | Retorna token JWT e dados do usuário   |
| GET    | `/users/profile`   | Autenticado | Perfil do usuário logado               |
| PUT    | `/users/profile`   | Autenticado | Atualiza **apenas** nome e e-mail      |
| GET    | `/users`           | Admin       | Lista usuários **ativos** (paginado)   |
| POST   | `/users`           | Admin       | Cria usuário com qualquer role         |
| GET    | `/users/:id`       | Admin       | Busca usuário por ID                   |
| PUT    | `/users/:id`       | Admin       | Atualiza usuário (role, isActive, ...) |
| DELETE | `/users/:id`       | Admin       | Desativa usuário (soft delete)         |

Rotas autenticadas exigem o header `Authorization: Bearer <token>`.
Rotas de admin exigem token de um usuário com `role: "admin"`.

## Exemplos (curl)

### 1. Health check

```bash
curl -X GET http://localhost:3001/api/v1/health
```

curl -s -i -X POST http://localhost:3001/api/v1/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"roni@teste.com","password":"senha1234"}' | head -20




### 2. Cadastro público

Roles aceitos: `fornecedor`, `motorista`, `recebedor`.

```bash
curl -X POST http://localhost:3001/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "senhaSegura123",
    "role": "motorista"
  }'
```

### 3. Login

```bash
curl -X POST http://localhost:3001/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "password": "senhaSegura123"
  }' | jq
```

O token vem em `data.token`. Para guardá-lo numa variável:

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@example.com","password":"senhaSegura123"}' | jq -r '.data.token')
```

Usuários desativados recebem `403`; credenciais inválidas recebem `401`.

### 4. Perfil do usuário logado

```bash
curl -X GET http://localhost:3001/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Atualizar perfil

Só `name` e `email` são aceitos. Qualquer outro campo é ignorado.

```bash
curl -X PUT http://localhost:3001/api/v1/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva Atualizado",
    "email": "joao.novo@example.com"
  }'
```

---

## Rotas de administrador

> O token precisa pertencer a um usuário com `role: "admin"`.

**Primeiro admin:** o cadastro público não cria admin e `POST /users` exige admin,
então o primeiro precisa ser promovido direto no banco (substitua `NOME_DO_BANCO`):

```bash
mongosh NOME_DO_BANCO --eval \
  'db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })'
```

Faça login de novo depois: o `role` vai dentro do token, então um token antigo
continua com o papel anterior.

### 6. Listar usuários

Lista apenas usuários **ativos**. `limit` vai de 1 a 100 (padrão 10).

```bash
curl -X GET "http://localhost:3001/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 7. Criar usuário

Permite qualquer role, inclusive `admin`, e opcionalmente `companyId`.

```bash
curl -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin Master",
    "email": "admin@example.com",
    "password": "senhaAdmin123",
    "role": "admin"
  }'
```

### 8. Buscar usuário por ID

Substitua `ID_DO_USUARIO` pelo `_id` retornado na criação.

```bash
curl -X GET http://localhost:3001/api/v1/users/ID_DO_USUARIO \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 9. Atualizar usuário por ID

Além de `name` e `email`, permite alterar `role`, `isActive` e `companyId`.
Não altera senha.

```bash
curl -X PUT http://localhost:3001/api/v1/users/ID_DO_USUARIO \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nome Alterado",
    "role": "fornecedor",
    "isActive": false
  }'
```

### 10. Desativar usuário

Soft delete: define `isActive` como `false` e responde `204`. O usuário deixa de
aparecer na listagem e não consegue mais fazer login.

```bash
curl -X DELETE http://localhost:3001/api/v1/users/ID_DO_USUARIO \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Testando no Insomnia/Postman

1. Crie uma requisição `POST` para `/users/login` (ou `/users/register`).
2. Na aba **Body**, selecione **JSON** e cole o objeto.
3. Copie o valor de `data.token` da resposta.
4. Na aba **Auth**, selecione **Bearer Token** e cole o token.
5. Faça as demais requisições (`/users/profile` e rotas de admin).

## Ainda não existe

- Troca de senha e recuperação de senha
- Reativação de usuário por rota dedicada (só via `PUT /users/:id` com `isActive: true`,
  e como a listagem esconde inativos, é preciso conhecer o ID)
