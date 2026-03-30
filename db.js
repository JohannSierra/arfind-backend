const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ARFIND:IJATXnuj2YfRtGgD@cluster0.qaws9gp.mongodb.net/ARFIND';

mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error MongoDB:', err));
