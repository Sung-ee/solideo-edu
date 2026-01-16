/**
 * PDF Export Module
 * Collects data for 5 minutes and generates a PDF report
 */

class PDFExporter {
    constructor() {
        this.isCollecting = false;
        this.collectionStartTime = null;
        this.collectionDuration = 5 * 60 * 1000; // 5 minutes in ms
        this.collectedData = [];
        this.intervalId = null;
        this.updateIntervalId = null;
    }

    startCollection() {
        if (this.isCollecting) return;

        this.isCollecting = true;
        this.collectedData = [];
        this.collectionStartTime = Date.now();

        // Show modal
        document.getElementById('pdfModal').classList.add('active');

        // Start collecting data
        window.systemMonitor.isCollecting = true;
        window.systemMonitor.collectedData = [];

        // Update progress bar
        this.updateIntervalId = setInterval(() => this.updateProgress(), 1000);

        // Set timeout for completion
        this.intervalId = setTimeout(() => this.finishCollection(), this.collectionDuration);
    }

    cancelCollection() {
        this.isCollecting = false;
        window.systemMonitor.isCollecting = false;

        if (this.intervalId) clearTimeout(this.intervalId);
        if (this.updateIntervalId) clearInterval(this.updateIntervalId);

        document.getElementById('pdfModal').classList.remove('active');
    }

    updateProgress() {
        if (!this.isCollecting) return;

        const elapsed = Date.now() - this.collectionStartTime;
        const progress = Math.min((elapsed / this.collectionDuration) * 100, 100);

        const elapsedSeconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;

        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;
        document.getElementById('progressTime').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')} / 5:00`;
    }

    async finishCollection() {
        this.isCollecting = false;
        window.systemMonitor.isCollecting = false;

        if (this.updateIntervalId) clearInterval(this.updateIntervalId);

        this.collectedData = [...window.systemMonitor.collectedData];

        // Generate PDF
        await this.generatePDF();

        // Close modal
        document.getElementById('pdfModal').classList.remove('active');
    }

    async generatePDF() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = margin;

        // Colors
        const primaryColor = [59, 130, 246];
        const textColor = [31, 41, 55];
        const mutedColor = [107, 114, 128];

        // Title
        pdf.setFillColor(17, 24, 39);
        pdf.rect(0, 0, pageWidth, 40, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('System Resource Monitor Report', margin, 25);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const now = new Date();
        pdf.text(`Generated: ${now.toLocaleString('ko-KR')}`, margin, 35);
        pdf.text(`Data collected over 5 minutes (${this.collectedData.length} samples)`, pageWidth - margin - 80, 35);

        yPos = 50;

        // System Info
        if (this.collectedData.length > 0) {
            const systemInfo = this.collectedData[0].system;

            pdf.setTextColor(...primaryColor);
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('System Information', margin, yPos);
            yPos += 8;

            pdf.setTextColor(...textColor);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            const sysInfoLines = [
                `Computer: ${systemInfo.node_name}`,
                `OS: ${systemInfo.system} ${systemInfo.release}`,
                `Processor: ${systemInfo.processor}`,
                `Uptime: ${systemInfo.uptime_hours} hours`
            ];

            sysInfoLines.forEach(line => {
                pdf.text(line, margin, yPos);
                yPos += 6;
            });

            yPos += 10;
        }

        // Calculate statistics
        const stats = this.calculateStatistics();

        // Statistics Table
        pdf.setTextColor(...primaryColor);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Resource Statistics (5-minute average)', margin, yPos);
        yPos += 10;

        // Table header
        const colWidths = [50, 30, 30, 30, 40];
        const headers = ['Resource', 'Average', 'Min', 'Max', 'Current'];

        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 10, 'F');

        pdf.setTextColor(...textColor);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');

        let xPos = margin;
        headers.forEach((header, i) => {
            pdf.text(header, xPos + 2, yPos);
            xPos += colWidths[i];
        });
        yPos += 8;

        // Table rows
        pdf.setFont('helvetica', 'normal');

        const rows = [
            ['CPU Usage (%)', stats.cpu.avg, stats.cpu.min, stats.cpu.max, stats.cpu.current],
            ['Memory Usage (%)', stats.memory.avg, stats.memory.min, stats.memory.max, stats.memory.current],
            ['GPU Usage (%)', stats.gpu.avg, stats.gpu.min, stats.gpu.max, stats.gpu.current],
            ['Download (Mbps)', stats.networkDown.avg, stats.networkDown.min, stats.networkDown.max, stats.networkDown.current],
            ['Upload (Mbps)', stats.networkUp.avg, stats.networkUp.min, stats.networkUp.max, stats.networkUp.current]
        ];

        rows.forEach((row, rowIndex) => {
            if (rowIndex % 2 === 0) {
                pdf.setFillColor(249, 250, 251);
                pdf.rect(margin, yPos - 4, pageWidth - margin * 2, 8, 'F');
            }

            xPos = margin;
            row.forEach((cell, i) => {
                pdf.text(String(cell), xPos + 2, yPos);
                xPos += colWidths[i];
            });
            yPos += 8;
        });

        yPos += 15;

        // Temperature Info
        if (stats.cpuTemp.avg !== 'N/A' || stats.gpuTemp.avg !== 'N/A') {
            pdf.setTextColor(...primaryColor);
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Temperature Statistics', margin, yPos);
            yPos += 10;

            pdf.setTextColor(...textColor);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            if (stats.cpuTemp.avg !== 'N/A') {
                pdf.text(`CPU Temperature: Avg ${stats.cpuTemp.avg}°C, Max ${stats.cpuTemp.max}°C`, margin, yPos);
                yPos += 6;
            }

            if (stats.gpuTemp.avg !== 'N/A') {
                pdf.text(`GPU Temperature: Avg ${stats.gpuTemp.avg}°C, Max ${stats.gpuTemp.max}°C`, margin, yPos);
                yPos += 6;
            }

            yPos += 10;
        }

        // Disk Info
        if (this.collectedData.length > 0) {
            const diskInfo = this.collectedData[this.collectedData.length - 1].disk;

            pdf.setTextColor(...primaryColor);
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Disk Usage', margin, yPos);
            yPos += 10;

            pdf.setTextColor(...textColor);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            diskInfo.partitions.forEach(partition => {
                pdf.text(`${partition.device}: ${partition.used_gb} GB / ${partition.total_gb} GB (${partition.percent}%)`, margin, yPos);

                // Draw progress bar
                const barX = margin + 100;
                const barWidth = 60;
                const barHeight = 5;

                pdf.setFillColor(229, 231, 235);
                pdf.rect(barX, yPos - 4, barWidth, barHeight, 'F');

                const fillColor = partition.percent > 90 ? [239, 68, 68] :
                    partition.percent > 70 ? [245, 158, 11] : [16, 185, 129];
                pdf.setFillColor(...fillColor);
                pdf.rect(barX, yPos - 4, barWidth * partition.percent / 100, barHeight, 'F');

                yPos += 8;
            });

            yPos += 10;
        }

        // Capture charts as images
        yPos = this.addNewPageIfNeeded(pdf, yPos, 100);

        pdf.setTextColor(...primaryColor);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Usage Charts (5-minute history)', margin, yPos);
        yPos += 10;

        // Capture CPU chart
        try {
            const cpuCanvas = document.getElementById('cpuChart');
            const cpuImage = cpuCanvas.toDataURL('image/png');
            pdf.addImage(cpuImage, 'PNG', margin, yPos, 80, 40);
            pdf.setTextColor(...mutedColor);
            pdf.setFontSize(8);
            pdf.text('CPU Usage', margin, yPos + 43);

            const memCanvas = document.getElementById('memoryChart');
            const memImage = memCanvas.toDataURL('image/png');
            pdf.addImage(memImage, 'PNG', margin + 90, yPos, 80, 40);
            pdf.text('Memory Usage', margin + 90, yPos + 43);

            yPos += 55;

            const gpuCanvas = document.getElementById('gpuChart');
            const gpuImage = gpuCanvas.toDataURL('image/png');
            pdf.addImage(gpuImage, 'PNG', margin, yPos, 80, 40);
            pdf.text('GPU Usage', margin, yPos + 43);

            const netCanvas = document.getElementById('networkChart');
            const netImage = netCanvas.toDataURL('image/png');
            pdf.addImage(netImage, 'PNG', margin + 90, yPos, 80, 40);
            pdf.text('Network Traffic', margin + 90, yPos + 43);

            yPos += 55;
        } catch (error) {
            console.error('Failed to capture charts:', error);
        }

        // Steam Compatibility Section - New Page
        pdf.addPage();
        yPos = margin;

        pdf.setFillColor(17, 24, 39);
        pdf.rect(0, 0, pageWidth, 30, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Steam Top 10 Game Compatibility', margin, 20);

        yPos = 40;

        // Get Steam compatibility data
        try {
            const response = await fetch('/api/steam-compatibility');
            const steamData = await response.json();

            // System specs
            pdf.setTextColor(...primaryColor);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Your System Specs', margin, yPos);
            yPos += 8;

            pdf.setTextColor(...textColor);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');

            const specs = steamData.system_specs;
            pdf.text(`CPU: ${specs.processor}`, margin, yPos); yPos += 6;
            pdf.text(`RAM: ${specs.ram_gb} GB`, margin, yPos); yPos += 6;
            pdf.text(`GPU VRAM: ${specs.gpu_vram_gb} GB`, margin, yPos); yPos += 6;
            pdf.text(`Available Storage: ${specs.available_storage_gb} GB`, margin, yPos); yPos += 12;

            // Games table
            pdf.setTextColor(...primaryColor);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Game Compatibility', margin, yPos);
            yPos += 8;

            // Table header
            const gameColWidths = [70, 20, 20, 20, 20, 30];
            const gameHeaders = ['Game', 'CPU', 'RAM', 'GPU', 'Storage', 'Status'];

            pdf.setFillColor(243, 244, 246);
            pdf.rect(margin, yPos - 5, pageWidth - margin * 2, 10, 'F');

            pdf.setTextColor(...textColor);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');

            xPos = margin;
            gameHeaders.forEach((header, i) => {
                pdf.text(header, xPos + 2, yPos);
                xPos += gameColWidths[i];
            });
            yPos += 8;

            // Game rows
            pdf.setFont('helvetica', 'normal');

            steamData.games.forEach((game, rowIndex) => {
                if (rowIndex % 2 === 0) {
                    pdf.setFillColor(249, 250, 251);
                    pdf.rect(margin, yPos - 4, pageWidth - margin * 2, 8, 'F');
                }

                xPos = margin;

                // Game name
                pdf.setTextColor(...textColor);
                pdf.text(game.name.substring(0, 28), xPos + 2, yPos);
                xPos += gameColWidths[0];

                // Status circles
                const checks = [game.checks.cpu, game.checks.ram, game.checks.gpu, game.checks.storage];
                checks.forEach((check, i) => {
                    pdf.setTextColor(check ? 16 : 239, check ? 185 : 68, check ? 129 : 68);
                    pdf.text(check ? '●' : '●', xPos + 8, yPos);
                    xPos += gameColWidths[i + 1];
                });

                // Status text
                const statusColor = game.status === 'compatible' ? [16, 185, 129] :
                    game.status === 'partial' ? [245, 158, 11] : [239, 68, 68];
                pdf.setTextColor(...statusColor);
                pdf.text(game.status === 'compatible' ? 'OK' :
                    game.status === 'partial' ? 'Partial' : 'No', xPos + 2, yPos);

                yPos += 8;
            });

        } catch (error) {
            console.error('Failed to load Steam data for PDF:', error);
        }

        // Footer
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setTextColor(...mutedColor);
            pdf.setFontSize(8);
            pdf.text(
                `Page ${i} of ${totalPages} | System Resource Monitor Report`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }

        // Save PDF
        const filename = `System_Monitor_Report_${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}.pdf`;
        pdf.save(filename);
    }

    addNewPageIfNeeded(pdf, yPos, neededSpace) {
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;

        if (yPos + neededSpace > pageHeight - margin) {
            pdf.addPage();
            return margin;
        }
        return yPos;
    }

    calculateStatistics() {
        const data = this.collectedData;

        if (data.length === 0) {
            return {
                cpu: { avg: 'N/A', min: 'N/A', max: 'N/A', current: 'N/A' },
                memory: { avg: 'N/A', min: 'N/A', max: 'N/A', current: 'N/A' },
                gpu: { avg: 'N/A', min: 'N/A', max: 'N/A', current: 'N/A' },
                networkDown: { avg: 'N/A', min: 'N/A', max: 'N/A', current: 'N/A' },
                networkUp: { avg: 'N/A', min: 'N/A', max: 'N/A', current: 'N/A' },
                cpuTemp: { avg: 'N/A', max: 'N/A' },
                gpuTemp: { avg: 'N/A', max: 'N/A' }
            };
        }

        const calcStats = (values) => {
            const filtered = values.filter(v => v !== null && v !== undefined);
            if (filtered.length === 0) return { avg: 'N/A', min: 'N/A', max: 'N/A', current: 'N/A' };

            return {
                avg: (filtered.reduce((a, b) => a + b, 0) / filtered.length).toFixed(1),
                min: Math.min(...filtered).toFixed(1),
                max: Math.max(...filtered).toFixed(1),
                current: filtered[filtered.length - 1].toFixed(1)
            };
        };

        const cpuValues = data.map(d => d.cpu?.usage_percent);
        const memValues = data.map(d => d.memory?.percent);
        const gpuValues = data.map(d => d.gpu?.[0]?.load_percent || 0);
        const networkDownValues = data.map(d => d.network?.download_speed_mbps || 0);
        const networkUpValues = data.map(d => d.network?.upload_speed_mbps || 0);
        const cpuTempValues = data.map(d => d.cpu?.temperature).filter(t => t !== null);
        const gpuTempValues = data.map(d => d.gpu?.[0]?.temperature).filter(t => t !== null);

        return {
            cpu: calcStats(cpuValues),
            memory: calcStats(memValues),
            gpu: calcStats(gpuValues),
            networkDown: calcStats(networkDownValues),
            networkUp: calcStats(networkUpValues),
            cpuTemp: cpuTempValues.length > 0 ? {
                avg: (cpuTempValues.reduce((a, b) => a + b, 0) / cpuTempValues.length).toFixed(1),
                max: Math.max(...cpuTempValues).toFixed(1)
            } : { avg: 'N/A', max: 'N/A' },
            gpuTemp: gpuTempValues.length > 0 ? {
                avg: (gpuTempValues.reduce((a, b) => a + b, 0) / gpuTempValues.length).toFixed(1),
                max: Math.max(...gpuTempValues).toFixed(1)
            } : { avg: 'N/A', max: 'N/A' }
        };
    }
}

// Initialize PDF exporter
document.addEventListener('DOMContentLoaded', () => {
    window.pdfExporter = new PDFExporter();
});
