// ============================================================
// NARI RAKSHA — COMPLETE FRONTEND JAVASCRIPT
// Frontend: HTML + CSS + JavaScript
// Backend: Java Spring Boot + MySQL
//
// IMPORTANT:
// Demo route geometry, SOS coordinates, CCTV telemetry and
// anomaly events are simulated. No real police dispatch occurs.
// ============================================================

const API_BASE_URL = "/api";
let mainMap = null;
let activeScreen = "A";
let currentRole = "A";

let safePolyline = null;
let riskPolyline = null;
let liveUserMarker = null;
let sosIncidentMarker = null;
let startMarker = null;
let destMarker = null;

let navigationInterval = null;
let selectedRouteType = "safe";
let activeSOSTriggered = false;

let latestIncidents = [];
let latestCameras = [];
let latestResources = [];

// Map markers for CCTV cameras and police stations
let resourceMarkerLayer = null;
let resourceMarkers = [];

let activeRouteCoordinates = {
    safe: [
        [11.1271, 78.6569],
        [13.0827, 78.2150],
        [15.3173, 75.7139],
        [17.3850, 78.4867]
    ],
    risk: [
        [11.1271, 78.6569],
        [14.4426, 79.9865],
        [17.3850, 78.4867]
    ]
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
});

// ============================================================
// LOGIN AND ROLES
// ============================================================

function handleLogin(event) {
    if (event) {
        event.preventDefault();
    }

    const roleSelect = document.getElementById("user-role");

    currentRole = roleSelect ? roleSelect.value : "A";

    document.getElementById("auth-screen")?.classList.add("hidden");
    document.getElementById("app-header")?.classList.remove("hidden");
    document.getElementById("app-main")?.classList.remove("hidden");

    const tabA = document.getElementById("tab-A");
    const tabD = document.getElementById("tab-D");
    const sosButton = document.getElementById("btn-top-sos");
    const roleBadge = document.getElementById("role-badge");

    if (currentRole === "D") {
        tabA?.classList.add("hidden");

        if (tabD) {
            tabD.classList.remove("hidden");
            tabD.classList.add("flex");
        }

        sosButton?.classList.add("hidden");

        if (roleBadge) {
            roleBadge.innerHTML =
                '<span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> Mode: Emergency Officer';
        }

        switchScreen("D");

    } else {
        if (tabA) {
            tabA.classList.remove("hidden");
            tabA.classList.add("flex");
        }

        tabD?.classList.add("hidden");
        sosButton?.classList.remove("hidden");

        if (roleBadge) {
            roleBadge.innerHTML =
                '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Mode: Traveller';
        }

        switchScreen("A");
    }

    initMainMap();
}

function quickDemoLogin() {
    const roleSelect = document.getElementById("user-role");

    if (roleSelect) {
        roleSelect.value = "A";
    }

    currentRole = "A";
    handleLogin();
}

function handleLogout() {
    document.getElementById("auth-screen")?.classList.remove("hidden");
    document.getElementById("app-header")?.classList.add("hidden");
    document.getElementById("app-main")?.classList.add("hidden");

    if (navigationInterval) {
        clearInterval(navigationInterval);
    }

    navigationInterval = null;
    currentRole = "A";
    activeScreen = "A";
}

// ============================================================
// SCREEN SWITCHING
// ============================================================

function switchScreen(screenId) {
    activeScreen = screenId;

    document.querySelectorAll(".screen-panel").forEach(panel => {
        panel.classList.add("hidden");
        panel.classList.remove("grid");
    });

    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.classList.remove("active-tab", "text-white");
        tab.classList.add("text-slate-400");
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);

    if (targetScreen) {
        targetScreen.classList.remove("hidden");
        targetScreen.classList.add("grid");
    }

    const targetTab = document.getElementById(`tab-${screenId}`);

    if (targetTab) {
        targetTab.classList.add("active-tab", "text-white");
        targetTab.classList.remove("text-slate-400");
    }

    // Privacy: hide traveller route information on the officer screen.
    if (mainMap) {
        if (screenId === "D") {
            if (safePolyline) {
                safePolyline.setStyle({ opacity: 0 });
            }

            if (riskPolyline) {
                riskPolyline.setStyle({ opacity: 0 });
            }

            if (liveUserMarker && mainMap.hasLayer(liveUserMarker)) {
                mainMap.removeLayer(liveUserMarker);
            }

            if (startMarker && mainMap.hasLayer(startMarker)) {
                mainMap.removeLayer(startMarker);
            }

            if (destMarker && mainMap.hasLayer(destMarker)) {
                mainMap.removeLayer(destMarker);
            }

        } else {
            if (sosIncidentMarker && mainMap.hasLayer(sosIncidentMarker)) {
                mainMap.removeLayer(sosIncidentMarker);
            }

            drawMapRoutes();
        }

        setTimeout(() => {
            mainMap.invalidateSize();
        }, 150);
    }

    // Load emergency information when the Control Room opens.
    if (screenId === "D") {
        loadEmergencyIncidents();

        Promise.all([
            loadCCTVData(),
            loadSafetyResources()
        ]).then(() => {
            renderResourceMarkers();
        });

    } else if (
        mainMap &&
        resourceMarkerLayer &&
        mainMap.hasLayer(resourceMarkerLayer)
    ) {
        // Keep CCTV and police resource markers private to the officer dashboard.
        mainMap.removeLayer(resourceMarkerLayer);
    }
}

// ============================================================
// MAP INITIALIZATION
// ============================================================

function initMainMap() {
    const container = document.getElementById("app-map");

    if (!container || typeof L === "undefined") {
        return;
    }

    if (mainMap) {
        setTimeout(() => mainMap.invalidateSize(), 100);
        return;
    }

    mainMap = L.map("app-map", {
        zoomControl: false
    }).setView([14.5, 77.5], 6);

    // Dedicated layer for CCTV and police resource markers.
    resourceMarkerLayer = L.layerGroup();

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mainMap);

    if (currentRole === "A") {
        drawMapRoutes();
    }
}

// ============================================================
// LOCATION SEARCH
// ============================================================

async function geocodeLocation(query) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (data && data.length > 0) {
            return [
                parseFloat(data[0].lat),
                parseFloat(data[0].lon)
            ];
        }

    } catch (error) {
        console.warn("Location search failed:", error);
    }

    return null;
}

// ============================================================
// ROUTE CALCULATION
// ============================================================

async function calculateRoutes() {
    const startQuery =
        document.getElementById("start-input")?.value.trim() || "";

    const destinationQuery =
        document.getElementById("dest-input")?.value.trim() || "";

    const searchButton = document.getElementById("btn-search-route");

    if (!startQuery || !destinationQuery) {
        alert("Please enter both the current location and destination.");
        return;
    }

    if (searchButton) {
        searchButton.textContent = "Searching Location...";
    }

    try {
        const [startCoords, destinationCoords] = await Promise.all([
            geocodeLocation(startQuery),
            geocodeLocation(destinationQuery)
        ]);

        if (searchButton) {
            searchButton.innerHTML =
                '<i data-lucide="search" class="w-3.5 h-3.5"></i> Find Safest Route';
        }

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        if (!startCoords || !destinationCoords) {
            alert("Location not found. Showing the default demo route.");
            drawMapRoutes();
            return;
        }

        const middleLatitude =
            (startCoords[0] + destinationCoords[0]) / 2;

        const middleLongitude =
            (startCoords[1] + destinationCoords[1]) / 2;

        // Placeholder route geometry, not actual road navigation.
        activeRouteCoordinates.safe = [
            startCoords,
            [middleLatitude + 0.5, middleLongitude - 0.5],
            destinationCoords
        ];

        activeRouteCoordinates.risk = [
            startCoords,
            [middleLatitude - 0.5, middleLongitude + 0.8],
            destinationCoords
        ];

        const distanceKm = Math.round(
            L.latLng(startCoords).distanceTo(
                L.latLng(destinationCoords)
            ) / 1000
        );

        const travelMinutes = Math.round((distanceKm / 50) * 60);
        const seed = distanceKm % 20;

        // Demo estimates unless matching saved backend route data exists.
        let safeScore = Math.min(98, Math.max(75, 95 - seed));
        let riskScore = Math.min(70, Math.max(40, 60 - seed));
        let safeCctv = Math.min(95, Math.max(70, 90 - seed));
        let riskCctv = Math.min(50, Math.max(20, 45 - seed));

        // Retrieve saved route scores from Spring Boot.
        try {
            const response = await fetch(`${API_BASE_URL}/routes`);

            if (response.ok) {
                const routes = await response.json();

                const matchingRoutes = routes.filter(route =>
                    String(route.source).toLowerCase() === startQuery.toLowerCase() &&
                    String(route.destination).toLowerCase() === destinationQuery.toLowerCase()
                );

                if (matchingRoutes.length > 0) {
                    safeScore = matchingRoutes[0].safetyScore;
                    safeCctv = matchingRoutes[0].cctvScore;

                    if (matchingRoutes.length > 1) {
                        riskScore = matchingRoutes[1].safetyScore;
                        riskCctv = matchingRoutes[1].cctvScore;
                    }
                }
            }

        } catch (error) {
            console.warn("Using demo route scores:", error);
        }

        setText("safe-dist-time", `${distanceKm} km • ${travelMinutes} mins`);

        setText(
            "risk-dist-time",
            `${Math.round(distanceKm * 0.9)} km • ${Math.round(travelMinutes * 0.8)} mins`
        );

        setText("safe-score", `${safeScore}/100`);
        setText("risk-score", `${riskScore}/100`);
        setText("safe-cctv", `${safeCctv}%`);
        setText("risk-cctv", `${riskCctv}%`);

        drawMapRoutes();

        await loadSafetyResources();
        await loadCCTVData();

    } catch (error) {
        console.error("Route calculation error:", error);

        alert("Unable to calculate the demo route.");

        if (searchButton) {
            searchButton.innerHTML =
                '<i data-lucide="search" class="w-3.5 h-3.5"></i> Find Safest Route';
        }

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    }
}

// ============================================================
// DRAW ROUTES
// ============================================================

function drawMapRoutes() {
    if (!mainMap || typeof L === "undefined") {
        return;
    }

    if (safePolyline && mainMap.hasLayer(safePolyline)) {
        mainMap.removeLayer(safePolyline);
    }

    if (riskPolyline && mainMap.hasLayer(riskPolyline)) {
        mainMap.removeLayer(riskPolyline);
    }

    if (startMarker && mainMap.hasLayer(startMarker)) {
        mainMap.removeLayer(startMarker);
    }

    if (destMarker && mainMap.hasLayer(destMarker)) {
        mainMap.removeLayer(destMarker);
    }

    safePolyline = L.polyline(activeRouteCoordinates.safe, {
        color: "#10b981",
        weight: 5,
        opacity: 0.9
    }).addTo(mainMap);

    riskPolyline = L.polyline(activeRouteCoordinates.risk, {
        color: "#f59e0b",
        weight: 4,
        opacity: 0.6,
        dashArray: "8, 8"
    }).addTo(mainMap);

    startMarker = L.marker(
        activeRouteCoordinates.safe[0]
    ).addTo(mainMap);

    destMarker = L.marker(
        activeRouteCoordinates.safe[
        activeRouteCoordinates.safe.length - 1
            ]
    ).addTo(mainMap);

    if (activeScreen !== "D") {
        safePolyline.setStyle({
            opacity: selectedRouteType === "safe" ? 0.9 : 0.4
        });

        riskPolyline.setStyle({
            opacity: selectedRouteType === "risk" ? 1 : 0.4
        });

        mainMap.fitBounds(
            safePolyline.getBounds(),
            { padding: [60, 60] }
        );
    }
}

// ============================================================
// SELECT ROUTE
// ============================================================

function selectRoute(type) {
    selectedRouteType = type;

    const safeCard = document.getElementById("route-card-safe");
    const riskCard = document.getElementById("route-card-risk");

    if (type === "safe") {
        if (safeCard) {
            safeCard.className =
                "route-card border-2 border-emerald-500/50 bg-emerald-950/30 p-3 rounded-xl cursor-pointer hover:border-emerald-500 transition";
        }

        if (riskCard) {
            riskCard.className =
                "route-card border border-slate-800 bg-slate-950/50 p-3 rounded-xl cursor-pointer hover:border-amber-500/50 transition";
        }

        if (safePolyline) {
            safePolyline.setStyle({ opacity: 1, weight: 6 });
        }

        if (riskPolyline) {
            riskPolyline.setStyle({ opacity: 0.4, weight: 3 });
        }

    } else {
        if (riskCard) {
            riskCard.className =
                "route-card border-2 border-amber-500/50 bg-amber-950/30 p-3 rounded-xl cursor-pointer hover:border-amber-500/50 transition";
        }

        if (safeCard) {
            safeCard.className =
                "route-card border border-slate-800 bg-slate-950/50 p-3 rounded-xl cursor-pointer hover:border-emerald-500/50 transition";
        }

        if (riskPolyline) {
            riskPolyline.setStyle({ opacity: 1, weight: 6 });
        }

        if (safePolyline) {
            safePolyline.setStyle({ opacity: 0.4, weight: 3 });
        }
    }
}

// ============================================================
// SOS — SAVE INCIDENT IN MYSQL THROUGH SPRING BOOT
// ============================================================

async function triggerEmergencySOS() {
    if (activeSOSTriggered) {
        const confirmNew = confirm(
            "An SOS has already been triggered in this browser session. Create another demo incident?"
        );

        if (!confirmNew) {
            return;
        }
    }

    const route =
        activeRouteCoordinates[selectedRouteType] ||
        activeRouteCoordinates.safe;

    // Simulated route coordinate, not live GPS.
    const sosLocation =
        route[Math.floor(route.length / 2)] ||
        [17.385, 78.4867];

    const incidentData = {
        victimName: "Demo Traveller",
        latitude: sosLocation[0],
        longitude: sosLocation[1]
    };

    try {
        const response = await fetch(`${API_BASE_URL}/incidents/sos`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(incidentData)
        });

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const savedIncident = await response.json();

        activeSOSTriggered = true;

        alert(
            `🚨 SOS Recorded Successfully!\n` +
            `Incident ID: ${savedIncident.id}\n` +
            `Status: ${savedIncident.status}`
        );

        await loadEmergencyIncidents();

        if (currentRole === "D") {
            showSOSMarkerForEmergencyOfficer(savedIncident);
        }

    } catch (error) {
        console.error("SOS API error:", error);

        alert(
            "Unable to save SOS. Check that Spring Boot is running " +
            "and inspect the browser console."
        );
    }
}

// ============================================================
// EMERGENCY CONTROL ROOM — LOAD INCIDENTS FROM MYSQL
// ============================================================

async function loadEmergencyIncidents() {
    const container = document.getElementById(
        "officer-incident-container"
    );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center text-slate-400 text-xs">
            Loading emergency incidents...
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/incidents`);

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        latestIncidents = await response.json();

        if (latestIncidents.length === 0) {
            container.innerHTML = `
                <div class="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center text-slate-400 text-xs">
                    <p class="font-semibold text-slate-300">
                        No Active Emergency
                    </p>
                    <p class="text-[10px] text-slate-500 mt-1">
                        Awaiting an SOS signal.
                    </p>
                </div>
            `;

            setOfficerBadge("MONITORING SYSTEM", false);
            return;
        }

        const activeIncidents = latestIncidents.filter(
            incident => incident.status !== "RESOLVED"
        );

        setOfficerBadge(
            activeIncidents.length
                ? `${activeIncidents.length} INCIDENT(S)`
                : "NO ACTIVE INCIDENTS",
            activeIncidents.length > 0
        );

        container.innerHTML = latestIncidents
            .slice()
            .sort((a, b) => Number(b.id) - Number(a.id))
            .map(incident => {
                const id = Number(incident.id);

                const status = escapeHtml(
                    incident.status || "OPEN"
                );

                const name = escapeHtml(
                    incident.victimName || "Demo Traveller"
                );

                const timestamp = incident.timestamp
                    ? new Date(incident.timestamp).toLocaleString()
                    : "Not available";

                const canDispatch =
                    status !== "DISPATCHED" &&
                    status !== "RESOLVED";

                const canResolve =
                    status !== "RESOLVED";

                return `
                    <div class="bg-rose-950/30 border border-rose-600/50 p-3 rounded-xl space-y-2">

                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-bold text-rose-400">
                                🚨 ${escapeHtml(incident.incidentType || "SOS")}
                                — Incident #${id}
                            </span>

                            <span class="text-[10px] text-amber-300 font-bold">
                                ${status}
                            </span>
                        </div>

                        <p class="text-xs text-slate-200">
                            Traveller: ${name}
                        </p>

                        <p class="text-xs text-emerald-300 font-mono">
                            Location:
                            ${Number(incident.latitude).toFixed(4)},
                            ${Number(incident.longitude).toFixed(4)}
                        </p>

                        <p class="text-[10px] text-slate-400">
                            Time: ${escapeHtml(timestamp)}
                        </p>

                        ${
                    canDispatch
                        ? `
                                    <button
                                        onclick="updateIncidentStatus(${id}, 'DISPATCHED')"
                                        class="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg text-xs">
                                        Dispatch Response Unit
                                    </button>
                                `
                        : ""
                }

                        ${
                    canResolve
                        ? `
                                    <button
                                        onclick="updateIncidentStatus(${id}, 'RESOLVED')"
                                        class="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg text-xs">
                                        Mark Resolved
                                    </button>
                                `
                        : ""
                }

                        <button
                            onclick="focusIncidentOnMap(${Number(incident.latitude)}, ${Number(incident.longitude)})"
                            class="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-lg text-xs">
                            View Incident on Map
                        </button>

                    </div>
                `;
            }).join("");

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        const newestActive = activeIncidents
            .slice()
            .sort((a, b) => Number(b.id) - Number(a.id))[0];

        if (newestActive && activeScreen === "D") {
            showSOSMarkerForEmergencyOfficer(newestActive);
        }

    } catch (error) {
        console.error("Unable to load incidents:", error);

        container.innerHTML = `
            <div class="bg-slate-950 border border-rose-800 p-4 rounded-xl text-center text-rose-300 text-xs">
                Unable to load incidents.
                Check the backend connection and browser console.
            </div>
        `;
    }
}

// ============================================================
// DISPATCH / RESOLVE INCIDENT
// ============================================================

async function updateIncidentStatus(id, status) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/incidents/${id}/status?status=${encodeURIComponent(status)}`,
            {
                method: "PUT"
            }
        );

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const updatedIncident = await response.json();

        alert(
            `Incident #${updatedIncident.id} updated to ${updatedIncident.status}.`
        );

        await loadEmergencyIncidents();

    } catch (error) {
        console.error("Unable to update incident:", error);

        alert(
            "Unable to update the incident. Check the backend connection."
        );
    }
}

async function dispatchResponder() {
    const openIncident = latestIncidents
        .filter(incident =>
            incident.status !== "DISPATCHED" &&
            incident.status !== "RESOLVED"
        )
        .sort((a, b) => Number(b.id) - Number(a.id))[0];

    if (!openIncident) {
        alert("No open incident is available. Refresh the incident list.");
        return;
    }

    await updateIncidentStatus(openIncident.id, "DISPATCHED");
}

// ============================================================
// SHOW INCIDENT LOCATION ON MAP
// ============================================================

function focusIncidentOnMap(latitude, longitude) {
    if (!mainMap) {
        return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
    }

    mainMap.setView([latitude, longitude], 14);

    if (sosIncidentMarker && mainMap.hasLayer(sosIncidentMarker)) {
        sosIncidentMarker.setLatLng([latitude, longitude]);
    }
}

function showSOSMarkerForEmergencyOfficer(incident = null) {
    if (!mainMap || typeof L === "undefined") {
        return;
    }

    const fallback = activeRouteCoordinates.safe[
        Math.floor(activeRouteCoordinates.safe.length / 2)
        ] || [17.385, 78.4867];

    const sosLocation = incident &&
    Number.isFinite(Number(incident.latitude)) &&
    Number.isFinite(Number(incident.longitude))
        ? [
            Number(incident.latitude),
            Number(incident.longitude)
        ]
        : fallback;

    const sosIcon = L.divIcon({
        className: "custom-sos-marker",
        html: `
            <div class="w-6 h-6 bg-rose-600 border-2 border-white rounded-full shadow-lg animate-ping"></div>
            <div class="w-6 h-6 bg-rose-700 border-2 border-white rounded-full shadow-lg relative -top-6 flex items-center justify-center text-white text-[10px] font-bold">!</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    if (sosIncidentMarker && mainMap.hasLayer(sosIncidentMarker)) {
        mainMap.removeLayer(sosIncidentMarker);
    }

    sosIncidentMarker = L.marker(sosLocation, {
        icon: sosIcon
    }).addTo(mainMap);

    mainMap.setView(sosLocation, 12);

    setOfficerBadge("SOS INCIDENT AVAILABLE", true);
}

function setOfficerBadge(text, alertState) {
    const badge = document.getElementById("officer-status-badge");

    if (!badge) {
        return;
    }

    badge.innerText = text;

    badge.className = alertState
        ? "text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-bold animate-pulse"
        : "text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold";
}

// ============================================================
// CCTV API
// ============================================================

async function loadCCTVData() {
    try {
        const response = await fetch(`${API_BASE_URL}/cctv`);

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        latestCameras = await response.json();

        console.log("CCTV demo data loaded:", latestCameras);

        renderResourceMarkers();

        return latestCameras;

    } catch (error) {
        console.warn("Unable to load CCTV data:", error);
        return [];
    }
}

// ============================================================
// POLICE STATIONS AND SAFETY RESOURCES API
// ============================================================

async function loadSafetyResources() {
    try {
        const response = await fetch(`${API_BASE_URL}/resources`);

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        latestResources = await response.json();

        console.log("Safety resources loaded:", latestResources);

        renderResourceMarkers();

        return latestResources;

    } catch (error) {
        console.warn("Unable to load safety resources:", error);
        return [];
    }
}

// ============================================================
// MAP: CCTV AND POLICE RESOURCE MARKERS
// ============================================================

function renderResourceMarkers() {
    if (!mainMap || typeof L === "undefined") {
        return;
    }

    if (!resourceMarkerLayer) {
        resourceMarkerLayer = L.layerGroup();
    }

    // Remove old markers before rendering to avoid duplicates.
    resourceMarkerLayer.clearLayers();
    resourceMarkers = [];

    // Resource markers are visible only in the officer dashboard.
    if (activeScreen !== "D") {
        if (mainMap.hasLayer(resourceMarkerLayer)) {
            mainMap.removeLayer(resourceMarkerLayer);
        }
        return;
    }

    const addResourceMarker = (resource, type) => {
        const latitude = Number(resource.latitude);
        const longitude = Number(resource.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return;
        }

        const isPolice = type === "POLICE_STATION";
        const name = resource.name || (isPolice ? "Police Station" : "CCTV Camera");
        const status = resource.status || "UNKNOWN";
        const color = isPolice ? "#f43f5e" : "#3b82f6";
        const letter = isPolice ? "P" : "C";

        const icon = L.divIcon({
            className: "resource-map-marker",
            html: `
                <div style="
                    width: 30px;
                    height: 30px;
                    background: ${color};
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.45);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                ">${letter}</div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker([latitude, longitude], {
            icon,
            title: name
        });

        marker.bindPopup(`
            <div style="min-width: 170px; color: #0f172a;">
                <strong>${escapeHtml(name)}</strong>
                <hr style="margin: 5px 0;">
                <div>Type: ${escapeHtml(type.replace(/_/g, " "))}</div>
                <div>Status: ${escapeHtml(status)}</div>
                <div>Latitude: ${latitude}</div>
                <div>Longitude: ${longitude}</div>
            </div>
        `);

        marker.addTo(resourceMarkerLayer);
        resourceMarkers.push(marker);
    };

    // Add police station markers from /api/resources.
    latestResources.forEach(resource => {
        if (
            String(resource.type || "").toUpperCase() ===
            "POLICE_STATION"
        ) {
            addResourceMarker(resource, "POLICE_STATION");
        }
    });

    // Add CCTV camera markers from /api/cctv.
    latestCameras.forEach(camera => {
        addResourceMarker(camera, "CCTV");
    });

    if (!mainMap.hasLayer(resourceMarkerLayer)) {
        resourceMarkerLayer.addTo(mainMap);
    }

    console.log(
        `Displayed ${resourceMarkers.length} CCTV and police markers.`
    );
}

// ============================================================
// SIMULATED CCTV CANVAS
// ============================================================

function initSOSCCTVCanvas() {
    const canvas = document.getElementById("sos-cctv-canvas");

    if (!canvas) {
        return;
    }

    const parent = canvas.parentElement;

    canvas.width = parent.clientWidth || 300;
    canvas.height = parent.clientHeight || 180;

    const context = canvas.getContext("2d");
    let frame = 0;

    function renderFrame() {
        if (!document.getElementById("sos-cctv-canvas")) {
            return;
        }

        context.fillStyle = "#020617";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.strokeStyle = "#1e293b";
        context.lineWidth = 1;

        for (let x = 0; x < canvas.width; x += 25) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, canvas.height);
            context.stroke();
        }

        const y = (frame * 2.5) % canvas.height;

        context.strokeStyle = "rgba(244, 63, 94, 0.7)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();

        context.strokeStyle = "#f43f5e";
        context.lineWidth = 1.5;

        context.strokeRect(
            canvas.width * 0.35,
            canvas.height * 0.25,
            70,
            70
        );

        context.fillStyle = "#f43f5e";
        context.font = "9px monospace";

        context.fillText(
            "SIMULATED TARGET OVERLAY",
            canvas.width * 0.35,
            canvas.height * 0.25 - 5
        );

        context.fillStyle = "#10b981";
        context.font = "10px monospace";
        context.fillText("DEMO INCIDENT CAMERA", 10, canvas.height - 10);

        frame++;

        requestAnimationFrame(renderFrame);
    }

    renderFrame();
}

// ============================================================
// SIMULATED NAVIGATION
// ============================================================

function startJourney() {
    if (!mainMap) {
        alert("Map is not ready. Please try again.");
        return;
    }

    if (navigationInterval) {
        clearInterval(navigationInterval);
    }

    const coordinates = activeRouteCoordinates[selectedRouteType];
    let pointIndex = 0;

    const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `
            <div class="w-5 h-5 bg-rose-500 border-2 border-white rounded-full shadow-lg animate-ping"></div>
            <div class="w-5 h-5 bg-rose-600 border-2 border-white rounded-full shadow-lg relative -top-5"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    if (liveUserMarker && mainMap.hasLayer(liveUserMarker)) {
        mainMap.removeLayer(liveUserMarker);
    }

    liveUserMarker = L.marker(coordinates[0], {
        icon: userIcon
    }).addTo(mainMap);

    mainMap.panTo(coordinates[0]);

    const button = document.getElementById("btn-start-journey");

    if (button) {
        button.textContent = "NAVIGATION ACTIVE...";
    }

    navigationInterval = setInterval(() => {
        pointIndex++;

        if (pointIndex < coordinates.length) {
            const nextPosition = coordinates[pointIndex];

            liveUserMarker.setLatLng(nextPosition);
            mainMap.panTo(nextPosition);

        } else {
            clearInterval(navigationInterval);
            navigationInterval = null;

            if (button) {
                button.textContent = "► Destination Reached";
            }

            alert("Demo navigation reached the destination.");
        }
    }, 2500);
}

// ============================================================
// EMERGENCY CONTACTS
// ============================================================

function toggleContactForm() {
    document.getElementById("add-contact-form")?.classList.toggle("hidden");
}

function saveEmergencyContact() {
    const nameInput = document.getElementById("contact-name-input");
    const phoneInput = document.getElementById("contact-phone-input");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";

    if (!name || !phone) {
        alert("Please enter both name and phone number.");
        return;
    }

    if (!/^[+0-9()\-\s]{7,20}$/.test(phone)) {
        alert("Please enter a valid phone number.");
        return;
    }

    const list = document.getElementById("emergency-contacts-list");

    if (list) {
        const item = document.createElement("div");

        item.className =
            "bg-slate-950/80 border border-slate-800 p-2 rounded-xl flex items-center justify-between";

        const details = document.createElement("div");

        const nameParagraph = document.createElement("p");
        nameParagraph.className = "font-bold text-slate-200 text-[11px]";
        nameParagraph.textContent = name;

        const phoneParagraph = document.createElement("p");
        phoneParagraph.className = "text-[9px] text-slate-400";
        phoneParagraph.textContent = phone;

        details.append(nameParagraph, phoneParagraph);

        const callLink = document.createElement("a");
        callLink.href = `tel:${phone.replace(/\s/g, "")}`;

        callLink.className =
            "bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg";

        callLink.innerHTML =
            '<i data-lucide="phone" class="w-3 h-3"></i>';

        item.append(details, callLink);
        list.appendChild(item);
    }

    if (nameInput) {
        nameInput.value = "";
    }

    if (phoneInput) {
        phoneInput.value = "";
    }

    toggleContactForm();

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}

// ============================================================
// STUCK ANOMALY DEMO
// ============================================================

function simulateStuckAnomaly() {
    alert(
        "⚠️ Demo anomaly detected: traveller appears stopped. " +
        "A simulated SOS incident will be created."
    );

    triggerEmergencySOS();
}

// ============================================================
// SMALL HELPERS
// ============================================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}