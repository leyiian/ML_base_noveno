// probabilidad.js
const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const csv = require('csv-parser');

// Este es el código que define el modelo y la lógica de predicción
module.exports = (app) => {
    let data = [];

    // Cargar datos desde el CSV
    fs.createReadStream('probabilidad.csv') // Asegúrate de tener el archivo CSV correcto
        .pipe(csv())
        .on('data', (row) => {
            // Procesar cada fila del CSV y agregarla al array de datos
            data.push({
                nombre: row.nombre,
                plataforma: row.plataforma,
                tipo: row.tipo,
                monto: parseFloat(row.monto),
                proba: parseFloat(row.proba)
            });
        })
        .on('end', () => {
            console.log(`Se cargaron ${data.length} filas de datos de entrenamiento`);

            // Obtener categorías únicas de nombres, plataformas y tipos
            const nombres = [...new Set(data.map(d => d.nombre))];
            const plataformas = [...new Set(data.map(d => d.plataforma))];
            const tipos = [...new Set(data.map(d => d.tipo))];

            // Endpoint para devolver las opciones únicas al cliente
            app.get('/opciones', (req, res) => {
                res.json({ nombres, plataformas, tipos });
            });

            // Definir el modelo de red neuronal
            const model = tf.sequential();
            model.add(tf.layers.dense({ units: 10, activation: 'relu', inputShape: [4] }));
            model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

            model.compile({
                optimizer: tf.train.adam(),
                loss: 'binaryCrossentropy',
                metrics: ['accuracy']
            });

            // Preparar los datos de entrenamiento
            const xs = data.map(d => [
                nombres.indexOf(d.nombre),
                plataformas.indexOf(d.plataforma),
                tipos.indexOf(d.tipo),
                d.monto / 10000 // Normalización del monto
            ]);
            const ys = data.map(d => d.proba);

            const xsTensor = tf.tensor2d(xs);
            const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

            console.log('Forma de xsTensor:', xsTensor.shape);
            console.log('Forma de ysTensor:', ysTensor.shape);

            // Entrenar el modelo
            model.fit(xsTensor, ysTensor, {
                epochs:  200,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Época: ${epoch + 1} - Precisión: ${(logs.acc * 100).toFixed(2)}% - Pérdida: ${logs.loss.toFixed(4)}`);
                    }
                }
            }).then(history => {
                console.log('Entrenamiento completo');
                console.log(`Precisión final del modelo: ${history.history.acc[history.history.acc.length - 1] * 100}%`);

                // Endpoint para recibir datos de prueba y predecir la probabilidad de venta
                app.post('/predict', (req, res) => {
                    const { nombre, plataforma, tipo, monto } = req.body;

                    // Validación de entrada
                    if (!nombre || !plataforma || !tipo || typeof monto !== 'number') {
                        return res.status(400).json({ error: 'Datos de entrada no válidos' });
                    }

                    // Normalización del monto
                    const montoNormalizado = monto / 10000;

                    // Codificación de variables categóricas
                    const encodedNombre = nombres.indexOf(nombre);
                    const encodedPlataforma = plataformas.indexOf(plataforma);
                    const encodedTipo = tipos.indexOf(tipo);

                    if (encodedNombre === -1 || encodedPlataforma === -1 || encodedTipo === -1) {
                        return res.status(400).json({ error: 'Valor de entrada no reconocido' });
                    }

                    // Preparar datos de entrada para la predicción
                    const testData = tf.tensor2d([[encodedNombre, encodedPlataforma, encodedTipo, montoNormalizado]]);

                    // Realizar la predicción
                    const predictions = model.predict(testData);
                    predictions.array().then(array => {
                        const probabilidad = array[0][0] * 100; // Convertir a porcentaje

                        // Devolver el resultado de la predicción al cliente
                        res.json({ probabilidad: probabilidad.toFixed(2) });
                    });
                });

                // Iniciar el servidor
                console.log('Servidor de probabilidad de venta iniciado');
            }).catch(err => {
                console.error('Error durante el entrenamiento:', err);
            });
        })
        .on('error', (err) => {
            console.error('Error al leer el archivo CSV:', err);
        });
};
