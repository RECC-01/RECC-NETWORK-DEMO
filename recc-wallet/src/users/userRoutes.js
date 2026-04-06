import express from "express";
import { register, getUserById, login, updateUser } from "./userController.js";

const router = express.Router();

/**
 * 🚀 REGISTRO DE USUARIO
 * POST /api/users/register
 */
router.post("/register", register);

/**
 * 🔐 LOGIN DE USUARIO
 * POST /api/users/login
 */
router.post("/login", login);

/**
 * ✏️ ACTUALIZAR PERFIL
 * PUT /api/users/update
 */
router.put("/update", updateUser);

/**
 * 🔍 OBTENER USUARIO POR ID GLOBAL
 * GET /api/users/:user_id
 */
router.get("/:user_id", getUserById);

export default router;
