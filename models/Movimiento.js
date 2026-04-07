const mongoose = require('mongoose');

const MovimientoSchema = new mongoose.Schema({
  usuario: String,
  usuarioId: String,
  productos: [
    {
      _id: String,
      nombre: String,
      cantidad: Number,
      numeroSerie: String,
      imagen: String
    }
  ],
  tipo: String,
  devuelto: {
    type: Boolean,
    default: false
  },
  estadoDevolucion: {
    type: String,
    enum: ['ninguna', 'solicitada', 'completada'],
    default: 'ninguna'
  },
  codigoLiberacion: String,
  fecha: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Movimiento', MovimientoSchema);
