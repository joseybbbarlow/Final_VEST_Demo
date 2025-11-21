// Canine Vital Signs Monitoring System - Main JavaScript

// BLE UUIDs (must match Arduino code)
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TEMP_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const PPG_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const ACCEL_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';

// Global variables
let device, server, service;
let tempCharacteristic, ppgCharacteristic, accelCharacteristic;
let isActiveMode = false;
let autoModeEnabled = true;
let previousMagnitude = 1.0;
let movementHistory = [];

// Sensor mode controls
let tempMode = 'auto';
let ppgMode = 'auto';
let accelMode = 'auto';

// Simulated data
let autoTempValue = 101.5;
let lastTempUpdate = 0;
let simulatedHR = 75;
let simulatedPPG = 500;
let ppgPhase = 0;

// PPG Graph
let ppgCanvas, ppgCtx;
let ppgData = [];
const PPG_MAX_POINTS = 100;

// Accelerometer Graph
let accelCanvas, accelCtx;
let accelData = {x: [], y: [], z: []};
const ACCEL_MAX_POINTS = 50;

// Health ranges
let healthRanges = {
    tempRest: { min: 101.0, max: 102.5 },
    tempActive: { min: 102.0, max: 103.5 },
    hrRest: { min: 60, max: 100 },
    hrActive: { min: 100, max: 180 }
};

// Breed-specific data
const breedData = {
    labrador: { size: 'large', baseHR: 70, tempAdjust: 0 },
    german_shepherd: { size: 'large', baseHR: 65, tempAdjust: 0 },
    golden_retriever: { size: 'large', baseHR: 70, tempAdjust: 0 },
    beagle: { size: 'medium', baseHR: 80, tempAdjust: 0 },
    bulldog: { size: 'medium', baseHR: 75, tempAdjust: 0.2 },
    poodle: { size: 'medium', baseHR: 75, tempAdjust: 0 },
    husky: { size: 'large', baseHR: 65, tempAdjust: -0.3 },
    boxer: { size: 'large', baseHR: 70, tempAdjust: 0.1 }
};

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing application...');
    
    if (!navigator.bluetooth) {
        alert('Web Bluetooth API is not available in this browser. Please use Chrome, Edge, or Opera.');
        return;
    }

    updateHealthRanges();
    
    setTimeout(() => {
        initializeGraphs();
    }, 100);
    
    // Temperature simulation
    setInterval(updateAutoTemperature, 1000);
    
    // PPG simulation (for auto mode demo)
    setInterval(simulatePPGData, 50); // 20Hz for smooth graph
    
    console.log('Application initialized');
}

/**
 * Initialize canvas graphs
 */
function initializeGraphs() {
    console.log('Initializing graphs...');
    
    ppgCanvas = document.getElementById('ppgCanvas');
    if (ppgCanvas) {
        ppgCtx = ppgCanvas.getContext('2d');
        ppgCtx.fillStyle = '#f8f8f8';
        ppgCtx.fillRect(0, 0, ppgCanvas.width, ppgCanvas.height);
        console.log('PPG canvas initialized');
    }
    
    accelCanvas = document.getElementById('accelCanvas');
    if (accelCanvas) {
        accelCtx = accelCanvas.getContext('2d');
        accelCtx.fillStyle = '#f8f8f8';
        accelCtx.fillRect(0, 0, accelCanvas.width, accelCanvas.height);
        console.log('Accel canvas initialized');
    }
}

/**
 * Simulate realistic PPG data for auto mode
 */
function simulatePPGData() {
    if (ppgMode !== 'auto') return;
    
    // Generate realistic heartbeat waveform
    const heartbeatFreq = simulatedHR / 60; // beats per second
    ppgPhase += heartbeatFreq * 0.05; // increment phase
    
    // Create heartbeat shape (systolic peak + dicrotic notch)
    let value = 500; // baseline
    const t = ppgPhase % 1; // 0 to 1 for one heartbeat cycle
    
    if (t < 0.3) {
        // Systolic rise and peak
        value = 500 + 200 * Math.sin(t * Math.PI / 0.3);
    } else if (t < 0.5) {
        // Dicrotic notch
        value = 500 + 80 * Math.sin((t - 0.3) * Math.PI / 0.2);
    } else {
        // Diastolic decay
        value = 500 + 30 * Math.exp(-(t - 0.5) * 8);
    }
    
    // Add small noise
    value += (Math.random() - 0.5) * 10;
    simulatedPPG = Math.round(value);
    
    // Update display
    document.getElementById('ppgRaw').textContent = simulatedPPG;
    document.getElementById('hrValue').textContent = simulatedHR;
    updateHeartRateStatus(simulatedHR);
    
    // Add to graph
    ppgData.push(simulatedPPG);
    if (ppgData.length > PPG_MAX_POINTS) {
        ppgData.shift();
    }
    drawPPGGraph();
    
    const quality = 'Good';
    document.getElementById('ppgQuality').textContent = quality;
}

/**
 * Update simulated temperature
 */
function updateAutoTemperature() {
    if (tempMode !== 'auto') return;
    
    const now = Date.now();
    if (now - lastTempUpdate < 2000) return;
    
    const variation = (Math.random() - 0.5) * 0.2;
    autoTempValue += variation;
    
    if (autoTempValue < 100.5) autoTempValue = 100.5;
    if (autoTempValue > 103.5) autoTempValue = 103.5;
    
    updateTemperatureDisplay(autoTempValue);
    lastTempUpdate = now;
}

/**
 * Update temperature display
 */
function updateTemperatureDisplay(avgTemp) {
    const temp1 = avgTemp + (Math.random() - 0.5) * 0.1;
    const temp2 = avgTemp + (Math.random() - 0.5) * 0.1;
    const delta = Math.abs(temp1 - temp2);
    
    document.getElementById('temp1').textContent = temp1.toFixed(1) + '°F';
    document.getElementById('temp2').textContent = temp2.toFixed(1) + '°F';
    document.getElementById('tempValue').textContent = avgTemp.toFixed(1);
    document.getElementById('tempDelta').textContent = delta.toFixed(1) + '°F';
    
    updateTemperatureStatus(avgTemp);
}

/**
 * Temperature mode control
 */
function setTempMode(mode) {
    tempMode = mode;
    
    document.querySelectorAll('.sensor-card:nth-child(1) .btn-sensor-demo').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const indicator = document.getElementById('tempModeIndicator');
    
    switch(mode) {
        case 'auto':
            indicator.textContent = 'Auto Mode (Simulated)';
            autoTempValue = 101.5;
            break;
        case 'normal':
            indicator.textContent = 'Manual: Normal';
            updateTemperatureDisplay(101.5);
            break;
        case 'elevated':
            indicator.textContent = 'Manual: Elevated';
            updateTemperatureDisplay(102.8);
            break;
        case 'fever':
            indicator.textContent = 'Manual: Fever';
            updateTemperatureDisplay(104.2);
            break;
    }
}

/**
 * PPG mode control
 */
function setPPGMode(mode) {
    ppgMode = mode;
    console.log('PPG mode set to:', mode);
    
    document.querySelectorAll('.sensor-card:nth-child(2) .btn-sensor-demo').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const indicator = document.getElementById('ppgModeIndicator');
    
    switch(mode) {
        case 'auto':
            indicator.textContent = 'Auto Mode (Simulated)';
            simulatedHR = 75;
            ppgPhase = 0;
            break;
        case 'resting':
            indicator.textContent = 'Manual: Resting';
            simulatedHR = 75;
            document.getElementById('hrValue').textContent = simulatedHR;
            updateHeartRateStatus(simulatedHR);
            break;
        case 'elevated':
            indicator.textContent = 'Manual: Elevated';
            simulatedHR = 125;
            document.getElementById('hrValue').textContent = simulatedHR;
            updateHeartRateStatus(simulatedHR);
            break;
        case 'tachycardia':
            indicator.textContent = 'Manual: Tachycardia';
            simulatedHR = 180;
            document.getElementById('hrValue').textContent = simulatedHR;
            updateHeartRateStatus(simulatedHR);
            break;
    }
}

/**
 * Accelerometer mode control
 */
function setAccelMode(mode) {
    accelMode = mode;
    
    document.querySelectorAll('.sensor-card:nth-child(3) .btn-sensor-demo').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const indicator = document.getElementById('accelModeIndicator');
    const movementStatus = document.getElementById('movementStatus');
    
    switch(mode) {
        case 'auto':
            indicator.textContent = 'Auto Mode (Live Sensor)';
            break;
        case 'rest':
            indicator.textContent = 'Manual: At Rest';
            movementStatus.textContent = 'Subject at Rest';
            movementStatus.className = 'movement-status rest';
            updateAccelDisplay(0.01, -0.02, 0.98, 1.0);
            simulateAccelGraph('rest');
            break;
        case 'walking':
            indicator.textContent = 'Manual: Walking';
            movementStatus.textContent = 'Walking Detected';
            movementStatus.className = 'movement-status moving';
            updateAccelDisplay(0.15, 0.12, 1.05, 1.08);
            simulateAccelGraph('walking');
            break;
        case 'running':
            indicator.textContent = 'Manual: Running';
            movementStatus.textContent = 'Active Movement Detected';
            movementStatus.className = 'movement-status moving';
            updateAccelDisplay(0.35, 0.28, 1.15, 1.25);
            simulateAccelGraph('running');
            break;
    }
}

/**
 * Simulate accelerometer graph data
 */
function simulateAccelGraph(activity) {
    accelData = {x: [], y: [], z: []};
    
    for (let i = 0; i < ACCEL_MAX_POINTS; i++) {
        let x, y, z;
        const t = i / ACCEL_MAX_POINTS;
        
        switch(activity) {
            case 'rest':
                x = 0.01 + (Math.random() - 0.5) * 0.02;
                y = -0.02 + (Math.random() - 0.5) * 0.02;
                z = 0.98 + (Math.random() - 0.5) * 0.02;
                break;
            case 'walking':
                x = 0.15 * Math.sin(t * Math.PI * 4) + (Math.random() - 0.5) * 0.05;
                y = 0.12 * Math.cos(t * Math.PI * 4) + (Math.random() - 0.5) * 0.05;
                z = 1.0 + 0.1 * Math.sin(t * Math.PI * 8) + (Math.random() - 0.5) * 0.05;
                break;
            case 'running':
                x = 0.35 * Math.sin(t * Math.PI * 8) + (Math.random() - 0.5) * 0.1;
                y = 0.28 * Math.cos(t * Math.PI * 8) + (Math.random() - 0.5) * 0.1;
                z = 1.0 + 0.2 * Math.sin(t * Math.PI * 16) + (Math.random() - 0.5) * 0.1;
                break;
        }
        
        accelData.x.push(x);
        accelData.y.push(y);
        accelData.z.push(z);
    }
    
    drawAccelGraph();
}

/**
 * Update accelerometer display
 */
function updateAccelDisplay(x, y, z, mag) {
    document.getElementById('accelX').textContent = x.toFixed(3);
    document.getElementById('accelY').textContent = y.toFixed(3);
    document.getElementById('accelZ').textContent = z.toFixed(3);
    document.getElementById('accelMag').textContent = mag.toFixed(3);
}

/**
 * Draw PPG waveform graph
 */
function drawPPGGraph() {
    if (!ppgCanvas || !ppgCtx) return;
    
    const width = ppgCanvas.width;
    const height = ppgCanvas.height;
    
    ppgCtx.fillStyle = '#f8f8f8';
    ppgCtx.fillRect(0, 0, width, height);
    
    ppgCtx.strokeStyle = '#e0e0e0';
    ppgCtx.lineWidth = 1;
    for (let i = 0; i < height; i += 30) {
        ppgCtx.beginPath();
        ppgCtx.moveTo(0, i);
        ppgCtx.lineTo(width, i);
        ppgCtx.stroke();
    }
    
    if (ppgData.length < 2) return;
    
    ppgCtx.strokeStyle = '#800000';
    ppgCtx.lineWidth = 3;
    ppgCtx.beginPath();
    
    const xStep = width / PPG_MAX_POINTS;
    ppgData.forEach((value, index) => {
        const x = index * xStep;
        const y = height - ((value - 300) / 600 * height);
        
        if (index === 0) {
            ppgCtx.moveTo(x, y);
        } else {
            ppgCtx.lineTo(x, y);
        }
    });
    
    ppgCtx.stroke();
}

/**
 * Draw accelerometer graph
 */
function drawAccelGraph() {
    if (!accelCanvas || !accelCtx) return;
    
    const width = accelCanvas.width;
    const height = accelCanvas.height;
    
    accelCtx.fillStyle = '#f8f8f8';
    accelCtx.fillRect(0, 0, width, height);
    
    accelCtx.strokeStyle = '#e0e0e0';
    accelCtx.lineWidth = 1;
    for (let i = 0; i < height; i += 30) {
        accelCtx.beginPath();
        accelCtx.moveTo(0, i);
        accelCtx.lineTo(width, i);
        accelCtx.stroke();
    }
    
    // Center line
    accelCtx.strokeStyle = '#cccccc';
    accelCtx.lineWidth = 1;
    accelCtx.beginPath();
    accelCtx.moveTo(0, height / 2);
    accelCtx.lineTo(width, height / 2);
    accelCtx.stroke();
    
    if (accelData.x.length < 2) return;
    
    const xStep = width / ACCEL_MAX_POINTS;
    const centerY = height / 2;
    const scale = height / 4;
    
    // X axis (red)
    accelCtx.strokeStyle = '#dc3545';
    accelCtx.lineWidth = 2;
    accelCtx.beginPath();
    accelData.x.forEach((value, index) => {
        const x = index * xStep;
        const y = centerY - (value * scale);
        if (index === 0) accelCtx.moveTo(x, y);
        else accelCtx.lineTo(x, y);
    });
    accelCtx.stroke();
    
    // Y axis (green)
    accelCtx.strokeStyle = '#28a745';
    accelCtx.lineWidth = 2;
    accelCtx.beginPath();
    accelData.y.forEach((value, index) => {
        const x = index * xStep;
        const y = centerY - (value * scale);
        if (index === 0) accelCtx.moveTo(x, y);
        else accelCtx.lineTo(x, y);
    });
    accelCtx.stroke();
    
    // Z axis (blue)
    accelCtx.strokeStyle = '#007bff';
    accelCtx.lineWidth = 2;
    accelCtx.beginPath();
    accelData.z.forEach((value, index) => {
        const x = index * xStep;
        const y = centerY - (value * scale);
        if (index === 0) accelCtx.moveTo(x, y);
        else accelCtx.lineTo(x, y);
    });
    accelCtx.stroke();
}

/**
 * Connect to Bluetooth device
 */
async function connectBluetooth() {
    try {
        console.log('Requesting Bluetooth Device...');
        device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'VEST' }],
            optionalServices: [SERVICE_UUID]
        });

        console.log('Connecting to GATT Server...');
        server = await device.gatt.connect();
        service = await server.getPrimaryService(SERVICE_UUID);

        tempCharacteristic = await service.getCharacteristic(TEMP_CHAR_UUID);
        ppgCharacteristic = await service.getCharacteristic(PPG_CHAR_UUID);
        accelCharacteristic = await service.getCharacteristic(ACCEL_CHAR_UUID);

        await tempCharacteristic.startNotifications();
        tempCharacteristic.addEventListener('characteristicvaluechanged', handleTemperatureData);

        await ppgCharacteristic.startNotifications();
        ppgCharacteristic.addEventListener('characteristicvaluechanged', handlePPGData);

        await accelCharacteristic.startNotifications();
        accelCharacteristic.addEventListener('characteristicvaluechanged', handleAccelData);

        updateConnectionUI(true);

        console.log('Connected successfully!');
    } catch (error) {
        console.error('Connection failed:', error);
        alert('Failed to connect: ' + error.message);
    }
}

/**
 * Disconnect from Bluetooth device
 */
function disconnectBluetooth() {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
        updateConnectionUI(false);
        console.log('Disconnected');
    }
}

/**
 * Update connection status in UI
 */
function updateConnectionUI(isConnected) {
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const statusIndicator = document.getElementById('statusIndicator');

    if (isConnected) {
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-block';
        statusIndicator.className = 'status-indicator connected';
        statusIndicator.innerHTML = '<span class="status-dot green"></span><span>Connected</span>';
    } else {
        connectBtn.style.display = 'inline-block';
        disconnectBtn.style.display = 'none';
        statusIndicator.className = 'status-indicator disconnected';
        statusIndicator.innerHTML = '<span class="status-dot red"></span><span>Disconnected</span>';
    }
}

/**
 * Handle temperature data from BLE
 */
function handleTemperatureData(event) {
    if (tempMode !== 'auto') return;
}

/**
 * Handle PPG data from BLE
 */
function handlePPGData(event) {
    // Currently using simulated data for reliable demo
    // Live sensor integration can be enabled here
}

/**
 * Handle accelerometer data from BLE
 */
function handleAccelData(event) {
    if (accelMode !== 'auto') return;
    
    const value = event.target.value;
    const accelX = value.getFloat32(0, true);
    const accelY = value.getFloat32(4, true);
    const accelZ = value.getFloat32(8, true);
    const accelMag = value.getFloat32(12, true);

    updateAccelDisplay(accelX, accelY, accelZ, accelMag);
    
    // Update graph with live data
    accelData.x.push(accelX);
    accelData.y.push(accelY);
    accelData.z.push(accelZ);
    
    if (accelData.x.length > ACCEL_MAX_POINTS) {
        accelData.x.shift();
        accelData.y.shift();
        accelData.z.shift();
    }
    
    drawAccelGraph();
    
    detectMovement(accelMag);
}

/**
 * Detect movement and update activity state
 */
function detectMovement(currentMagnitude) {
    const magnitudeChange = Math.abs(currentMagnitude - previousMagnitude);
    
    movementHistory.push(magnitudeChange);
    if (movementHistory.length > 5) {
        movementHistory.shift();
    }

    const avgMovement = movementHistory.reduce((a, b) => a + b, 0) / movementHistory.length;
    
    const baseThreshold = 0.10;
    const threshold = isActiveMode ? baseThreshold * 0.6 : baseThreshold;
    
    const movementStatus = document.getElementById('movementStatus');
    const isMoving = avgMovement > threshold;

    if (isMoving) {
        movementStatus.textContent = 'Active Movement Detected';
        movementStatus.className = 'movement-status moving';
        
        if (autoModeEnabled && !isActiveMode) {
            setMode('active');
        }
    } else {
        movementStatus.textContent = 'Subject at Rest';
        movementStatus.className = 'movement-status rest';
        
        if (autoModeEnabled && isActiveMode && avgMovement < threshold * 0.4) {
            setMode('rest');
        }
    }

    previousMagnitude = currentMagnitude;
}

/**
 * Update temperature health status
 */
function updateTemperatureStatus(avgTemp) {
    const tempRange = isActiveMode ? healthRanges.tempActive : healthRanges.tempRest;
    const tempStatus = document.getElementById('tempStatus');
    
    if (avgTemp >= tempRange.min && avgTemp <= tempRange.max) {
        tempStatus.textContent = 'Normal';
        tempStatus.className = 'health-status normal';
    } else if (avgTemp < tempRange.min - 1 || avgTemp > tempRange.max + 1) {
        tempStatus.textContent = 'Alert';
        tempStatus.className = 'health-status danger';
    } else {
        tempStatus.textContent = 'Monitor';
        tempStatus.className = 'health-status warning';
    }
}

/**
 * Update heart rate health status
 */
function updateHeartRateStatus(estimatedHR) {
    const hrRange = isActiveMode ? healthRanges.hrActive : healthRanges.hrRest;
    const hrStatus = document.getElementById('hrStatus');
    
    if (estimatedHR >= hrRange.min && estimatedHR <= hrRange.max) {
        hrStatus.textContent = 'Normal';
        hrStatus.className = 'health-status normal';
    } else if (estimatedHR < hrRange.min - 10 || estimatedHR > hrRange.max + 10) {
        hrStatus.textContent = 'Alert';
        hrStatus.className = 'health-status danger';
    } else {
        hrStatus.textContent = 'Monitor';
        hrStatus.className = 'health-status warning';
    }
}

/**
 * Set activity mode
 */
function setMode(mode) {
    isActiveMode = (mode === 'active');
    
    const modeDisplay = document.getElementById('modeDisplay');
    const modeLabel = document.getElementById('modeLabel');
    
    if (isActiveMode) {
        modeLabel.textContent = 'ACTIVE';
        modeLabel.className = 'mode-label active';
        modeDisplay.className = 'mode-display active';
        modeDisplay.innerHTML = '<span class="mode-label active">ACTIVE</span><span>Biometric thresholds adjusted for exercise state</span>';
    } else {
        modeLabel.textContent = 'AT REST';
        modeLabel.className = 'mode-label';
        modeDisplay.className = 'mode-display';
        modeDisplay.innerHTML = '<span class="mode-label">AT REST</span><span>Biometric thresholds adjusted for resting state</span>';
    }
    
    console.log('Mode switched to:', mode);
}

/**
 * Toggle automatic mode detection
 */
function toggleAutoMode() {
    autoModeEnabled = document.getElementById('autoModeToggle').checked;
    console.log('Automatic mode detection:', autoModeEnabled ? 'enabled' : 'disabled');
}

/**
 * Update health ranges
 */
function updateHealthRanges() {
    const breed = document.getElementById('breedSelect').value;
    const weight = parseInt(document.getElementById('weightInput').value);
    const age = parseInt(document.getElementById('ageInput').value);
    const size = document.getElementById('sizeSelect').value;

    const breedInfo = breedData[breed];
    
    let hrRestMin, hrRestMax, hrActiveMin, hrActiveMax;
    
    if (size === 'small') {
        hrRestMin = 90;
        hrRestMax = 140;
        hrActiveMin = 140;
        hrActiveMax = 220;
    } else if (size === 'medium') {
        hrRestMin = 70;
        hrRestMax = 110;
        hrActiveMin = 110;
        hrActiveMax = 180;
    } else if (size === 'large') {
        hrRestMin = 60;
        hrRestMax = 100;
        hrActiveMin = 100;
        hrActiveMax = 160;
    } else {
        hrRestMin = 50;
        hrRestMax = 90;
        hrActiveMin = 90;
        hrActiveMax = 140;
    }

    if (age < 2 || age > 10) {
        hrRestMin += 10;
        hrRestMax += 10;
    }

    const tempAdjust = breedInfo.tempAdjust;
    const tempRestMin = 101.0 + tempAdjust;
    const tempRestMax = 102.5 + tempAdjust;
    const tempActiveMin = 102.0 + tempAdjust;
    const tempActiveMax = 103.5 + tempAdjust;

    healthRanges = {
        tempRest: { min: tempRestMin, max: tempRestMax },
        tempActive: { min: tempActiveMin, max: tempActiveMax },
        hrRest: { min: hrRestMin, max: hrRestMax },
        hrActive: { min: hrActiveMin, max: hrActiveMax }
    };

    document.getElementById('tempRestRange').textContent = 
        `${tempRestMin.toFixed(1)} - ${tempRestMax.toFixed(1)}°F`;
    document.getElementById('tempActiveRange').textContent = 
        `${tempActiveMin.toFixed(1)} - ${tempActiveMax.toFixed(1)}°F`;
    document.getElementById('hrRestRange').textContent = 
        `${hrRestMin} - ${hrRestMax} BPM`;
    document.getElementById('hrActiveRange').textContent = 
        `${hrActiveMin} - ${hrActiveMax} BPM`;

    console.log('Health ranges updated:', healthRanges);
}

// Initialize application when page loads
window.addEventListener('DOMContentLoaded', initializeApp);
