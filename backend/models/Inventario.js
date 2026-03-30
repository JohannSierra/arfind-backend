const mongoose = require('mongoose');

const InventarioSchema = new mongoose.Schema({

  nombre: {
    type: String,
    required: true
  },

  categoria: {
    type: String,
    enum: ['Limpieza', 'Mantenimiento'],
    required: true
  },

  tipo: {
    type: String,
    enum: ['Equipo', 'Herramienta', 'Consumible'],
    required: true
  },

  cantidad: {
    type: Number,
    default: 1
  },

  estado: {
    type: String,
    enum: ['Disponible', 'En uso', 'Mantenimiento', 'Baja'],
    default: 'Disponible'
  },

  numeroSerie: String,
  codigoBarras: String,
  observaciones: String,
  imagen: String, // Base64 encoding of image asset

  // 🔥 NUEVOS CAMPOS

  numeroInventario: {
    type: String,
    unique: true
  },

  registradoPor: {
    type: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});


module.exports = mongoose.model('Inventario', InventarioSchema);
