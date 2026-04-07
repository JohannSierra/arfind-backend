const mongoose = require('mongoose');

const MONGODB_URI = process.env.DB_URI;

mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error MongoDB:', err));
