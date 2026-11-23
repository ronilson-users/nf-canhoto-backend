import { Router } from 'express';

import { authMiddleware, requireRole } from '@/shared/middleware/auth';
import { validateBody } from '@/shared/middleware/validation';

import * as userController from './user.controller';
import {
  createUserSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  updateUserSchema,
} from './user.validation';

const router = Router();
const adminOnly = [authMiddleware, requireRole(['admin'])];

/** @swagger
 * /users/register:
 *   post: { summary: Cadastro público (fornecedor, motorista ou recebedor), tags: [Users], responses: { 201: { description: Criado } } }
 * /users/login:
 *   post: { summary: Login, tags: [Users], responses: { 200: { description: OK }, 401: { description: Credenciais inválidas } } }
 */
router.post('/register', validateBody(registerSchema), userController.register);
router.post('/login', validateBody(loginSchema), userController.login);

/** @swagger
 * /users/profile:
 *   get: { summary: Perfil do usuário logado, tags: [Users], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 *   put: { summary: Atualiza nome/email do usuário logado, tags: [Users], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 */
router.get('/profile', authMiddleware, userController.profile);
router.put('/profile', authMiddleware, validateBody(updateProfileSchema), userController.updateProfile);

/** @swagger
 * /users:
 *   get: { summary: Lista usuários (admin), tags: [Users], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 *   post: { summary: Cria usuário com qualquer papel (admin), tags: [Users], security: [{ BearerAuth: [] }], responses: { 201: { description: Criado } } }
 */
router.get('/', ...adminOnly, userController.list);
router.post('/', ...adminOnly, validateBody(createUserSchema), userController.create);

/** @swagger
 * /users/{id}:
 *   get: { summary: Usuário por ID (admin), tags: [Users], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 *   put: { summary: Atualiza usuário (admin), tags: [Users], security: [{ BearerAuth: [] }], responses: { 200: { description: OK } } }
 *   delete: { summary: Desativa usuário (admin), tags: [Users], security: [{ BearerAuth: [] }], responses: { 204: { description: Removido } } }
 */
router.get('/:id', ...adminOnly, userController.getById);
router.put('/:id', ...adminOnly, validateBody(updateUserSchema), userController.update);
router.delete('/:id', ...adminOnly, userController.remove);

export default router;
