// === SELECT ELEMENTS ===
const lanes = document.querySelectorAll('.lane');
const sidebar = document.querySelector('.sidebar');

// === STATE TRACKING ===
let vehicleCounts = { xtop: 0, xbottom: 0, yleft: 0, yright: 0, '-xtop': 0, '-xbottom': 0, '-yleft': 0, '-yright': 0 };
let ambulanceCounts = { xtop: 0, xbottom: 0, yleft: 0, yright: 0, '-xtop': 0, '-xbottom': 0, '-yleft': 0, '-yright': 0 };
let vehicleElements = { xtop: [], xbottom: [], yleft: [], yright: [], '-xtop': [], '-xbottom': [], '-yleft': [], '-yright': [] };

// === TIMING CONFIG (ms) ===
const GREEN_DURATION_MS = 1000; // 10 seconds
const YELLOW_DURATION_MS = 150; // 1.5 seconds

// === DRAG & DROP SETUP ===
document.querySelectorAll('.vehicle').forEach(vehicle => {
  vehicle.addEventListener('dragstart', e => {
    e.dataTransfer.setData('vehicleType', e.target.id); // id = car/bike/ambulance
  });
});

lanes.forEach(lane => {
  lane.addEventListener('dragover', e => e.preventDefault());
  lane.addEventListener('drop', e => {
    e.preventDefault();
    const vehicleType = e.dataTransfer.getData('vehicleType');
    const laneId = lane.dataset.lane;
    addVehicleToLane(laneId, vehicleType);
  });
});

// === ADD VEHICLE TO LANE ===
function addVehicleToLane(laneId, vehicleType) {
  const img = document.createElement('img');
  img.src = `${vehicleType}.png`;
  img.alt = vehicleType;
  img.classList.add('vehicle-in-lane', vehicleType);

  const count = vehicleCounts[laneId] || 0;
  const svg = document.querySelector('svg');
  let x, y, rotation;

  // Positioning by lane
  if (laneId === '-xtop') {
    x = 345 - count * 55;
    y = 380;
  } else if (laneId === 'xtop') {
    x = 600 + count * 55;
    y = 380;
  } else if (laneId === 'xbottom') {
    x = 600 + count * 55;
    y = 530;
    rotation = 180;
  } else if (laneId === '-xbottom') {
    x = 345 - count * 55;
    y = 530;
    rotation = 180;
  } else if (laneId === '-yleft') {
    x = 430;
    y = 690 + count * 100;
    rotation = -90;
  } else if (laneId === 'yleft') {
    x = 430;
    y = 230 - count*100;
    rotation = -90;
  } else if (laneId === 'yright') {
    x = 510;
    y = 230 - count * 100;
    rotation = 90;
  } else if (laneId === '-yright') {
    x = 510;
    y = 690 + count * 100;
    rotation = 90;
  } else {
    console.warn('Unknown lane:', laneId);
    return;
  }

  // Convert SVG coordinates to CSS pixels
  const svgRect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const scaleX = svgRect.width / viewBox.width;
  const scaleY = svgRect.height / viewBox.height;
  const cssX = x * scaleX;
  const cssY = y * scaleY;

  // Vehicle styling
  img.style.position = 'absolute';
  img.style.left = `${cssX}px`;
  img.style.top = `${cssY}px`;

  if (vehicleType === 'bike') {
    img.style.width = '60px';
  } else if (vehicleType === 'truck') {
    img.style.width = '90px';
  } else {
    img.style.width = '80px';
  }

  img.style.height = 'auto';
  img.style.transform = `rotate(${rotation || 0}deg)`;
  img.style.transition = 'transform 2s, left 2s, top 2s';

  img.dataset.lane = laneId;
  document.querySelector('.junction').appendChild(img);

  // Update counters
  vehicleCounts[laneId] = (vehicleCounts[laneId] || 0) + 1;
  vehicleElements[laneId].push(img);
  if (vehicleType === 'ambulance') {
    ambulanceCounts[laneId] = (ambulanceCounts[laneId] || 0) + 1;
  }
}

// === LIGHT MAPPING ===
const laneToLight = {
  xtop: 'top-light',
  '-xtop': 'top-light',
  xbottom: 'bottom-light',
  '-xbottom': 'bottom-light',
  yleft: 'left-light',
  '-yleft': 'left-light',
  yright: 'right-light',
  '-yright': 'right-light'
};

// === TRAFFIC LIGHT CONTROL FUNCTIONS ===

// Clear all traffic light active states
function clearAllLights() {
  document.querySelectorAll('.traffic-light circle').forEach(c => {
    c.classList.remove('active');
  });
}

// Set a specific lane's traffic light to a color ('green', 'yellow', or 'red')
function setTrafficLightColor(laneId, color) {
  const lightClass = laneToLight[laneId];
  if (!lightClass) return;
  
  const group = document.querySelector(`.traffic-light.${lightClass}`);
  if (!group) return;

  // Remove active from all bulbs in this group
  group.querySelectorAll('circle').forEach(c => c.classList.remove('active'));

  // Add active to the target color bulb
  const bulb = group.querySelector(`.${color}`);
  if (bulb) bulb.classList.add('active');
}

// === TRAFFIC CONTROL STATE ===
let isRunning = false;
let stopRequested = false;

// === HELPER: Check if any vehicles remain ===
function hasVehicles() {
  for (let lane in vehicleCounts) {
    if (vehicleCounts[lane] > 0) return true;
  }
  return false;
}

// === LANE PAIRING ===
const lanePairs = {
  'xtop': '-xtop',
  '-xtop': 'xtop',
  'xbottom': '-xbottom',
  '-xbottom': 'xbottom',
  'yright': '-yright',
  '-yright': 'yright',
  'yleft': '-yleft',
  '-yleft': 'yleft'
};

// === HELPER: Get paired lane ===
function getPairedLane(lane) {
  return lanePairs[lane];
}

// === HELPER: Run one traffic cycle ===
async function runTrafficCycle() {
  // Choose prioritized lane: ambulance first, else lane with most vehicles
  let prioritizedLane = null;

  // Check for ambulances first
  for (let lane in ambulanceCounts) {
    if (ambulanceCounts[lane] > 0) {
      prioritizedLane = lane;
      break;
    }
  }

  // If no ambulance, choose lane with most vehicles
  if (!prioritizedLane) {
    let max = 0;
    for (let lane in vehicleCounts) {
      if ((vehicleCounts[lane] || 0) > max) {
        max = vehicleCounts[lane];
        prioritizedLane = lane;
      }
    }
  }

  // If no vehicles anywhere, set all lights to red and stop
  if (!prioritizedLane || (vehicleCounts[prioritizedLane] || 0) === 0) {
    for (let lane in vehicleCounts) {
      setTrafficLightColor(lane, 'red');
    }
    return false; // Signal to stop cycling
  }

  // Get the paired lane
  const pairedLane = getPairedLane(prioritizedLane);

  // 1) Set both prioritized lane and its pair to GREEN and move their vehicles
  setTrafficLightColor(prioritizedLane, 'green');
  setTrafficLightColor(pairedLane, 'green');
  
  // Move both lanes simultaneously
  moveVehicles(prioritizedLane);
  moveVehicles(pairedLane);

  // 2) Set all other lanes based on their vehicle counts
  for (let lane in vehicleCounts) {
    if (lane === prioritizedLane || lane === pairedLane) continue;
    
    // If lane has no vehicles, set to RED
    if (!vehicleCounts[lane] || vehicleCounts[lane] === 0) {
      setTrafficLightColor(lane, 'red');
    } else {
      // Lanes with vehicles but not prioritized: turn off their lights
      const lightClass = laneToLight[lane];
      if (lightClass) {
        const group = document.querySelector(`.traffic-light.${lightClass}`);
        if (group) {
          group.querySelectorAll('circle').forEach(c => c.classList.remove('active'));
        }
      }
    }
  }

  // 3) Wait for green duration, then switch to yellow
  await new Promise(resolve => setTimeout(resolve, GREEN_DURATION_MS));
  setTrafficLightColor(prioritizedLane, 'yellow');
  setTrafficLightColor(pairedLane, 'yellow');

  // 4) Wait for yellow duration, then switch to red
  await new Promise(resolve => setTimeout(resolve, YELLOW_DURATION_MS));
  setTrafficLightColor(prioritizedLane, 'red');
  setTrafficLightColor(pairedLane, 'red');
  
  console.log('Traffic cycle completed for lanes:', prioritizedLane, 'and', pairedLane);
  
  return true; // Continue cycling
}

// === RUN BUTTON - Continuous Traffic Light Logic ===
document.getElementById('run').addEventListener('click', async () => {
  // If already running, ignore
  if (isRunning) return;
  
  isRunning = true;
  stopRequested = false;
  
  // Continue running cycles until no vehicles remain
  while (hasVehicles() && !stopRequested) {
    const shouldContinue = await runTrafficCycle();
    if (!shouldContinue) break;
    
    // Small delay between cycles
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // All vehicles cleared or stopped
  isRunning = false;
  console.log('Traffic simulation completed - all vehicles cleared');
});

// === RANDOM BUTTON ===
document.getElementById('random').addEventListener('click', () => {
  const vehicleTypes = ['car', 'bike', 'ambulance', 'truck'];
  lanes.forEach(lane => {
    const numVehicles = Math.floor(Math.random() * 3) + 1; // 1-3 vehicles
    const laneId = lane.dataset.lane;
    for (let i = 0; i < numVehicles; i++) {
      const vType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      addVehicleToLane(laneId, vType);
    }
  });
});

// === DELETE BUTTON ===
document.getElementById('delete').addEventListener('click', () => {
  // Remove all vehicles
  for (let lane in vehicleElements) {
    vehicleElements[lane].forEach(v => v.remove());
    vehicleCounts[lane] = 0;
    ambulanceCounts[lane] = 0;
    vehicleElements[lane] = [];
  }

  // Reset all traffic lights
  clearAllLights();
});

// === MOVE VEHICLES ===
function moveVehicles(targetLane) {
  if (!targetLane) return;
  
  const vehicles = vehicleElements[targetLane] || [];
  
  vehicles.forEach(vehicle => {
    let moveX = 0, moveY = 0;
    
    // Determine movement direction based on lane
    switch (targetLane) { 
      case 'xtop': moveX = window.innerWidth; break;
      case '-xtop': moveX = window.innerWidth; break;
      case 'xbottom': moveX = -window.innerWidth; break;
      case '-xbottom': moveX = -window.innerWidth; break;
      case 'yleft': moveY = -window.innerHeight; break;
      case '-yleft': moveY = -window.innerHeight; break;
      case 'yright': moveY = window.innerHeight; break;
      case '-yright': moveY = window.innerHeight; break;
    }

    const currentLeft = parseFloat(vehicle.style.left) || 0;
    const currentTop = parseFloat(vehicle.style.top) || 0;
    
    vehicle.style.transition = 'all 5s linear';
    vehicle.style.left = `${currentLeft + moveX}px`;
    vehicle.style.top = `${currentTop + moveY}px`;
  });

  // Clear the lane after moving vehicles
  setTimeout(() => {
    vehicles.forEach(v => v.remove());
    vehicleElements[targetLane] = [];
    vehicleCounts[targetLane] = 0;
    ambulanceCounts[targetLane] = 0;
  }, 5000); // Wait for animation to complete
}

console.log('Traffic Junction System Initialized');