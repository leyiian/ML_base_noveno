const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Importar modelos independientes
const probabilidadModel = require('./ml/probabilidad');
const comentariosModel = require('./ml/comentarios');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Rutas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html')); // Página principal
});

app.get('/probabilidad.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/probabilidad.html')); // Probabilidad de compra
});

app.get('/comentarios.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/comentarios.html')); // Análisis de conversaciones
});

app.get('/recomendaciones.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/recomendaciones.html')); // Análisis de conversaciones
});


// Endpoints de API para cada funcionalidad
probabilidadModel(app); // Lógica para el modelo de probabilidad
comentariosModel(app);

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor iniciado en http://localhost:${port}`);
});
