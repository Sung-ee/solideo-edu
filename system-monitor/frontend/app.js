/**
 * System Resource Monitor - Main Application
 * Real-time monitoring with WebSocket connection
 */

class SystemMonitor {
    constructor() {
        this.ws = null;
        this.charts = {};
        this.dataHistory = {
            cpu: [],
            memory: [],
            gpu: [],
            networkDown: [],
            networkUp: [],
            timestamps: []
        };
        this.maxDataPoints = 60; // 60 seconds of history
        this.collectedData = []; // For PDF export
        this.isCollecting = false;

        // WebSocket reconnection settings
        this.wsRetryCount = 0;
        this.wsMaxRetries = 5;
        this.wsBaseDelay = 1000; // 1 second

        this.init();
    }

    init() {
        this.initCharts();
        this.connectWebSocket();
        this.loadSteamCompatibility();
        this.setupEventListeners();
    }

    // ========================
    // WebSocket Connection
    // ========================

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/monitor`;

        this.updateConnectionStatus('connecting');

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.wsRetryCount = 0; // Reset retry count on successful connection
            this.updateConnectionStatus('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.updateDashboard(data);

                // Store data for PDF export if collecting
                if (this.isCollecting) {
                    this.collectedData.push(data);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('disconnected');
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('error');
        };
    }

    attemptReconnect() {
        if (this.wsRetryCount >= this.wsMaxRetries) {
            console.error('Maximum WebSocket reconnection attempts reached');
            this.updateConnectionStatus('error');
            return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = this.wsBaseDelay * Math.pow(2, this.wsRetryCount);
        this.wsRetryCount++;

        console.log(`Attempting to reconnect WebSocket (attempt ${this.wsRetryCount}/${this.wsMaxRetries}) in ${delay}ms`);
        setTimeout(() => this.connectWebSocket(), delay);
    }

    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        const textEl = statusEl.querySelector('.status-text');

        statusEl.className = 'connection-status';

        switch (status) {
            case 'connected':
                statusEl.classList.add('connected');
                textEl.textContent = '연결됨';
                break;
            case 'disconnected':
                statusEl.classList.add('disconnected');
                textEl.textContent = '연결 끊김';
                break;
            case 'connecting':
                textEl.textContent = '연결 중...';
                break;
            case 'error':
                statusEl.classList.add('disconnected');
                textEl.textContent = '오류 발생';
                break;
        }
    }

    // ========================
    // Chart Initialization
    // ========================

    initCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 300
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: true,
                    min: 0,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.3)',
                        font: {
                            size: 10
                        },
                        callback: (value) => value + '%'
                    }
                }
            },
            elements: {
                line: {
                    borderWidth: 2,
                    tension: 0.4
                },
                point: {
                    radius: 0
                }
            }
        };

        // CPU Chart
        this.charts.cpu = new Chart(document.getElementById('cpuChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }]
            },
            options: { ...chartOptions }
        });

        // Memory Chart
        this.charts.memory = new Chart(document.getElementById('memoryChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true
                }]
            },
            options: { ...chartOptions }
        });

        // GPU Chart
        this.charts.gpu = new Chart(document.getElementById('gpuChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true
                }]
            },
            options: { ...chartOptions }
        });

        // Network Chart
        this.charts.network = new Chart(document.getElementById('networkChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Download',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true
                    },
                    {
                        label: 'Upload',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true
                    }
                ]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        max: undefined, // Dynamic for network
                        ticks: {
                            ...chartOptions.scales.y.ticks,
                            callback: (value) => value.toFixed(1) + ' Mbps'
                        }
                    }
                }
            }
        });
    }

    // ========================
    // Dashboard Updates
    // ========================

    updateDashboard(data) {
        this.updateSystemInfo(data.system);
        this.updateCPU(data.cpu);
        this.updateMemory(data.memory);
        this.updateGPU(data.gpu);
        this.updateNetwork(data.network);
        this.updateDisk(data.disk);
        this.updateCharts(data);
    }

    updateSystemInfo(system) {
        if (!system) return;

        document.querySelector('.system-name').textContent = system.node_name || 'Unknown';
        document.querySelector('.uptime').textContent = `Uptime: ${system.uptime_hours || 0}h`;
    }

    updateCPU(cpu) {
        if (!cpu) return;

        const usage = Math.round(cpu.usage_percent);

        // Update gauge
        document.getElementById('cpuUsage').textContent = usage + '%';
        this.updateGauge('cpuGaugeFill', usage);

        // Update temperature
        if (cpu.temperature !== null) {
            document.getElementById('cpuTemp').textContent = `${cpu.temperature.toFixed(1)}°C`;
            document.getElementById('cpuTemp').style.color = this.getTempColor(cpu.temperature);
        } else {
            document.getElementById('cpuTemp').textContent = 'N/A';
        }

        // Update info
        document.getElementById('cpuFreq').textContent = `${(cpu.frequency_current / 1000).toFixed(2)} GHz`;
        document.getElementById('cpuCoreCount').textContent = `${cpu.cores_physical}코어 / ${cpu.cores_logical}스레드`;

        // Update core bars
        this.updateCpuCores(cpu.usage_per_core);
    }

    updateCpuCores(coreUsages) {
        const container = document.getElementById('cpuCores');

        if (!coreUsages || coreUsages.length === 0) return;

        // Create or update core bars
        if (container.children.length !== coreUsages.length) {
            container.innerHTML = coreUsages.map((_, i) => `
                <div class="cpu-core" title="Core ${i}">
                    <div class="cpu-core-fill" style="width: 0%"></div>
                </div>
            `).join('');
        }

        // Update values
        coreUsages.forEach((usage, i) => {
            const fill = container.children[i]?.querySelector('.cpu-core-fill');
            if (fill) {
                fill.style.width = `${usage}%`;
            }
        });
    }

    updateMemory(memory) {
        if (!memory) return;

        const usage = Math.round(memory.percent);

        // Update gauge
        document.getElementById('memoryUsage').textContent = usage + '%';
        this.updateGauge('memoryGaugeFill', usage);

        // Update bar
        document.getElementById('memoryBarFill').style.width = usage + '%';

        // Update info
        document.getElementById('memoryUsed').textContent = `${memory.used_gb} GB`;
        document.getElementById('memoryTotal').textContent = `${memory.total_gb} GB`;
        document.getElementById('memoryAvailable').textContent = `${memory.available_gb} GB`;
    }

    updateGPU(gpus) {
        if (!gpus || gpus.length === 0) {
            document.getElementById('gpuName').textContent = 'GPU 없음';
            document.getElementById('gpuName').className = 'gpu-name';
            document.getElementById('gpuUsage').textContent = 'N/A';
            document.getElementById('gpuTemp').textContent = 'N/A';
            document.getElementById('gpuVramUsed').textContent = 'N/A';
            document.getElementById('gpuVramTotal').textContent = 'N/A';
            return;
        }

        // Find the best GPU to display (prefer discrete GPU over integrated)
        let gpu = gpus[0];
        for (const g of gpus) {
            // Prefer Intel ARC (discrete), NVIDIA, or AMD over Intel integrated
            if (g.name && (g.name.includes('Arc') || g.name.includes('ARC') ||
                g.vendor === 'NVIDIA' || g.vendor === 'AMD')) {
                gpu = g;
                break;
            }
        }

        const usage = Math.round(gpu.load_percent || 0);

        // Get vendor color
        const vendorColors = {
            'Intel': '#0071c5',
            'NVIDIA': '#76b900',
            'AMD': '#ed1c24',
            'Unknown': '#6b7280'
        };
        const vendorColor = vendorColors[gpu.vendor] || vendorColors['Unknown'];

        // Update name with vendor badge
        const gpuNameEl = document.getElementById('gpuName');
        const vendorBadge = gpu.vendor ? `<span class="vendor-badge" style="background: ${vendorColor}">${gpu.vendor}</span> ` : '';
        gpuNameEl.innerHTML = vendorBadge + (gpu.name || 'Unknown GPU');

        // Update gauge
        document.getElementById('gpuUsage').textContent = usage + '%';
        this.updateGauge('gpuGaugeFill', usage);

        // Update temperature
        if (gpu.temperature !== null && gpu.temperature !== undefined) {
            document.getElementById('gpuTemp').textContent = `${gpu.temperature}°C`;
            document.getElementById('gpuTemp').style.color = this.getTempColor(gpu.temperature);
        } else {
            document.getElementById('gpuTemp').textContent = 'N/A';
            document.getElementById('gpuTemp').style.color = '#6b7280';
        }

        // Update VRAM
        const vramUsed = gpu.memory_used_gb || 0;
        const vramTotal = gpu.memory_total_gb || 0;
        document.getElementById('gpuVramUsed').textContent = vramUsed > 0 ? `${vramUsed} GB` : 'N/A';
        document.getElementById('gpuVramTotal').textContent = vramTotal > 0 ? `${vramTotal} GB` : 'N/A';

        // If there are multiple GPUs, show a count
        if (gpus.length > 1) {
            const gpuCard = document.getElementById('gpuCard');
            let gpuCountBadge = gpuCard.querySelector('.gpu-count-badge');
            if (!gpuCountBadge) {
                gpuCountBadge = document.createElement('span');
                gpuCountBadge.className = 'gpu-count-badge';
                gpuCard.querySelector('.card-header h2').appendChild(gpuCountBadge);
            }
            gpuCountBadge.textContent = ` (${gpus.length}개)`;
        }
    }

    updateNetwork(network) {
        if (!network) return;

        document.getElementById('downloadSpeed').textContent = network.download_speed_mbps.toFixed(2);
        document.getElementById('uploadSpeed').textContent = network.upload_speed_mbps.toFixed(2);
        document.getElementById('totalReceived').textContent = `${network.total_received_gb} GB`;
        document.getElementById('totalSent').textContent = `${network.total_sent_gb} GB`;
    }

    updateDisk(disk) {
        if (!disk) return;

        // Update I/O
        document.getElementById('diskRead').textContent = `${disk.read_speed_mbps.toFixed(2)} MB/s`;
        document.getElementById('diskWrite').textContent = `${disk.write_speed_mbps.toFixed(2)} MB/s`;

        // Update partitions
        const container = document.getElementById('diskPartitions');
        container.innerHTML = disk.partitions.map(partition => {
            const fillClass = partition.percent > 90 ? 'danger' : partition.percent > 70 ? 'warning' : '';
            return `
                <div class="partition">
                    <div class="partition-header">
                        <span class="partition-name">${partition.device}</span>
                        <span class="partition-percent">${partition.percent}%</span>
                    </div>
                    <div class="partition-bar">
                        <div class="partition-bar-fill ${fillClass}" style="width: ${partition.percent}%"></div>
                    </div>
                    <div class="partition-info">
                        <span>${partition.used_gb} GB 사용</span>
                        <span>${partition.total_gb} GB 전체</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateCharts(data) {
        const timestamp = new Date().toLocaleTimeString();

        // Add to history
        this.dataHistory.timestamps.push(timestamp);
        this.dataHistory.cpu.push(data.cpu?.usage_percent || 0);
        this.dataHistory.memory.push(data.memory?.percent || 0);
        this.dataHistory.gpu.push(data.gpu?.[0]?.load_percent || 0);
        this.dataHistory.networkDown.push(data.network?.download_speed_mbps || 0);
        this.dataHistory.networkUp.push(data.network?.upload_speed_mbps || 0);

        // Trim to max data points
        if (this.dataHistory.timestamps.length > this.maxDataPoints) {
            this.dataHistory.timestamps.shift();
            this.dataHistory.cpu.shift();
            this.dataHistory.memory.shift();
            this.dataHistory.gpu.shift();
            this.dataHistory.networkDown.shift();
            this.dataHistory.networkUp.shift();
        }

        // Update charts
        this.updateChart(this.charts.cpu, this.dataHistory.timestamps, this.dataHistory.cpu);
        this.updateChart(this.charts.memory, this.dataHistory.timestamps, this.dataHistory.memory);
        this.updateChart(this.charts.gpu, this.dataHistory.timestamps, this.dataHistory.gpu);

        // Network chart with two datasets
        this.charts.network.data.labels = this.dataHistory.timestamps;
        this.charts.network.data.datasets[0].data = this.dataHistory.networkDown;
        this.charts.network.data.datasets[1].data = this.dataHistory.networkUp;
        this.charts.network.update('none');
    }

    updateChart(chart, labels, data) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update('none');
    }

    updateGauge(elementId, percent) {
        const gauge = document.getElementById(elementId);
        if (!gauge) return;

        // Arc length is 126 (circumference of half circle)
        const offset = 126 - (126 * percent / 100);
        gauge.style.strokeDashoffset = offset;
    }

    getTempColor(temp) {
        if (temp >= 80) return '#ef4444'; // Red - Hot
        if (temp >= 60) return '#f59e0b'; // Yellow - Warm
        return '#10b981'; // Green - Normal
    }

    // ========================
    // Steam Compatibility
    // ========================

    async loadSteamCompatibility() {
        try {
            const response = await fetch('/api/steam-compatibility');
            const data = await response.json();

            this.renderSteamSpecs(data.system_specs);
            this.renderSteamTable(data.games);
        } catch (error) {
            console.error('Failed to load Steam compatibility:', error);
        }
    }

    renderSteamSpecs(specs) {
        document.getElementById('specCpu').textContent = specs.processor || 'Unknown';
        document.getElementById('specRam').textContent = `${specs.ram_gb || 0} GB`;
        document.getElementById('specVram').textContent = `${specs.gpu_vram_gb || 0} GB`;
        document.getElementById('specStorage').textContent = `${specs.available_storage_gb || 0} GB`;
    }

    renderSteamTable(games) {
        const tbody = document.getElementById('steamTableBody');

        tbody.innerHTML = games.map(game => `
            <tr>
                <td>
                    <div class="game-name">
                        <img src="${game.image_url}" alt="${game.name}" class="game-image" onerror="this.style.display='none'">
                        <span>${game.name}</span>
                    </div>
                </td>
                <td><span class="status-light ${game.checks.cpu ? 'green' : 'red'}">●</span></td>
                <td><span class="status-light ${game.checks.ram ? 'green' : 'red'}">●</span></td>
                <td><span class="status-light ${game.checks.gpu ? 'green' : 'red'}">●</span></td>
                <td><span class="status-light ${game.checks.storage ? 'green' : 'red'}">●</span></td>
                <td><span class="status-badge ${game.status}">${game.status_text}</span></td>
            </tr>
        `).join('');
    }

    // ========================
    // Event Listeners
    // ========================

    setupEventListeners() {
        // PDF Export button
        document.getElementById('pdfExportBtn').addEventListener('click', () => {
            window.pdfExporter.startCollection();
        });

        // Cancel PDF button
        document.getElementById('cancelPdfBtn').addEventListener('click', () => {
            window.pdfExporter.cancelCollection();
        });

        // Refresh Steam compatibility
        document.getElementById('refreshSteamBtn').addEventListener('click', () => {
            this.loadSteamCompatibility();
        });
    }
}

// Initialize the monitor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.systemMonitor = new SystemMonitor();
});
