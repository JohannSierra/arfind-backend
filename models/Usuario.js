const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
  nombre: String,
  codigo: String,
  puesto: String
});

module.exports = mongoose.model('Usuario', UsuarioSchema);
