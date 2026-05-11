// --- 1. Global Error Handling & Utilities ---

function showError(message, type = 'error') {
    const errDiv = document.getElementById('errorOverride');
    const errMsg = document.getElementById('errorMessage');
    
    if (errDiv && errMsg) {
        errMsg.innerHTML = `<strong>${type === 'error' ? 'System Error' : 'Notice'}:</strong> ${message}`;
        errDiv.className = type; 
        errDiv.style.display = 'block';
        if (type === 'warning') { setTimeout(() => { errDiv.style.display = 'none'; }, 5000); }
    }
    console.error(`[${type.toUpperCase()}] ${message}`);
}

function showLoadingScreen(customMessage) {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        const title = document.getElementById('splash-message');
        if (title) title.innerText = customMessage || "Loading...";
        splash.classList.remove('hidden');
        splash.style.display = 'flex';
    }
}

function hideLoadingScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => { splash.style.display = 'none'; }, 1000); 
    }
}

window.addEventListener('offline', () => { showError("Internet connection lost. Map data may not load.", 'error'); });
window.addEventListener('online', () => {
    showError("Internet connection restored. Refreshing data...", 'warning');
    setTimeout(() => { document.getElementById('errorOverride').style.display = 'none'; fetchAndRefreshData(); }, 2000);
});

// ==========================================
// PDF & SHARE BUTTON FUNCTIONS
// ==========================================

window.downloadPopupPDF = function(button) {
    try {
        const container = button.closest('.popup-container');
        if (!container) throw new Error("Popup content not found.");

        const element = container.cloneNode(true);
        
        const actionsMenu = element.querySelector('.popup-actions');
        if(actionsMenu) actionsMenu.remove(); 

        const scrollContainer = element.querySelector('.popup-scroll-container');
        if(scrollContainer) { scrollContainer.style.maxHeight = 'none'; scrollContainer.style.overflow = 'visible'; }

        const originalBtnText = button.innerText;
        button.innerText = "Generating..."; button.disabled = true;

        const opt = { margin: 10, filename: 'LIGTAS-Advisory_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };

        html2pdf().from(element).set(opt).save()
            .then(() => { button.innerText = originalBtnText; button.disabled = false; })
            .catch(err => { console.error("PDF Error:", err); showError("Failed to generate PDF.", 'warning'); button.innerText = "Retry PDF"; button.disabled = false; });

    } catch (e) { console.error(e); showError("Could not initiate PDF download."); }
};

window.sharePopupData = function(button) {
    const container = button.closest('.popup-container');
    const headerTitle = container.querySelector('.popup-header').innerText;
    
    const shareText = `Alert: Check out this LIGTAS-AGAD Warning Advisory regarding "${headerTitle}". View full real-time details here: ${window.location.href}`;

    if (navigator.share) {
        navigator.share({
            title: 'LIGTAS-AGAD Advisory',
            text: shareText,
            url: window.location.href
        }).catch(err => console.error("User cancelled share or share failed", err));
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            alert("Information copied to clipboard! You can now paste it directly into Facebook, Twitter, or Messenger.");
        }).catch(err => {
            showError("Failed to copy to clipboard.");
        });
    }
};

window.showImage = function(src, alt) {
    if (!src || src.includes('undefined') || src === '') return;
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById("img01");
    const captionText = document.getElementById("caption");
    modalImg.style.display = 'block';
    modalImg.onload = function() { modal.style.display = "block"; captionText.innerHTML = alt || "Image View"; };
    modalImg.onerror = function() { showError("Failed to load image high-resolution view.", 'warning'); modal.style.display = "none"; };
    modalImg.src = src;
}

setTimeout(hideLoadingScreen, 15000); 

// --- 2. UI Logic & Property Formatting ---

var cachedAWSData = []; 
var landslideFeatures = []; 

function updateClock() {
    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-PH');
        const timeText = `${dateStr} | ${timeStr}`;
        const elDesktop = document.getElementById('real-time'); const elMobile = document.getElementById('real-time-mobile');
        if(elDesktop) elDesktop.textContent = timeText; if(elMobile) elMobile.textContent = timeText;
    } catch(e) { }
}
setInterval(updateClock, 1000); updateClock(); 

function Homebutton() { window.location.href = '';  }
function AWSbutton() { window.location.href = 'https://gabzrock.github.io/LIGTAS-AGADLandslide-Warning-Advisories/'; }

function formatPropertyName(key) {
    if (!key) return 'Unknown';
    const k = String(key).toLowerCase().trim();
    if (k === 'rating' || k.includes('suscept')) return 'Rating';
    if (k === 'brgy' || k === 'barangay' || k === 'name_3' || k.includes('adm4')) return 'Barangay';
    if (k.includes('area') || k === 'ha' || k.includes('hectare')) return 'Distance in hectares';
    if (k === 'mun' || k === 'muni' || k.includes('municipali') || k === 'name_2' || k.includes('adm3')) return 'Municipality';
    if (k === 'prov' || k.includes('province') || k === 'name_1' || k.includes('adm2')) return 'Province';
    if (k === 'reg' || k === 'region' || k === 'name_0' || k.includes('adm1')) return 'Region';
    return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatPropertyValue(key, value) {
    if (value === null || value === undefined) return 'N/A';
    const k = String(key).toLowerCase().trim();
    const v = String(value).toLowerCase().trim();
    if (k === 'rating' || k.includes('suscept')) {
        if (v === 'high' || v.includes('high')) return 'High Susceptibility';
        if (v === 'moderate' || v === 'med' || v.includes('mod')) return 'Moderate Susceptibility';
        if (v === 'low' || v.includes('low')) return 'Low Susceptibility';
    }
    return value;
}

function updatePropertiesTable(layerName, properties) {
    const tableBody = document.getElementById('propertiesTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = ''; 

    if (!properties || Object.keys(properties).length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#666;">No properties available.</td></tr>';
        return;
    }

    try {
        for (const [key, value] of Object.entries(properties)) {
            const kLower = String(key).toLowerCase().trim();
            if (['objectid', 'fid', 'shape_length', 'shape_area', 'id'].includes(kLower)) continue;
            const displayKey = formatPropertyName(key); let displayValue = formatPropertyValue(key, value);
            if (typeof displayValue === 'object' && displayValue !== null) displayValue = JSON.stringify(displayValue);
            const row = document.createElement('tr');
            row.innerHTML = `<td><strong>${layerName}</strong></td><td>${displayKey}</td><td>${displayValue}</td>`;
            tableBody.appendChild(row);
        }
    } catch (e) { console.error("Error updating table", e); }
}

// --- 3. Map Initialization & Drawing Controls ---

const initialCenter = [12.8797, 121.7740];
const initialZoom = 6;
let map; let baseLayersData = {}; let layerControl; 

try {
    if (typeof L === 'undefined') throw new Error("Leaflet library not found.");
    
    map = L.map('map').setView(initialCenter, initialZoom); 
    
    baseLayersData = {
        "Streets": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }),
        "Hybrid": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }),
        "Topo": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' })
    };
    baseLayersData["Hybrid"].addTo(map);

    L.control.scale().addTo(map); L.control.locate().addTo(map);
    
    layerControl = L.control.layers(baseLayersData, {}, { collapsed: true, position: 'topright' }).addTo(map);
    
    if (typeof L.Control.Draw !== 'undefined') {
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        layerControl.addOverlay(drawnItems, "My Drawings");

        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems },
            draw: { polygon: true, polyline: true, rectangle: true, circle: true, marker: true, circlemarker: false }
        });
        map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (event) {
            const layer = event.layer;
            const type = event.layerType;

            // If the user drew a marker, grab coordinates and fetch elevation
            if (type === 'marker') {
                const latlng = layer.getLatLng();
                const lat = latlng.lat.toFixed(5);
                const lng = latlng.lng.toFixed(5);
                
                // 1. Show the popup immediately with a "Fetching" loading state
                const initialPopup = `
                    <div style="text-align:center; font-family:inherit; min-width: 160px;">
                        <strong style="color:var(--primary-color); font-size:1.1rem;">📍 Location Pin</strong>
                        <hr style="margin:5px 0; border:0; border-top:1px solid #ddd;">
                        <strong>Latitude:</strong> ${lat}<br>
                        <strong>Longitude:</strong> ${lng}<br>
                        <strong>Elevation:</strong> <span style="color:#FFA500;">Fetching... ⏳</span>
                    </div>
                `;
                
                layer.bindPopup(initialPopup);
                drawnItems.addLayer(layer);
                layer.openPopup();

                // 2. Request topographic elevation data in the background
                fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`)
                    .then(response => response.json())
                    .then(data => {
                        const elevation = data.results[0].elevation;
                        
                        // 3. Update the popup automatically when the data arrives
                        layer.setPopupContent(`
                            <div style="text-align:center; font-family:inherit; min-width: 160px;">
                                <strong style="color:var(--primary-color); font-size:1.1rem;">📍 Location Pin</strong>
                                <hr style="margin:5px 0; border:0; border-top:1px solid #ddd;">
                                <strong>Latitude:</strong> ${lat}<br>
                                <strong>Longitude:</strong> ${lng}<br>
                                <strong>Elevation:</strong> ${elevation.toFixed(1)} meters
                            </div>
                        `);
                    })
                    .catch(error => {
                        // Fallback just in case the elevation server is offline
                        layer.setPopupContent(`
                            <div style="text-align:center; font-family:inherit; min-width: 160px;">
                                <strong style="color:var(--primary-color); font-size:1.1rem;">📍 Location Pin</strong>
                                <hr style="margin:5px 0; border:0; border-top:1px solid #ddd;">
                                <strong>Latitude:</strong> ${lat}<br>
                                <strong>Longitude:</strong> ${lng}<br>
                                <strong>Elevation:</strong> <span style="color:red;">Unavailable</span>
                            </div>
                        `);
                        console.warn("Could not retrieve elevation data.", error);
                    });
            } else {
                // For other drawn items (polygons, lines), just add them normally
                drawnItems.addLayer(layer);
            }
        });
    }

    map.on('locationfound', function(e) {
        hideLoadingScreen(); 
        const latlng = e.latlng;
        const priorityStation = findPriorityStationNearby(latlng, 20); 
        const lsCount = getNearbyLandslideCount(latlng, 5); 
        const userProperties = { "Location Type": "User Current Location", "Latitude": latlng.lat.toFixed(5), "Longitude": latlng.lng.toFixed(5) };
        const reportContent = generateCombinedReport("User Location", userProperties, priorityStation, lsCount);
        L.popup().setLatLng(latlng).setContent(reportContent).openOn(map);
        updatePropertiesTable("User Location", userProperties);
    });
    
    map.on('locationerror', function(e) { hideLoadingScreen(); showError("Could not acquire GPS location. Check permissions.", 'warning'); });
    
    L.Control.ResetView = L.Control.extend({
        onAdd: map => {
            const c = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            c.style.backgroundColor = 'white'; c.style.width = '30px'; c.style.height = '30px'; c.style.cursor = 'pointer';
            c.innerHTML = '<span style="font-size:20px; line-height:30px; display:block; text-align:center;">🏠</span>'; c.title = "Reset View";
            c.onclick = () => map.setView(initialCenter, initialZoom);
            return c;
        }
    });
    map.addControl(new L.Control.ResetView({ position: 'topleft' }));
  
// --- NEW: Custom Image GPS Location Button (With Close Button) ---
    L.Control.GPSButton = L.Control.extend({
        onAdd: map => {
            // Create the main container
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control gps-image-btn');
            
            // Create the main GPS image element
            const img = L.DomUtil.create('img', '', container);
            img.src = 'https://raw.githubusercontent.com/LIGTAS-AGAD/ligtas-agad-rilews-v-15-mobile-edition/refs/heads/main/ISLAW2.png'; 
            img.title = "Assess My Current Location";
            
            // Create the tiny Close 'X' button
            const closeBtn = L.DomUtil.create('div', 'gps-close-btn', container);
            closeBtn.innerHTML = '×';
            closeBtn.title = "Hide GPS Button";

            // LOGIC 1: Trigger GPS when the main icon is clicked
            img.onclick = (e) => {
                L.DomEvent.stopPropagation(e);
                showLoadingScreen("Acquiring GPS Signal..."); 
                map.locate({setView: true, maxZoom: 16, timeout: 10000});
            };

            // LOGIC 2: Remove the entire container when the 'X' is clicked
            closeBtn.onclick = (e) => {
                L.DomEvent.stopPropagation(e); // Stops the click from bleeding through to the map
                container.remove();            // Instantly deletes the button from the screen
            };
            
            return container;
        }
    });
    // Add the button to the map (topright so we can middle-center it via CSS)
    map.addControl(new L.Control.GPSButton({ position: 'topright' }));

} catch (e) { console.error("Map failed to initialize", e); showError("Map failed to load.", 'error'); }

// --- 4. GeoJSON Layers & Legend Data ---

var overlays = {};
const layerData = [
    { name: 'LIGTAS-LSDB', desc: 'Recorded Landslides', color: 'orange' }, 
    { name: 'MGB-HIGH', desc: 'HIGH Susceptibility', color: 'red' }, 
    { name: 'MGB-MED', desc: 'MED Susceptibility', color: 'yellow' }, 
    { name: 'MGB-LOW', desc: 'LOW Susceptibility', color: 'green' },
    { name: 'LIGTAS AWS', desc: 'Monitoring Station', color: 'white' },
    { name: 'SARAI AWS', desc: 'Monitoring Station', color: 'white' },
    { name: 'ASTI AWS', desc: 'Monitoring Station', color: 'white' },
    { name: 'PAGASA AWS', desc: 'Monitoring Station', color: 'white' },
    { name: 'Yellow buffer', desc: 'Warning Level 1 (20km)', color: 'yellow' },
    { name: 'Orange buffer', desc: 'Warning Level 2 (20km)', color: 'orange' },
    { name: 'Red buffer', desc: 'Warning Level 3 (20km)', color: 'red' }
];

const layerLogos = [
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/Landslide-icon.png', 
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/logo3.png', 
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/logo3.png', 
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/logo3.png', 
    'https://ligtas.uplb.edu.ph/wp-content/uploads/2022/04/3-e1659971771933.png', 
    'https://ligtas.uplb.edu.ph/wp-content/uploads/2022/02/SARAI.png', 
    'https://ligtas.uplb.edu.ph/wp-content/uploads/2022/10/DOST-ASTI-Logo-RGB-e1722929759841.png',
    'https://raw.githubusercontent.com/Gabzrock/LIGTASkanaba/refs/heads/main/LOGO2.png', 
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/layer_layers_icon_193964.png',
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/layer_layers_icon_193964.png',
    'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/layer_layers_icon_193964.png'
];

function findPriorityStationNearby(latlng, maxRadiusKm = 20) {
    if (!cachedAWSData || cachedAWSData.length === 0) return null;
    let priorityStation = null; let highestWarningLevel = -1; let minDistanceForHighest = Infinity;
    let absoluteNearest = null; let absoluteMinDist = Infinity;
    try {
        cachedAWSData.forEach(station => {
            const lat = parseFloat(station.Latitude); const lng = parseFloat(station.Longitude);
            if(isNaN(lat) || isNaN(lng)) return;
            const slatlng = L.latLng(lat, lng); const distKm = latlng.distanceTo(slatlng) / 1000;
            if (distKm < absoluteMinDist) { absoluteMinDist = distKm; absoluteNearest = { ...station, distance: distKm.toFixed(2) }; }
            if (distKm <= maxRadiusKm) {
                const rawLevel = String(station.RainfallLandslidethresholdwarninglevel).trim().toLowerCase();
                let level = parseInt(rawLevel); if (isNaN(level)) level = 0; 
                if (level > highestWarningLevel || (level === highestWarningLevel && distKm < minDistanceForHighest)) {
                    highestWarningLevel = level; minDistanceForHighest = distKm; priorityStation = { ...station, distance: distKm.toFixed(2) };
                }
            }
        });
    } catch(e) { }
    return priorityStation || absoluteNearest;
}

function getNearbyLandslideCount(latlng, radiusKm = 5) {
    if (!landslideFeatures || landslideFeatures.length === 0) return 0;
    let count = 0;
    landslideFeatures.forEach(feature => {
        if (feature.geometry && feature.geometry.type === 'Point') {
            const coords = feature.geometry.coordinates; const lLatLng = L.latLng(coords[1], coords[0]);
            if (latlng.distanceTo(lLatLng) <= (radiusKm * 1000)) { count++; }
        }
    });
    return count;
}

function generateCombinedReport(layerName, properties, nearestStation, landslideCount) {
    let susContent = '';
    for (const [key, value] of Object.entries(properties)) {
        const kLower = String(key).toLowerCase().trim();
        if (['objectid', 'fid', 'shape_length', 'shape_area', 'id'].includes(kLower)) continue;
        const displayKey = formatPropertyName(key); let displayValue = formatPropertyValue(key, value);
        if (typeof displayValue === 'string' && (displayValue.startsWith('http') || displayValue.startsWith('www'))) {
             displayValue = `<a href="${displayValue}" target="_blank" style="color:var(--primary-color); text-decoration:none; font-weight:bold;">View Link 🔗</a>`;
        }
        susContent += `<tr><th>${displayKey}</th><td>${displayValue}</td></tr>`;
    }

    let stationContent = '<tr><td colspan="2">No AWS Data Available</td></tr>';
    if (nearestStation) {
        const wLevel = nearestStation.RainfallLandslidethresholdwarninglevel;
        const color = wLevel == 1 ? 'yellow' : (wLevel == 2 ? 'orange' : (wLevel == 3 ? 'red' : 'green'));
        stationContent = `
            <tr><th>Nearest Station</th><td>${nearestStation.StationName || nearestStation.Station}</td></tr>
            <tr><th>Distance</th><td>${nearestStation.distance} km</td></tr>
            <tr><th>Warning Level</th><td style="background-color:${color}; font-weight:bold;">Level ${wLevel}</td></tr>
            <tr><th>Rainfall Accumulation(7-day)</th><td>${nearestStation.R24H || nearestStation.Rainfall || '0'} mm</td></tr>
            <tr><th>Latitude</th><td>${nearestStation.Latitude || 'N/A'}</td></tr>
            <tr><th>Longitude</th><td>${nearestStation.Longitude || 'N/A'}</td></tr>
            <tr><th>Elevation</th><td>${nearestStation.Elevation ? nearestStation.Elevation + ' m' : 'N/A'}</td></tr>
            <tr><th>Rec. Actions</th><td>${nearestStation.Recommendedactions || 'Monitor'}</td></tr>
        `;
    }
    let lsContent = `<tr><th>Nearby Landslides (5km)</th><td><b>${landslideCount}</b> recorded event(s)</td></tr>`;
    
    return `
        <div class="popup-container">
            <div class="popup-header">Combined Report</div>
            <div class="popup-scroll-container">
                <div class="popup-section-title">1. Location Details (${layerName})</div>
                <table class="popup-table">${susContent}</table>
                <div class="popup-section-title">2. Weather Status</div>
                <table class="popup-table">${stationContent}</table>
                <div class="popup-section-title">3. Historical Context</div>
                <table class="popup-table">${lsContent}</table>
            </div>
            <div class="popup-credits">Report Generated by <strong>DOST Project LIGTAS-AGAD RIILEWS</strong> (SESAM-UPLB)</div>
            <div class="popup-actions">
                <button class="pdf-btn" onclick="downloadPopupPDF(this)">📥 PDF</button>
                <button class="share-btn" onclick="sharePopupData(this)">📤 Share</button>
            </div>
        </div>
    `;
}

function createGeoJSONLayer(name, description, geojsonUrl, styleOptions = {}, iconUrl = null) {
    const fullName = `${name}: ${description}`;
    return fetch(geojsonUrl)
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
        .then(data => {
            if (name === 'LIGTAS-LSDB') landslideFeatures = data.features || [];

            const layer = L.geoJSON(data, {
                style: styleOptions,
                pointToLayer: (feature, latlng) => {
                    if (iconUrl) { return L.marker(latlng, { icon: L.icon({ iconUrl: iconUrl, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] }) }); } 
                    else { return L.circleMarker(latlng, { color: styleOptions.color || 'blue', fillColor: styleOptions.fillColor || styleOptions.color || 'blue', fillOpacity: styleOptions.fillOpacity || 0.8, radius: styleOptions.radius || 6, weight: styleOptions.weight || 1 }); }
                },
                onEachFeature: (feature, layer) => {
                    let popupRows = '';
                    if (feature.properties) {
                        for (const [key, value] of Object.entries(feature.properties)) {
                            const kLower = String(key).toLowerCase().trim();
                            if (['objectid', 'fid', 'shape_length', 'shape_area', 'id'].includes(kLower)) continue;
                            const displayKey = formatPropertyName(key); let displayValue = formatPropertyValue(key, value);
                            if (typeof displayValue === 'string' && (displayValue.startsWith('http') || displayValue.startsWith('https') || displayValue.startsWith('www'))) { displayValue = `<a href="${displayValue}" target="_blank" style="color:blue; text-decoration:underline;">View Link</a>`; }
                            popupRows += `<tr><th>${displayKey}</th><td>${displayValue}</td></tr>`;
                        }
                    }
                    const displayTitle = styleOptions.customPopupName || name;
                    
                    const popupContent = `
                        <div class="popup-container">
                            <div class="popup-header">${displayTitle}</div>
                            <div class="popup-scroll-container">
                                <table class="popup-table">${popupRows}</table>
                            </div>
                            <div class="popup-credits">Report Generated by <strong>DOST Project LIGTAS-AGAD RIILEWS</strong> (SESAM-UPLB)</div>
                            <div class="popup-actions">
                                <button class="pdf-btn" onclick="downloadPopupPDF(this)">📥 PDF</button>
                                <button class="share-btn" onclick="sharePopupData(this)">📤 Share</button>
                            </div>
                        </div>
                    `;
                    
                    layer.bindPopup(popupContent);
                    layer.on('click', (e) => { 
                        updatePropertiesTable(displayTitle, feature.properties);
                        if (name.includes('MGB') || name.includes('Susceptibility')) {
                            const priorityStation = findPriorityStationNearby(e.latlng, 20); 
                            const lsCount = getNearbyLandslideCount(e.latlng, 5); 
                            const reportContent = generateCombinedReport(displayTitle, feature.properties, priorityStation, lsCount);
                            L.popup().setLatLng(e.latlng).setContent(reportContent).openOn(map);
                        }
                    });
                }
            });
            
            overlays[fullName] = layer;
            if (layerControl) layerControl.addOverlay(layer, fullName);
            return layer;
        })
        .catch(error => { console.error(`Error loading ${name}:`, error); return null; });
}

const layerPromises = [
    createGeoJSONLayer('LIGTAS-LSDB', 'Recorded Landslides', 'https://raw.githubusercontent.com/Gabzrock/LIGTAS-AGAD/refs/heads/main/LandslideDB-web.geojson', { color: 'orange', fillColor: 'orange', fillOpacity: 0.8, radius: 6, weight: 1, className: 'flashing-high'}, null),
   createGeoJSONLayer('MGB-HIGH', 'Susceptibility', 'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/uRIL_AWS_High%20Susceptibility.geojson', { color: 'red', fillOpacity: 0.1, weight: 0.7, className: 'flashing-high', customPopupName: 'High Landslide Risk Area' }),
    createGeoJSONLayer('MGB-MED', 'Susceptibility', 'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/uRIL_AWS_Moderate_Susceptibility.geojson', { color: 'yellow', fillOpacity: 0.6 }),
    createGeoJSONLayer('MGB-LOW', 'Susceptibility', 'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADEWSV3/refs/heads/main/uRIL_AWS_Low_Susceptibility.geojson', { color: 'green', fillOpacity: 0.6 }),
    createGeoJSONLayer('PH-Boundary', 'Boundary', 'https://raw.githubusercontent.com/faeldon/philippines-json-maps/refs/heads/master/2023/geojson/country/hires/country.0.1.json', { color: 'white', fillOpacity: 0.1, weight: 0.2,}),
    createGeoJSONLayer('LIGTAS-AGAD sites', 'Boundary', 'https://raw.githubusercontent.com/Gabzrock/LIGTASAGADsites/refs/heads/main/LIGTAS-AGAD_sites2.geojson', { color: 'cyan', fillOpacity: 0.1, weight: 0.2,})
];

// --- 5. Synchronized AWS GeoJSON Layers ---

let synchronizedLayers = []; 

function initSynchronizedAWSLayer(targetAwsName, geojsonUrl, layerDisplayName) {
    fetch(geojsonUrl)
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
        .then(data => {
            const layer = L.geoJSON(data, {
                style: { color: '#808080', weight: 4, opacity: 0.8 }, 
                onEachFeature: (feature, layer) => { layer.bindPopup(`<b>${layerDisplayName}</b><br>Awaiting AWS synchronization...`); }
            }).addTo(map);

            synchronizedLayers.push({ targetAws: targetAwsName, layer: layer, name: layerDisplayName });
            overlays[layerDisplayName] = layer;
            if(layerControl) layerControl.addOverlay(layer, layerDisplayName);
            if (typeof initSidebarControls === 'function') initSidebarControls();
        })
        .catch(err => console.error(`Error loading synced layer ${layerDisplayName}:`, err));
}

function syncAwsLayersWithData() {
    if (!cachedAWSData || cachedAWSData.length === 0) return;
    synchronizedLayers.forEach(layerData => {
        const station = cachedAWSData.find(s => {
            const sName = String(s.StationName || s.Station || '').toLowerCase();
            return sName.includes(layerData.targetAws.toLowerCase());
        });
        if (station) {
            const rawLevel = String(station.RainfallLandslidethresholdwarninglevel).trim().toLowerCase();
            let warningLevel = parseInt(rawLevel); let targetColor = '#808080'; 
            if (warningLevel === 1) targetColor = 'yellow'; else if (warningLevel === 2) targetColor = 'orange'; else if (warningLevel === 3) targetColor = 'red'; else if (warningLevel === 0 || rawLevel === '0') targetColor = 'green'; 
            layerData.layer.setStyle({ color: targetColor, weight: 0.9, opacity: 0.9, dashArray: '5, 10'});
            layerData.layer.eachLayer(featureLayer => {
                featureLayer.setPopupContent(`
                    <div class="popup-container">
                        <div class="popup-header">${layerData.name}</div>
                        <table class="popup-table">
                            <tr><th>Linked Station</th><td>${station.StationName || station.Station}</td></tr>
                            <tr><th>Warning Level</th><td style="background-color:${targetColor}; font-weight:bold; color: ${warningLevel === 1 ? 'black' : 'white'};">Level ${warningLevel || rawLevel}</td></tr>
                            <tr><th>Rainfall Accumulation (7-day)</th><td>${station.Rainfall || station.R24H || 0} mm</td></tr>
                            <tr><th>Status</th><td>${station.Status || 'N/A'}</td></tr>
                        </table>
                        <div class="popup-credits">Report Generated by <strong>DOST Project LIGTAS-AGAD RIILEWS</strong> (SESAM-UPLB)</div>
                        <div class="popup-actions">
                            <button class="pdf-btn" onclick="downloadPopupPDF(this)">📥 PDF</button>
                            <button class="share-btn" onclick="sharePopupData(this)">📤 Share</button>
                        </div>
                    </div>
                `);
            });
        }
    });
}

// Example 1: Buguias Road Network
initSynchronizedAWSLayer(
    'Buguias', 
    'https://raw.githubusercontent.com/Gabzrock/AWS_BUFFER_CROPPED/refs/heads/main/LIGTAS_BUGUIAS_AWS.geojson',
    'Buguias AWS'
);
initSynchronizedAWSLayer(
    'Mankayan', 
    'https://raw.githubusercontent.com/Gabzrock/AWS_BUFFER_CROPPED/refs/heads/main/LIGTAS_MANKAYAN_AWS.geojson',
    'Mankayan AWS'
);
initSynchronizedAWSLayer(
    'Bokod', 
    'https://raw.githubusercontent.com/Gabzrock/AWS_BUFFER_CROPPED/refs/heads/main/LIGTAS_BOKOD_AWS.geojson',
    'Bokod AWS'
);
initSynchronizedAWSLayer(
    'Itogon', 
    'https://raw.githubusercontent.com/Gabzrock/AWS_BUFFER_CROPPED/refs/heads/main/LIGTAS_ITOGON_AWS.geojson',
    'Itogon AWS'
);
initSynchronizedAWSLayer(
    'Landgrant', 
    'https://raw.githubusercontent.com/Gabzrock/AWS_BUFFER_CROPPED/refs/heads/main/LIGTAS_LANDGRANT_AWS.geojson',
    'Landgrant AWS'
);

// --- 6. Controls Initialization ---
// Build the Modal Legend Content
const legendContainer = document.getElementById('legendModalContent');
if (legendContainer) {
    layerData.forEach((data, index) => {
        const logoSrc = layerLogos[index] || '';
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <img src="${logoSrc}" class="legend-logo" alt="icon">
            <div class="legend-swatch" style="background-color: ${data.color};"></div>
            <div class="legend-text"><strong>${data.name}</strong><br><span>${data.desc}</span></div>
        `;
        legendContainer.appendChild(item);
    });
}

const searchControl = new L.Control.Search({ url: 'https://nominatim.openstreetmap.org/search?format=json&q={s}', jsonpParam: 'json_callback', propertyName: 'display_name', propertyLoc: ['lat', 'lon'], marker: L.circleMarker([0, 0], { radius: 30, color: 'red' }), autoCollapse: true, autoType: false, minLength: 2 });
map.addControl(searchControl);

Promise.allSettled(layerPromises).then((results) => {
    hideLoadingScreen(); 
    setTimeout(() => { map.invalidateSize(); }, 500);

    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null));
    if (failed.length > 0) { showError(`${failed.length} layers failed to load. Check network.`, 'warning'); }

    try {
        if (overlays['LIGTAS-AGAD sites: Boundary']) map.addLayer(overlays['LIGTAS-AGAD sites: Boundary']);
        if (overlays['MGB-HIGH: Susceptibility']) map.addLayer(overlays['MGB-HIGH: Susceptibility']);
        initSidebarControls(); 
    } catch (e) { console.error("Error setting default layers", e); }
});

// --- 7. Data Fetching & Processing ---

const warningLayerGroup = L.layerGroup().addTo(map);
if (layerControl) { layerControl.addOverlay(warningLayerGroup, "20-KM Warning & AWS"); }

const googleSheetCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSosfBP3StMyRUzwI0tUZPsLjPVH1zePCz8gZbTMOzjOvnonbmNCoy5VT46UxO0qdqb-Wm9EqTpXp8y/pub?gid=470430875&single=true&output=csv';

function getBufferColor(warningLevel) { if (warningLevel === 1) return 'yellow'; if (warningLevel === 2) return 'orange'; if (warningLevel === 3) return 'red'; return null; }

function getStationIcon(stationName) {
    if (stationName && stationName.includes('ASTI')) return layerLogos[6];
    if (stationName && stationName.includes('SARAI')) return layerLogos[5];
    if (stationName && stationName.includes('PAGASA')) return layerLogos[7];
    return layerLogos[4]; 
}

function processAWSData(data) {
    if (!data) return;
    try { if (JSON.stringify(data) === JSON.stringify(cachedAWSData)) return; } catch(e) { }

    data.sort((a, b) => {
        let valA = parseInt(String(a.RainfallLandslidethresholdwarninglevel).trim()) || 0;
        let valB = parseInt(String(b.RainfallLandslidethresholdwarninglevel).trim()) || 0;
        return valA - valB; 
    });

    cachedAWSData = data; 
    warningLayerGroup.clearLayers(); 
    syncAwsLayersWithData();

    data.forEach(station => {
        try {
            var lat = parseFloat(station.Latitude); var lng = parseFloat(station.Longitude);
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

            var rawWarningLevel = String(station.RainfallLandslidethresholdwarninglevel).trim().toLowerCase();
            var warningLevel = parseInt(rawWarningLevel); var color = getBufferColor(warningLevel);
            
            if (rawWarningLevel === 'down') { } 
            else if (rawWarningLevel === 'n/a' || rawWarningLevel === '#value!') {
                var staticCircle = L.circle([lat, lng], { color: 'white', fillColor: 'transparent', fillOpacity: 0, radius: 20000, weight: 2, dashArray: '5, 10', interactive: false });
                warningLayerGroup.addLayer(staticCircle);
            } 
            else if (color) {
                var staticCircle = L.circle([lat, lng], { color: color, fillColor: color, fillOpacity: 0.05, radius: 20000, weight: 2, dashArray: '5, 10', interactive: false });
                warningLayerGroup.addLayer(staticCircle);
                var pulseCircle = L.circle([lat, lng], { color: color, fillColor: color, fillOpacity: 0.3, radius: 20000, weight: 1, className: 'pulse-layer', interactive: false });
                warningLayerGroup.addLayer(pulseCircle);
            }

            var iconUrl = getStationIcon(station.StationName);
            var markerZIndex = (isNaN(warningLevel) ? 0 : warningLevel) * 1000;
            var marker = L.marker([lat, lng], { icon: L.icon({ iconUrl: iconUrl, iconSize: [25, 25], iconAnchor: [12, 12] }), zIndexOffset: markerZIndex });

            var popupContent = `
                <div class="popup-container">
                    <div class="popup-header">${station.StationName || station.Station || 'Unknown Station'}</div>
                    <div class="popup-scroll-container">
                        <table class="popup-table">
                            <tr><th>Status</th><td>${station.Status || 'N/A'}</td></tr>
                            <tr><th>Location</th><td>${station.LocationDetails || station.Municipality || 'N/A'}</td></tr>
                            <tr><th>Latitude</th><td>${station.Latitude || 'N/A'}</td></tr>
                            <tr><th>Longitude</th><td>${station.Longitude || 'N/A'}</td></tr>
                            <tr><th>Elevation</th><td>${station.Elevation ? station.Elevation + ' m' : 'N/A'}</td></tr>
                            <tr><th>Rainfall Accumulation Total (7-day)</th><td>${station.Rainfall || station.R24H || '0'} mm</td></tr>
                            <tr><th>Warning Level</th><td>${station.RainfallLandslidethresholdwarninglevel || '0'}</td></tr>
                            <tr><th>Description</th><td>${station.Rainfalldescription || 'N/A'}</td></tr>
                            <tr><th>Scenario</th><td>${station.Possiblescenario || 'N/A'}</td></tr>
                            <tr><th>Actions</th><td>${station.Recommendedactions || 'N/A'}</td></tr>
                            <tr><th>Guide</th><td><img src="${station.Warninglevelguide || ''}" alt="Guide" onclick="showImage(this.src, 'Guide')" onerror="this.style.display='none'"/></td></tr>
                            <tr><th>Image</th><td><img src="${station.Imagelink || ''}" alt="Image" onclick="showImage(this.src, 'Station Image')" onerror="this.style.display='none'"/></td></tr>
                            <tr><th>Area</th><td>${station.Daterange || station.Municipality || 'N/A'}</td></tr>
                        </table>
                    </div>
                    <div class="popup-credits">Data & Station Alert maintained by <strong>DOST Project LIGTAS-AGAD RIILEWS</strong></div>
                    <div class="popup-actions">
                        <button class="pdf-btn" onclick="downloadPopupPDF(this)">📥 PDF</button>
                        <button class="share-btn" onclick="sharePopupData(this)">📤 Share</button>
                    </div>
                </div>`;
            
            marker.bindPopup(popupContent);
            marker.on('click', () => { updatePropertiesTable("AWS Station", station); });
            warningLayerGroup.addLayer(marker);
        } catch (err) { console.error("Error processing station:", station.StationName, err); }
    });
}

function fetchAndRefreshData() {
    fetch('')
        .then(response => { if (!response.ok) throw new Error("Sheetlabs fetch failed"); return response.json(); })
        .then(data => { processAWSData(data); })
        .catch(error => { 
            if (typeof Papa !== 'undefined') {
                Papa.parse(googleSheetCSV, {
                    download: true, header: true, skipEmptyLines: true,
                    complete: function(results) { processAWSData(results.data); },
                    error: function(err) { showError("Data connection lost. Retrying...", 'warning'); }
                });
            } else { showError("Critical library missing: PapaParse.", 'error'); }
        });
}
fetchAndRefreshData(); setInterval(fetchAndRefreshData, 60000);

// --- 8. Sidebar & Forecast Logic ---
const geojsonUrls = [
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_007-012_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_007-012_Bin6_100-200.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_013-018_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_025-030_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_031-036_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_049-054_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_055-060_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_055-060_Bin6_100-200.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_061-066_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_073-078_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_079-084_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_079-084_Bin6_100-200.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_097-102_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_097-102_Bin6_100-200.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_103-108_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_103-108_Bin6_100-200.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_109-114_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_121-126_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_127-132_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_127-132_Bin6_100-200.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_133-138_Bin5_50-100.geojson',
'https://raw.githubusercontent.com/LIGTAS-AGAD/upgraded-octo-pancake/refs/heads/main/6hr_Hours_139-144_Bin5_50-100.geojson'
];
const colors = ['yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow', 'orange', 'red', 'yellow'];
const rasterForecastUrls = [
    'https://raw.githubusercontent.com/Gabzrock/GE_experiments/refs/heads/main/ligtas_postwrf_d01_20230706_0000_f14300_rain_clipped.geojson',
    'https://placehold.co/800x600?text=Rainfall+Raster+Day+2', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+3', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+4', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+5', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+6', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+7', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+8', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+9', 'https://placehold.co/800x600?text=Rainfall+Raster+Day+10'
];

const rasterBounds = [[5, 115], [21, 127]];
let currentRasterLayer = null; let showRaster = false;
let forecastLayers = []; let currentGroupIndex = 0; let animationInterval; let isPlaying = false; let speed = 5000;

const slider = document.getElementById('speedSlider');
const output = document.getElementById('speedValue');
if (slider && output) {
    slider.oninput = function() {
        speed = this.value * 1000; output.innerHTML = this.value + "s";
        if(isPlaying) { clearInterval(animationInterval); startAnimation(); }
    }
}

function updateRaster(index) {
    if (!showRaster) { if (currentRasterLayer) { map.removeLayer(currentRasterLayer); currentRasterLayer = null; } return; }
    if (currentRasterLayer) map.removeLayer(currentRasterLayer);
    const imageUrl = rasterForecastUrls[index % rasterForecastUrls.length];
    currentRasterLayer = L.imageOverlay(imageUrl, rasterBounds, { opacity: 0.6, interactive: true, attribution: 'Rainfall Raster Forecast' });
    currentRasterLayer.on('error', function() { console.warn(`Raster image failed to load: ${imageUrl}`); });
    currentRasterLayer.addTo(map);
}

function showGroup(groupIndex) {
    forecastLayers.forEach(layer => map.removeLayer(layer)); forecastLayers = [];
    const startIndex = groupIndex * 22; const groupUrls = geojsonUrls.slice(startIndex, startIndex + 22);
    const cg = document.getElementById('currentGroup'); if(cg) cg.textContent = `Day: ${groupIndex + 1}`;

    groupUrls.forEach((url, i) => {
        fetch(url).then(res => res.json()).then(data => {
            const layer = L.geoJSON(data, {
                style: { color: colors[i], weight: 2, opacity: 0.7 },
                onEachFeature: (feature, layer) => { layer.on('click', (e) => { L.DomEvent.stopPropagation(e); updatePropertiesTable("PAGASA-WRF (layer " + (groupIndex + 1) + ")", feature.properties); }); }
            }).addTo(map);
            forecastLayers.push(layer);
        }).catch(err => console.log('Forecast data missing'));
    });
    updateRaster(groupIndex);
}

function startAnimation() {
    isPlaying = true;
    const playBtn = document.getElementById('playBtn'); if(playBtn) playBtn.style.background = '#e69500';
    if(forecastLayers.length === 0 && !currentRasterLayer) showGroup(currentGroupIndex);
    animationInterval = setInterval(() => { currentGroupIndex = (currentGroupIndex + 1) % 10; showGroup(currentGroupIndex); }, speed);
}

function stopAnimation() {
    isPlaying = false; clearInterval(animationInterval);
    const playBtn = document.getElementById('playBtn'); if(playBtn) playBtn.style.background = 'var(--primary-color)';
}

const pBtn = document.getElementById('playBtn'); if(pBtn) pBtn.onclick = () => { if (!isPlaying) startAnimation(); };
const psBtn = document.getElementById('pauseBtn'); if(psBtn) psBtn.onclick = stopAnimation;
const sBtn = document.getElementById('stopBtn'); if(sBtn) sBtn.onclick = () => {
    stopAnimation(); forecastLayers.forEach(layer => map.removeLayer(layer)); forecastLayers = [];
    if(currentRasterLayer) { map.removeLayer(currentRasterLayer); currentRasterLayer = null; }
    currentGroupIndex = 0; const cg = document.getElementById('currentGroup'); if(cg) cg.textContent = "Day: 1";
};
const nBtn = document.getElementById('nextBtn'); if(nBtn) nBtn.onclick = () => { stopAnimation(); currentGroupIndex = (currentGroupIndex + 1) % 10; showGroup(currentGroupIndex); };
const prBtn = document.getElementById('prevBtn'); if(prBtn) prBtn.onclick = () => { stopAnimation(); currentGroupIndex = (currentGroupIndex - 1 + 10) % 10; showGroup(currentGroupIndex); };

function initSidebarControls() {
    const container = document.getElementById('layerControls');
    if (!container) return;
    container.innerHTML = ''; 

    function createToggle(id, label, layerObj, onChangeOverride) {
        const div = document.createElement('div'); div.className = 'layer-item';
        const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.className = 'layer-toggle-input';
        
        if (layerObj) { input.checked = map.hasLayer(layerObj); }
        input.onchange = (e) => { 
            if (onChangeOverride) { onChangeOverride(e.target.checked); } 
            else if (layerObj) { e.target.checked ? map.addLayer(layerObj) : map.removeLayer(layerObj); }
        };

        const lbl = document.createElement('label'); lbl.htmlFor = id; lbl.innerText = label;
        div.appendChild(input); div.appendChild(lbl); container.appendChild(div);
        return input;
    }

    Object.keys(overlays).forEach((name, idx) => {
        const layer = overlays[name];
        const input = createToggle('toggle_overlay_' + idx, name, layer);
        map.on('layeradd', (e) => { if(e.layer === layer) input.checked = true; });
        map.on('layerremove', (e) => { if(e.layer === layer) input.checked = false; });
    });

    const warnInput = createToggle('toggle_warning', '20-KM Warning & AWS', warningLayerGroup);
    map.on('layeradd', (e) => { if(e.layer === warningLayerGroup) warnInput.checked = true; });
    map.on('layerremove', (e) => { if(e.layer === warningLayerGroup) warnInput.checked = false; });

    createToggle('toggle_raster', 'Show Raster Forecast', null, (checked) => {
        showRaster = checked;
        if (checked) updateRaster(currentGroupIndex); 
        else if (currentRasterLayer) map.removeLayer(currentRasterLayer);
    });
}

// --- 9. UI MODAL TOGGLES & Map Controls ---

const controlsModal = document.getElementById('controlsModal');
const propertiesModal = document.getElementById('propertiesModal');
const legendModal = document.getElementById('legendModal'); // NEW

const openControlsBtn = document.getElementById('openControlsBtn');
const openPropertiesBtn = document.getElementById('openPropertiesBtn');
const openLegendBtn = document.getElementById('openLegendBtn'); // NEW

const closeControlsBtn = document.getElementById('closeControlsBtn');
const closePropertiesBtn = document.getElementById('closePropertiesBtn');
const closeLegendBtn = document.getElementById('closeLegendBtn'); // NEW

if(openControlsBtn) openControlsBtn.onclick = () => { controlsModal.style.display = "flex"; };
if(openPropertiesBtn) openPropertiesBtn.onclick = () => { propertiesModal.style.display = "flex"; };
if(openLegendBtn) openLegendBtn.onclick = () => { legendModal.style.display = "flex"; }; // NEW

if(closeControlsBtn) closeControlsBtn.onclick = () => { controlsModal.style.display = "none"; };
if(closePropertiesBtn) closePropertiesBtn.onclick = () => { propertiesModal.style.display = "none"; };
if(closeLegendBtn) closeLegendBtn.onclick = () => { legendModal.style.display = "none"; }; // NEW

window.addEventListener('click', (e) => {
    if (e.target === controlsModal) controlsModal.style.display = "none";
    if (e.target === propertiesModal) propertiesModal.style.display = "none";
    if (e.target === legendModal) legendModal.style.display = "none"; // NEW
});

const toggleBufferBtn = document.getElementById('toggle-buffer');
if(toggleBufferBtn) {
    toggleBufferBtn.addEventListener('click', () => {
        if (map.hasLayer(warningLayerGroup)) { map.removeLayer(warningLayerGroup); toggleBufferBtn.classList.remove('btn-active'); } 
        else { map.addLayer(warningLayerGroup); toggleBufferBtn.classList.add('btn-active'); }
    });
}

const assessLocationBtn = document.getElementById('assessLocationBtn');
if (assessLocationBtn) {
    assessLocationBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (map) { showLoadingScreen("Acquiring GPS Signal..."); map.locate({setView: true, maxZoom: 16, timeout: 10000}); }
    });
}

const toggleEffectsBtn = document.getElementById('toggleEffectsBtn');
if (toggleEffectsBtn) {
    toggleEffectsBtn.addEventListener('click', () => {
        const body = document.body;
        body.classList.toggle('disable-effects');
        
        if (body.classList.contains('disable-effects')) {
            toggleEffectsBtn.innerText = '✨ Enable Effects';
            toggleEffectsBtn.classList.add('btn-warning');
        } else {
            toggleEffectsBtn.innerText = '✨ Disable Effects';
            toggleEffectsBtn.classList.remove('btn-warning');
        }
    });
}

const loadAllBtn = document.getElementById('loadAllLayersBtn');
if (loadAllBtn) {
    loadAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.layer-toggle-input').forEach(input => {
            if (!input.checked) input.click();
        });
    });
}

const unloadAllBtn = document.getElementById('unloadAllLayersBtn');
if (unloadAllBtn) {
    unloadAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.layer-toggle-input').forEach(input => {
            if (input.checked) input.click();
        });
    });
}

const defaultLayersBtn = document.getElementById('defaultLayersBtn');
if (defaultLayersBtn) {
    defaultLayersBtn.addEventListener('click', () => {
        document.querySelectorAll('.layer-toggle-input').forEach(input => {
            const label = input.nextElementSibling ? input.nextElementSibling.innerText : '';
            const isDefault = label.includes('LIGTAS-AGAD sites') || label.includes('MGB-HIGH');
            if (isDefault && !input.checked) input.click();
            if (!isDefault && input.checked) input.click();
        });
    });
}

// --- 10. Hamburger Menu Logic ---
const hamburgerBtn = document.getElementById('hamburgerBtn');
const subheaderMenu = document.getElementById('subheader');

if (hamburgerBtn && subheaderMenu) {
    hamburgerBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); 
        if (subheaderMenu.classList.contains('show-menu')) { subheaderMenu.classList.remove('show-menu'); } 
        else { subheaderMenu.classList.add('show-menu'); }
    });

    const navButtons = subheaderMenu.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => { btn.addEventListener('click', () => { subheaderMenu.classList.remove('show-menu'); }); });

    document.addEventListener('click', function(e) {
        if (subheaderMenu.classList.contains('show-menu')) {
            if (!subheaderMenu.contains(e.target) && e.target !== hamburgerBtn) { subheaderMenu.classList.remove('show-menu'); }
        }
    });

    if (typeof map !== 'undefined') { map.on('click dragstart zoomstart', function() { subheaderMenu.classList.remove('show-menu'); }); }
}
