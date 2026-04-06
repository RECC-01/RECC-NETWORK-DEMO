import { crearWallet } from "../wallet/walletService.js";
import { pool } from "../database/db.js";
import bcrypt from "bcrypt";
import crypto from "crypto";


//  REGISTRO DE USUARIO RECCNETWORK
export async function register(req, res) {
  try {
    const {
      nombre,
      apellido,
      email,
      telefono,
      profesion,
      pais,
      pais_codigo,
      pregunta_seguridad,
      respuesta_seguridad
    } = req.body;

    // 🔍 Contar usuarios
    const countResult = await pool.query("SELECT COUNT(*) FROM users");
    const totalUsers = parseInt(countResult.rows[0].count);

    // 🔢 Secuencia
    const nextNumber = totalUsers + 1;
    const sequence = String(nextNumber).padStart(6, "0");

    // 📅 Fecha
    const today = new Date();
    const fecha = today.toISOString().slice(0, 10).replace(/-/g, "");

    // 🔐 Random
    const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();

    // 🧠 ID GLOBAL
    const user_id = `RECC-${randomPart}-${fecha}-${sequence}`;

    // 🎭 Roles
    let role = "USER";
    let role_visible = false;

    if (totalUsers === 0) {
      role = "RECC_FUNDADOR";
      role_visible = true;
    }

    // 🔐 Wallet
    const wallet = crearWallet();

    // 🔐 Hash respuesta
    const hashRespuesta = await bcrypt.hash(respuesta_seguridad, 10);

    // 💾 Guardar usuario
    const result = await pool.query(
      `INSERT INTO users (
        user_id,
        wallet_address,
        private_key,
        nombre,
        apellido,
        email,
        telefono,
        profesion,
        pais,
        pais_codigo,
        pregunta_seguridad,
        respuesta_seguridad,
        role,
        role_visible
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      ) RETURNING user_id, wallet_address, nombre, apellido, email, telefono, profesion, pais, pais_codigo, role, role_visible, created_at, kyc_verified`,
      [
        user_id,
        wallet.address,
        wallet.privateKey,
        nombre,
        apellido,
        email,
        telefono,
        profesion,
        pais,
        pais_codigo,
        pregunta_seguridad,
        hashRespuesta,
        role,
        role_visible
      ]
    );

    const user = result.rows[0];

    // 🎨 Alias wallet
    user.wallet_address = `recc1-${user.wallet_address}`;

    // 🔒 Ocultar role si no aplica
    if (!user.role_visible) {
      delete user.role;
    }

    // 🔐 Limpiar datos sensibles
    delete user.role_visible;

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error al registrar usuario"
    });
  }
}


// 🔍 OBTENER USUARIO POR ID
export async function getUserById(req, res) {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT user_id, nombre, apellido, wallet_address, created_at, kyc_verified, role, role_visible
       FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado"
      });
    }

    const user = result.rows[0];

    // 🎨 Alias
    user.wallet_address = `recc1-${user.wallet_address}`;

    // 🔒 Control role
    if (!user.role_visible) {
      delete user.role;
    }

    delete user.role_visible;

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error al obtener usuario"
    });
  }
}


// 🔐 LOGIN ESCALABLE (ID / EMAIL / TELÉFONO)
export async function login(req, res) {
  try {
    const { login, respuesta_seguridad } = req.body;

    const result = await pool.query(
      `SELECT * FROM users 
       WHERE user_id = $1 
       OR email = $1 
       OR telefono = $1`,
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado"
      });
    }

    const user = result.rows[0];

    // 🔐 Validar respuesta
    const match = await bcrypt.compare(
      respuesta_seguridad,
      user.respuesta_seguridad
    );

    if (!match) {
      return res.status(401).json({
        success: false,
        error: "Respuesta incorrecta"
      });
    }

    // 🎨 Alias wallet
    user.wallet_address = `recc1-${user.wallet_address}`;

    // 🔒 Control role
    if (!user.role_visible) {
      delete user.role;
    }

    // 🔐 Limpiar datos sensibles
    delete user.private_key;
    delete user.respuesta_seguridad;
    delete user.role_visible;

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error en login"
    });
  }
}


// ✏️ ACTUALIZAR PERFIL (NUEVA FUNCIÓN)
export async function updateUser(req, res) {
  try {
    const { user_id, email, telefono, profesion } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET email = $1,
           telefono = $2,
           profesion = $3
       WHERE user_id = $4
       RETURNING user_id, nombre, apellido, email, telefono, profesion, wallet_address, role, kyc_verified`,
      [email, telefono, profesion, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado"
      });
    }

    const user = result.rows[0];

    // 🎨 Alias wallet
    user.wallet_address = `recc1-${user.wallet_address}`;

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error al actualizar perfil"
    });
  }
}
