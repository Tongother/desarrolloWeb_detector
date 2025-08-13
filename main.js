const URL = "./my_model/";
let model, webcam, maxPredictions;
let isCameraActive = false;

// Almacenamiento de cámaras
let videoDevices = [];
let currentDeviceIndex = 0;

// Referencias a elementos del DOM
const startCameraButton = document.getElementById('start-camera-button');
const uploadImageButton = document.getElementById('upload-image-button');
const imageUploadInput = document.getElementById('image-upload-input');
const switchCameraButton = document.getElementById('switch-camera-button');
const statusScreen = document.getElementById('status-screen');
const statusMessage = document.getElementById('status-message');
const resultsContainer = document.getElementById('results-container');
const video = document.getElementById('webcam');
const imageContainer = document.getElementById('image-container');

// Asignar eventos a los botones
startCameraButton.addEventListener('click', initCamera);
uploadImageButton.addEventListener('click', () => imageUploadInput.click());
imageUploadInput.addEventListener('change', handleImageUpload);
switchCameraButton.addEventListener('click', switchCamera);

// Función para cargar el modelo (se llama una sola vez)
async function loadModel() {
    statusMessage.textContent = 'Cargando modelo...';
    try {
        model = await tmImage.load(URL + "model.json", URL + "metadata.json");
        maxPredictions = model.getTotalClasses();
        return true;
    } catch (error) {
        console.error("No se pudo cargar el modelo:", error);
        statusScreen.classList.add('error');
        statusMessage.textContent = 'Error al cargar el modelo. Revisa la carpeta.';
        return false;
    }
}

// Función principal para iniciar la cámara
async function initCamera() {
    startCameraButton.disabled = true;
    uploadImageButton.disabled = true;
    
    if (!model) { // Cargar el modelo solo si no se ha cargado antes
        const modelLoaded = await loadModel();
        if (!modelLoaded) {
            startCameraButton.disabled = false;
            uploadImageButton.disabled = false;
            return;
        }
    }

    // Enumerar cámaras solo la primera vez
    if (videoDevices.length === 0) {
        statusMessage.textContent = 'Buscando cámaras...';
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length === 0) throw new Error("No se encontraron cámaras.");
        } catch (error) {
            handleCameraError(error);
            return;
        }
    }
    
    // Mostrar el botón de cambio si hay más de una cámara
    switchCameraButton.classList.toggle('hidden', videoDevices.length <= 1);
    
    await startWebcamStream();
}

// Inicia o reinicia el stream de la cámara
async function startWebcamStream() {
    statusMessage.textContent = 'Iniciando cámara...';

    // Detener la cámara anterior si existe
    if (webcam && webcam.isActive) {
        await webcam.stop();
    }

    const deviceId = videoDevices[currentDeviceIndex].deviceId;
    webcam = new tmImage.Webcam(400, 400, true); // width, height, flip
    
    try {
        await webcam.setup({ deviceId: deviceId });
        video.srcObject = webcam.webcam.srcObject;
        isCameraActive = true;

        statusScreen.classList.add('hidden');
        resultsContainer.classList.add('visible');
        createPredictionRows(); // Crea las filas para los resultados

        window.requestAnimationFrame(loop);
    } catch (error) {
        handleCameraError(error);
    }
}

// Función para cambiar de cámara
function switchCamera() {
    if (videoDevices.length > 1) {
        currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
        startWebcamStream(); // Reinicia el stream con la nueva cámara
    }
}

// Maneja la carga de una imagen
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Detener la cámara si está activa
    if (webcam && webcam.isActive) webcam.stop();
    isCameraActive = false;
    switchCameraButton.classList.add('hidden');
    video.srcObject = null;

    if (!model) { // Cargar el modelo si es necesario
        const modelLoaded = await loadModel();
        if (!modelLoaded) return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageUrl = e.target.result;
        imageContainer.style.backgroundImage = `url(${imageUrl})`;
        
        statusScreen.classList.add('hidden');
        resultsContainer.classList.add('visible');
        createPredictionRows();
        
        // Crear un elemento de imagen para la predicción
        const imageElement = new Image();
        imageElement.src = imageUrl;
        imageElement.onload = async () => {
            const prediction = await model.predict(imageElement);
            updateUIWithPredictions(prediction);
        };
    };
    reader.readAsDataURL(file);
}

// Bucle de predicción para la cámara
async function loop() {
    if (!isCameraActive) return; // Detener el bucle si la cámara se apaga

    const ctx = webcam.canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, webcam.canvas.width, webcam.canvas.height);
    const prediction = await model.predict(webcam.canvas);
    updateUIWithPredictions(prediction);
    window.requestAnimationFrame(loop);
}

// --- FUNCIONES DE AYUDA (para no repetir código) ---

function createPredictionRows() {
    resultsContainer.innerHTML = '';
    for (let i = 0; i < maxPredictions; i++) {
        const row = document.createElement("div");
        row.className = "prediction-row";
        row.innerHTML = `<span class="class-name"></span><div class="progress-bar"><div class="progress-fill"></div></div>`;
        resultsContainer.appendChild(row);
    }
}

function updateUIWithPredictions(prediction) {
    let topPrediction = prediction.reduce((prev, current) => (prev.probability > current.probability) ? prev : current);

    const rows = resultsContainer.children;
    for (let i = 0; i < maxPredictions; i++) {
        const row = rows[i];
        const p = prediction[i];
        row.querySelector('.class-name').textContent = p.className;
        const fill = row.querySelector('.progress-fill');
        fill.style.width = (p.probability * 100) + '%';
        fill.textContent = (p.probability * 100).toFixed(1) + '%';
        
        row.classList.toggle('top-prediction', p.className === topPrediction.className);
    }
}

function handleCameraError(error) {
    console.error("Error con la cámara:", error);
    statusScreen.classList.remove('hidden');
    statusScreen.classList.add('error');
    statusMessage.textContent = 'No se pudo iniciar la cámara. Revisa los permisos.';
    startCameraButton.disabled = false;
    uploadImageButton.disabled = false;
    startButton.textContent = 'Reintentar';
}