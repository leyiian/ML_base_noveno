const tf = require('@tensorflow/tfjs');

class Recommender {
    constructor(stateSpace, actionSpace) {
        this.stateSpace = stateSpace;
        this.actionSpace = actionSpace;
        this.model = this.createModel();
    }

    createModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({
            inputShape: [this.stateSpace], 
            units: 256, 
            activation: 'relu', 
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }));
        model.add(tf.layers.dropout({ rate: 0.5 }));
        model.add(tf.layers.dense({ 
            units: 128, 
            activation: 'relu', 
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }));
        model.add(tf.layers.dropout({ rate: 0.5 }));
        model.add(tf.layers.dense({ 
            units: 64, 
            activation: 'relu', 
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }));
        model.add(tf.layers.dropout({ rate: 0.5 }));
        model.add(tf.layers.dense({ 
            units: this.actionSpace, 
            activation: 'softmax'
        }));
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        return model;
    }

    async trainModel(states, actions, epochs = 200, batchSize = 32) {
        const xs = tf.tensor2d(states);
        const ys = tf.tensor2d(actions);
        await this.model.fit(xs, ys, {
            epochs: epochs,
            batchSize: batchSize,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Época: ${epoch + 1}/${epochs} - Pérdida: ${logs.loss.toFixed(4)} - Pérdida de validación: ${logs.val_loss.toFixed(4)} - Precisión: ${logs.acc.toFixed(4)} - Precisión de validación: ${logs.val_acc.toFixed(4)}`);
                }
            }
        });
    }

    predict(state) {
        const tensorState = tf.tensor2d([state]);
        return this.model.predict(tensorState).dataSync();
    }

    recommend(state) {
        const qValues = this.predict(state);
        console.log('Q-Values:', qValues);
        return qValues.indexOf(Math.max(...qValues));
    }
}

module.exports = Recommender;
