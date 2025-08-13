const URL = "./my_model/"; // Asegúrate que tu carpeta de modelo esté aquí
let model, webcam, labelContainer, maxPredictions;

// Referencias a los elementos del DOM
const startButton = document.getElementById('start-button');
const statusScreen = document.getElementById('status-screen');
const statusMessage = document.getElementById('status-message');
const resultsContainer = document.getElementById('results-container');
const video = document.getElementById('webcam');

// Asignamos la función init al botón
startButton.addEventListener('click', init);

async function init() {
    statusMessage.textContent = 'Accediendo al modelo...';
    startButton.disabled = true;

    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    try {
        // Cargar modelo y metadata
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        // Configurar la webcam
        const flip = true;
        webcam = new tmImage.Webcam(400, 400, flip);
        await webcam.setup();
        
        // Asignar el stream de la webcam al elemento <video>
        video.srcObject = webcam.webcam.srcObject;

        // Ocultar la pantalla de inicio y mostrar los resultados
        statusScreen.classList.add('hidden');
        resultsContainer.classList.add('visible');

        // Crear las filas para los resultados
        resultsContainer.innerHTML = ''; // Limpiar por si acaso
        for (let i = 0; i < maxPredictions; i++) {
            const row = document.createElement("div");
            row.className = "prediction-row";
            row.innerHTML = `
                <span class="class-name"></span>
                <div class="progress-bar"><div class="progress-fill"></div></div>
            `;
            resultsContainer.appendChild(row);
        }

        // Iniciar el bucle de predicción
        window.requestAnimationFrame(loop);

    } catch (error) {
        console.error("Error al iniciar la aplicación:", error);
        statusScreen.classList.add('error');
        statusMessage.textContent = 'No se pudo iniciar la cámara. Revisa los permisos e inténtalo de nuevo.';
        startButton.disabled = false;
        startButton.textContent = 'Reintentar';
    }
}

async function loop() {
    const ctx = webcam.canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, webcam.canvas.width, webcam.canvas.height);
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    const prediction = await model.predict(webcam.canvas);
    let topPrediction = -1;
    let maxProbability = -1;

    // Encontrar la predicción más alta
    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > maxProbability) {
            maxProbability = prediction[i].probability;
            topPrediction = i;
        }
    }

    // Actualizar la UI
    const rows = resultsContainer.children;
    for (let i = 0; i < maxPredictions; i++) {
        const row = rows[i];
        const probability = prediction[i].probability;
        
        row.querySelector('.class-name').textContent = prediction[i].className;
        const fill = row.querySelector('.progress-fill');
        fill.style.width = (probability * 100) + '%';
        fill.textContent = (probability * 100).toFixed(1) + '%';
        
        // Aplicar o quitar la clase de "top-prediction"
        if (i === topPrediction) {
            row.classList.add('top-prediction');
        } else {
            row.classList.remove('top-prediction');
        }
    }
}