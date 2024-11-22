const tf = require('@tensorflow/tfjs');  // Asegúrate de importar TensorFlow.js al inicio
const fs = require('fs');
const csv = require('csv-parser');
const natural = require('natural');
const stopword = require('stopword');
const { PCA } = require('ml-pca');
const skmeans = require('skmeans');

const comentariosModel = (app) => {
    let data = [];

    fs.createReadStream('comentarios.csv')
        .pipe(csv())
        .on('data', (row) => {
            data.push({
                id: row.id,
                conversacion: row.conversacion
            });
        })
        .on('end', () => {
            console.log(`Se cargaron ${data.length} filas de datos de conversaciones`);

            // Tokenización y eliminación de stopwords
            const tokenizer = new natural.WordTokenizer();
            let tokenizedData = data.map(d => stopword.removeStopwords(tokenizer.tokenize(d.conversacion.toLowerCase())));

            // Crear vocabulario y secuencias de números
            let vocab = {};
            let sequences = tokenizedData.map(tokens => {
                return tokens.map(token => {
                    if (!(token in vocab)) {
                        vocab[token] = Object.keys(vocab).length + 1;
                    }
                    return vocab[token];
                });
            });

            // Padding para que todas las secuencias tengan la misma longitud
            const maxLen = 100;
            sequences = sequences.map(seq => {
                if (seq.length > maxLen) {
                    return seq.slice(0, maxLen);
                } else {
                    return Array(maxLen - seq.length).fill(0).concat(seq);
                }
            });

            // Normalizar secuencias
            const paddedSequences = tf.tensor2d(sequences);
            const maxTokenValue = Math.max(...[].concat(...sequences));
            const normalizedSequences = paddedSequences.div(maxTokenValue);

            // Definir el modelo Autoencoder
            const encodingDim = 32;
            const input = tf.input({ shape: [100] });
            const encoded = tf.layers.dense({ units: encodingDim, activation: 'relu' }).apply(input);
            const decoded = tf.layers.dense({ units: 100, activation: 'sigmoid' }).apply(encoded);

            const autoencoder = tf.model({ inputs: input, outputs: decoded });
            const encoder = tf.model({ inputs: input, outputs: encoded });

            autoencoder.compile({
                optimizer: tf.train.adam(),
                loss: 'meanSquaredError'
            });

            // Entrenar el modelo Autoencoder
            autoencoder.fit(normalizedSequences, normalizedSequences, {
                epochs: 200,
                batchSize: 256,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Época: ${epoch + 1} - Pérdida: ${logs.loss.toFixed(4)}`);
                    }
                }
            }).then(() => {
                console.log('Entrenamiento completo');

                // Endpoint para obtener las representaciones y clusters
                app.get('/representaciones', (req, res) => {
                    const encodedData = encoder.predict(normalizedSequences);
                    encodedData.array().then(array => {
                        // Reducir las dimensiones con PCA
                        const pca = new PCA(array);
                        const reducedData = pca.predict(array, { nComponents: 2 }).data;

                        // Realizar el clustering K-means
                        const numberOfClusters = 3;
                        const kmeansResult = skmeans(reducedData, numberOfClusters);

                        let clusterDetails = [];
                        for (let i = 0; i < numberOfClusters; i++) {
                            let clusterData = data.filter((d, idx) => kmeansResult.idxs[idx] === i);
                            clusterDetails.push({
                                cluster: i,
                                size: clusterData.length,
                                examples: clusterData.slice(0, 3)  // Ejemplos de conversaciones
                            });
                        }

                        // Respuesta con los resultados
                        const response = {
                            data: reducedData.slice(0, 500),  // Submuestreo para visualización
                            clusters: kmeansResult.idxs.slice(0, 500),
                            ids: data.map(d => d.id).slice(0, 500),  // IDs de las conversaciones
                            conversations: data.map(d => d.conversacion).slice(0, 500),  // Conversaciones completas
                            details: clusterDetails
                        };

                        res.json(response);
                    });
                });

            }).catch(err => {
                console.error('Error durante el entrenamiento:', err);
            });
        })
        .on('error', (err) => {
            console.error('Error al leer el archivo CSV:', err);
        });
};

module.exports = comentariosModel;
