const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const Recommender = require('./rl_model');
const { Parser } = require('json2csv');

const router = express.Router();
const stateSpace = 7;  // Número de preferencias del cliente
const actionSpace = 10;  // Número de tarjetas de crédito
const recommender = new Recommender(stateSpace, actionSpace);

let usuarios = [];
let juegos = [];

const validateUsuario = (row) => {
    return row.id && row.nombre_completo && row.plataforma &&
        !isNaN(row.accion) && !isNaN(row.simulación) &&
        !isNaN(row.aventura) && !isNaN(row.rpg) &&
        !isNaN(row.shooter) && !isNaN(row.deportes) &&
        !isNaN(row.estrategia);
};

const validateJuego = (row) => {
    return row.id && row.nombre && row.plataforma &&
        !isNaN(row.accion) && !isNaN(row.simulación) &&
        !isNaN(row.aventura) && !isNaN(row.rpg) &&
        !isNaN(row.shooter) && !isNaN(row.deportes) &&
        !isNaN(row.estrategia);
};

fs.createReadStream('usuarios.csv')
    .pipe(csv())
    .on('data', (row) => {
        if (validateUsuario(row)) {
            usuarios.push({
                id: row.id,
                nombre_completo: row.nombre_completo,
                plataforma: row.plataforma,
                preferences: [
                    row.accion, row.simulación, row.aventura,
                    row.rpg, row.shooter, row.deportes, row.estrategia
                ].map(Number),
            });
        }
    })
    .on('end', () => {
        console.log('Datos de usuarios cargados:', usuarios);
    });

fs.createReadStream('juegos.csv')
    .pipe(csv())
    .on('data', (row) => {
        if (validateJuego(row)) {
            juegos.push({
                nombre: row.nombre,
                plataforma: row.plataforma,
                generos: [
                    row.accion, row.simulación, row.aventura,
                    row.rpg, row.shooter, row.deportes, row.estrategia
                ].map(Number),
            });
        }
    })
    .on('end', () => {
        console.log('Datos de juegos cargados:', juegos);
    });
router.get('/usuario/:id', (req, res) => {
    const usuario = usuarios.find(u => u.id === req.params.id);
    if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const juegoActual = juegos.find(j => j.generos.every((val, index) => val === usuario.preferences[index]));

    res.json({
        usuario: usuario,
        juegoActual: juegoActual ? juegoActual.nombre : 'Sin Juego asignado',
    });
});

// Ruta para recomendar una tarjeta basada en nuevas preferencias
router.post('/recommend', (req, res) => {
    const { id, preferences } = req.body;

    console.log('ID recibido:', id);
    console.log('Preferencias recibidas:', preferences);

    if (!id || !Array.isArray(preferences) || preferences.length !== stateSpace) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    // Prepara datos de entrenamiento
    const states = usuarios.map(u => u.preferences);
    const actions = usuarios.map(u => {
        const actionArray = new Array(actionSpace).fill(0);
        const juegoIndex = juegos.findIndex(j => j.generos.every((val, index) => val === u.preferences[index]));
        if (juegoIndex !== -1) {
            actionArray[juegoIndex] = 1;
        }
        return actionArray;
    });

    console.log('States:', states);
    console.log('Actions:', actions);

    // Entrena el modelo
    recommender.trainModel(states, actions, 150, 32).then(() => {
        // Realiza la recomendación utilizando las nuevas preferencias
        console.log('Nuevas preferencias para recomendación:', preferences);
        const recommendationIndex = recommender.recommend(preferences);
        const recommendedGame = juegos[recommendationIndex];

        console.log('Juego recomendado:', recommendedGame.nombre);

        res.json({ recommendedGame: recommendedGame.nombre });
    }).catch(err => res.status(500).json({ error: err.message }));
});

// Ruta para asignar la tarjeta recomendada al cliente
router.post('/asignar', (req, res) => {
    const { id, juego } = req.body;

    const usuario = usuarios.find(u => u.id === id);
    const juegoRecomendado = juegos.find(j => j.nombre === juego);

    if (!usuario || !juegoRecomendado) {
        return res.status(400).json({ error: 'Usuario o juego no encontrado' });
    }

    // Actualiza las preferencias del cliente con los beneficios de la tarjeta
    usuario.preferences = juegoRecomendado.generos;

    const updatedUserData = usuarios.map(u => ({
        id: u.id,
        nombre_completo: u.nombre_completo,
        plataforma: u.plataforma,
        accion: u.preferences[0],
        simulación: u.preferences[1],
        aventura: u.preferences[2],
        rpg: u.preferences[3],
        shooter: u.preferences[4],
        deportes: u.preferences[5],
        estrategia: u.preferences[6],
    }));
    const json2csvParser = new Parser({
        fields: [
            'id', 'nombre_completo', 'plataforma',
            'accion', 'simulación', 'aventura',
            'rpg', 'shooter', 'deportes', 'estrategia'
        ]
    });
    const csvData = json2csvParser.parse(updatedUserData);

    fs.writeFileSync('usuarios.csv', csvData);

    res.json({ message: 'Juego asignado correctamente' });
});

module.exports = router;
