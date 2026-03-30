const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

require('./db');

const Usuario = require('./models/Usuario');
const Inventario = require('./models/Inventario');
const Movimiento = require('./models/Movimiento');
const app = express(); // ✅ primero creas app

app.use(cors());
app.use(express.json()); // ✅ luego activas json middleware

/* ============================= */
/* ADMINISTRACIÓN */
/* ============================= */

/* REGISTRO */
app.post('/registrar', async (req, res) => {
  const { nombre, puesto } = req.body;

  try {

    const existe = await Usuario.findOne({ nombre });
    if (existe) {
      return res.status(409).json({ message: 'Usuario ya existe' });
    }

    // 🔐 generar código automático de 6 dígitos
    const codigoPlano = Math.floor(100000 + Math.random() * 900000).toString();

    const codigoHash = await bcrypt.hash(codigoPlano, SALT_ROUNDS);

    const usuario = new Usuario({
      nombre,
      codigo: codigoHash,
      puesto
    });

    await usuario.save();

    // ⚠️ enviar el código solo una vez
    res.json({
      message: 'Usuario registrado',
      codigo: codigoPlano
    });

  } catch (err) {
    res.status(500).json({ message: 'Error al registrar' });
  }
});


/* OBTENER USUARIOS */
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, 'nombre puesto');
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener empleados' });
  }
});

/* VALIDAR SOLO ADMIN */
app.post('/validar-admin', async (req, res) => {
  try {

    if (!req.body || !req.body.clave) {
      return res.status(400).json({ autorizado: false });
    }

    const clave = req.body.clave;

    const admins = await Usuario.find({ puesto: { $in: ['Administrador', 'Almacenista'] } });

    for (let admin of admins) {
      const match = await bcrypt.compare(clave, admin.codigo);
      if (match) {
        return res.json({ autorizado: true });
      }
    }

    return res.status(401).json({ autorizado: false });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error validando administrador' });
  }
});

/* ELIMINAR USUARIO (YA NO VALIDA CLAVE AQUÍ) */
app.delete('/usuario/:id', async (req, res) => {
  try {
    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

/* ============================= */
/* LOGIN */
/* ============================= */

app.post('/login', async (req, res) => {
  const { codigo } = req.body;

  try {
    const usuarios = await Usuario.find();

    for (let usuario of usuarios) {

      if (!usuario.codigo.startsWith('$2')) {
        if (codigo === usuario.codigo) {
          usuario.codigo = await bcrypt.hash(codigo, SALT_ROUNDS);
          await usuario.save();

          return res.json({
  _id: usuario._id,
  nombre: usuario.nombre,
  puesto: usuario.puesto
});

        }
      }

      const match = await bcrypt.compare(codigo, usuario.codigo);
      if (match) {
        return res.json({
  _id: usuario._id,
  nombre: usuario.nombre,
  puesto: usuario.puesto
});
      }
    }

    return res.status(401).json({ message: 'Código incorrecto' });

  } catch (err) {
    res.status(500).json({ message: 'Error en login' });
  }
});

/* ============================= */
/* INVENTARIO */
/* ============================= */

app.post('/inventario', async (req, res) => {
  try {
    const { tipo, series, codigoBarras } = req.body;

    if (tipo === 'Consumible' && codigoBarras) {
      const existente = await Inventario.findOne({ codigoBarras, tipo: 'Consumible' });
      if (existente) {
        existente.cantidad += (Number(req.body.cantidad) || 1);
        await existente.save();
        return res.json(existente);
      }
    }

    let ultimo = await Inventario.findOne().sort({ createdAt: -1 });

    let nuevoNumero = 1;

    if (ultimo && ultimo.numeroInventario) {
      const numero = parseInt(ultimo.numeroInventario.split('-')[1]);
      nuevoNumero = numero + 1;
    }

    const prefijo = req.body.categoria === 'Limpieza' ? 'LIM' : 'MAN';

    if ((tipo === 'Equipo' || tipo === 'Herramienta') && Array.isArray(series) && series.length > 0) {
      const creados = [];
      for (let s of series) {
        if (!s) continue;
        const folio = `${prefijo}-${String(nuevoNumero).padStart(5, '0')}`;
        nuevoNumero++;
        
        const nuevo = new Inventario({
          ...req.body,
          cantidad: 1,
          numeroSerie: s,
          numeroInventario: folio
        });
        nuevo.series = undefined;
        await nuevo.save();
        creados.push(nuevo);
      }
      return res.json({ creados });
    }

    // Para consumibles o registros que no mandan arreglo de series
    const folio = `${prefijo}-${String(nuevoNumero).padStart(5, '0')}`;

    const nuevo = new Inventario({
      ...req.body,
      numeroInventario: folio
    });

    await nuevo.save();
    res.json(nuevo);

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

app.put('/inventario/:id', async (req, res) => {
  try {
    const item = await Inventario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar inventario' });
  }
});

app.get('/inventario', async (req, res) => {
  try {
    const items = await Inventario.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener inventario' });
  }
});

app.delete('/inventario/:id', async (req, res) => {
  try {
    await Inventario.findByIdAndDelete(req.params.id);
    res.json({ message: 'Elemento eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar inventario' });
  }
});

/* ============================= */
/* Movimientos/Solicitar herramientas */
app.post('/movimientos', async (req, res) => {
  try {
    const { productos } = req.body;
    const asignados = [];

    // 1. ACTUALIZACIÓN AUTOMÁTICA Y ASIGNACIÓN
    for (let p of productos) {
      if (p.tipo === 'Consumible') {
        const item = await Inventario.findOne({ _id: p._id, estado: 'Disponible' });
        if (item && item.cantidad >= p.cantidad) {
          item.cantidad -= p.cantidad;
          if (item.cantidad === 0) item.estado = 'En uso'; // Agotado
          await item.save();
          asignados.push({
            _id: item._id,
            nombre: item.nombre,
            cantidad: p.cantidad,
            imagen: item.imagen
          });
        } else {
          return res.status(400).json({ error: 'No hay suficiente stock para ' + p.nombre });
        }
      } else {
        // Equipo o Herramienta (buscar por nombre individualmente)
        const items = await Inventario.find({
          nombre: p.nombre,
          estado: 'Disponible',
          tipo: { $in: ['Herramienta', 'Equipo'] }
        }).limit(p.cantidad);

        if (items.length < p.cantidad) {
          return res.status(400).json({ error: 'No hay suficiente disponibilidad para ' + p.nombre });
        }

        for (let item of items) {
          item.estado = 'En uso';
          await item.save();
          asignados.push({
            _id: item._id,
            nombre: item.nombre,
            cantidad: 1,
            numeroSerie: item.numeroSerie,
            imagen: item.imagen
          });
        }
      }
    }

    // 2. Guardar el movimiento referenciado
    const movimiento = new Movimiento({
      ...req.body,
      productos: asignados
    });
    await movimiento.save();

    res.json({ ok: true, asignados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar movimiento' });
  }
});

/* Devoluciones */
app.post('/solicitar-devolucion', async (req, res) => {
  try {
    const { movimientoId } = req.body;
    
    // Generar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Actualizar el movimiento a estado solicitado y guardar el código
    const movimiento = await Movimiento.findByIdAndUpdate(movimientoId, {
      estadoDevolucion: 'solicitada',
      codigoLiberacion: codigo
    }, { new: true });

    if (!movimiento) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    res.json({ ok: true, codigo: codigo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al solicitar devolución' });
  }
});

app.post('/confirmar-devolucion', async (req, res) => {
  try {
    const { usuarioId, productos, movimientoId, codigo } = req.body;

    const movimientoOriginal = await Movimiento.findById(movimientoId);
    if (!movimientoOriginal) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    if (movimientoOriginal.estadoDevolucion !== 'solicitada' || movimientoOriginal.codigoLiberacion !== codigo) {
      return res.status(400).json({ error: 'Código inválido o devolución no solicitada' });
    }

    // 1. Registrar el movimiento de entrada
    const movimiento = new Movimiento({
      usuario: movimientoOriginal.usuario,
      usuarioId: movimientoOriginal.usuarioId,
      productos: movimientoOriginal.productos,
      tipo: 'entrada',
      fecha: new Date()
    });
    await movimiento.save();

    // 2. MARCAR MOVIMIENTO ORIGINAL COMO DEVUELTO
    await Movimiento.findByIdAndUpdate(movimientoId, { 
      devuelto: true,
      estadoDevolucion: 'completada'
    });

    // 3. RESTAURAR INVENTARIO
    for (let p of movimientoOriginal.productos) {
      const item = await Inventario.findById(p._id);
      if (item) {
        if (item.tipo === 'Equipo' || item.tipo === 'Herramienta') {
          item.estado = 'Disponible';
        } else {
          item.cantidad += p.cantidad;
          item.estado = 'Disponible';
        }
        await item.save();
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al confirmar devolución' });
  }
});

/* Devoluciones (legacy u otros usos) */
app.post('/devoluciones', async (req, res) => {
  try {
    const { usuarioId, productos, movimientoId } = req.body;

    // 1. Registrar el movimiento de entrada
    const movimiento = new Movimiento({
      ...req.body,
      tipo: 'entrada',
      fecha: new Date()
    });
    await movimiento.save();

    // 2. MARCAR MOVIMIENTO ORIGINAL COMO DEVUELTO
    if (movimientoId) {
      await Movimiento.findByIdAndUpdate(movimientoId, { devuelto: true });
    }

    // 3. RESTAURAR INVENTARIO
    for (let p of productos) {
      const item = await Inventario.findById(p._id);
      if (item) {
        if (item.tipo === 'Equipo') {
          item.estado = 'Disponible';
        } else {
          item.cantidad += p.cantidad;
          item.estado = 'Disponible';
        }
        await item.save();
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar devolución' });
  }
});

/* Obtener movimientos activos de un usuario (NO DEVUELTOS) */
app.get('/movimientos/:usuarioId', async (req, res) => {
  try {
    const movimientos = await Movimiento.find({ 
      usuarioId: req.params.usuarioId,
      tipo: 'salida',
      devuelto: false 
    }).sort({ createdAt: -1 });

    res.json(movimientos);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener movimientos' });
  }
});

/* Obtener TODOS los movimientos pendientes (para Almacenista) */
app.get('/movimientos-pendientes', async (req, res) => {
  try {
    const movimientos = await Movimiento.find({ 
      tipo: 'salida',
      devuelto: false 
    }).sort({ createdAt: 1 }); // Los más viejos primero

    res.json(movimientos);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener pendientes' });
  }
});

/* ============================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API corriendo en el puerto ${PORT}`);
});
