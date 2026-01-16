"""
System Resource Monitor Module
Collects CPU, Memory, Disk, Network, and GPU information
"""

import psutil
import platform
import time
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# GPU monitoring
try:
    import GPUtil
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

# Windows-specific temperature monitoring
try:
    import wmi
    WMI_AVAILABLE = True
except ImportError:
    WMI_AVAILABLE = False


class SystemMonitor:
    def __init__(self):
        self.last_net_io = psutil.net_io_counters()
        self.last_disk_io = psutil.disk_io_counters()
        self.last_time = time.time()
        
        # Initialize WMI for temperature (Windows)
        self.wmi_client = None
        if WMI_AVAILABLE and platform.system() == "Windows":
            try:
                self.wmi_client = wmi.WMI(namespace="root\\OpenHardwareMonitor")
                logger.info("WMI connected to OpenHardwareMonitor namespace")
            except (ConnectionError, PermissionError) as e:
                logger.warning(f"Failed to connect to OpenHardwareMonitor: {e}")
                try:
                    self.wmi_client = wmi.WMI(namespace="root\\wmi")
                    logger.info("WMI connected to root\\wmi namespace")
                except (ConnectionError, PermissionError) as e:
                    logger.warning(f"Failed to connect to WMI: {e}")
                    self.wmi_client = None

    def get_cpu_info(self) -> Dict[str, Any]:
        """Get CPU usage, frequency, and temperature"""
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_percent_per_core = psutil.cpu_percent(interval=0.1, percpu=True)
        cpu_freq = psutil.cpu_freq()
        cpu_count = psutil.cpu_count(logical=True)
        cpu_count_physical = psutil.cpu_count(logical=False)
        
        # Get CPU temperature (Windows - requires OpenHardwareMonitor)
        cpu_temp = None
        if self.wmi_client:
            try:
                sensors = self.wmi_client.Sensor()
                for sensor in sensors:
                    if sensor.SensorType == "Temperature" and "CPU" in sensor.Name:
                        cpu_temp = float(sensor.Value)
                        break
            except (AttributeError, TypeError, ValueError) as e:
                logger.debug(f"Failed to read CPU temperature: {e}")
            except Exception as e:
                logger.error(f"Unexpected error reading CPU temperature: {e}")
        
        return {
            "usage_percent": cpu_percent,
            "usage_per_core": cpu_percent_per_core,
            "frequency_current": cpu_freq.current if cpu_freq else 0,
            "frequency_max": cpu_freq.max if cpu_freq else 0,
            "cores_logical": cpu_count,
            "cores_physical": cpu_count_physical,
            "temperature": cpu_temp
        }

    def get_memory_info(self) -> Dict[str, Any]:
        """Get RAM usage information"""
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        return {
            "total": mem.total,
            "available": mem.available,
            "used": mem.used,
            "percent": mem.percent,
            "total_gb": round(mem.total / (1024 ** 3), 2),
            "available_gb": round(mem.available / (1024 ** 3), 2),
            "used_gb": round(mem.used / (1024 ** 3), 2),
            "swap_total_gb": round(swap.total / (1024 ** 3), 2),
            "swap_used_gb": round(swap.used / (1024 ** 3), 2),
            "swap_percent": swap.percent
        }

    def get_disk_info(self) -> Dict[str, Any]:
        """Get disk usage and I/O information"""
        partitions = []
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                partitions.append({
                    "device": partition.device,
                    "mountpoint": partition.mountpoint,
                    "fstype": partition.fstype,
                    "total_gb": round(usage.total / (1024 ** 3), 2),
                    "used_gb": round(usage.used / (1024 ** 3), 2),
                    "free_gb": round(usage.free / (1024 ** 3), 2),
                    "percent": usage.percent
                })
            except PermissionError:
                continue
        
        # Calculate I/O speed
        current_disk_io = psutil.disk_io_counters()
        current_time = time.time()
        time_delta = current_time - self.last_time
        
        if time_delta > 0:
            read_speed = (current_disk_io.read_bytes - self.last_disk_io.read_bytes) / time_delta
            write_speed = (current_disk_io.write_bytes - self.last_disk_io.write_bytes) / time_delta
        else:
            read_speed = 0
            write_speed = 0
        
        return {
            "partitions": partitions,
            "read_speed_mbps": round(read_speed / (1024 ** 2), 2),
            "write_speed_mbps": round(write_speed / (1024 ** 2), 2),
            "total_read_gb": round(current_disk_io.read_bytes / (1024 ** 3), 2),
            "total_write_gb": round(current_disk_io.write_bytes / (1024 ** 3), 2)
        }

    def get_network_info(self) -> Dict[str, Any]:
        """Get network traffic information"""
        current_net_io = psutil.net_io_counters()
        current_time = time.time()
        time_delta = current_time - self.last_time
        
        if time_delta > 0:
            download_speed = (current_net_io.bytes_recv - self.last_net_io.bytes_recv) / time_delta
            upload_speed = (current_net_io.bytes_sent - self.last_net_io.bytes_sent) / time_delta
        else:
            download_speed = 0
            upload_speed = 0
        
        # Update last values
        self.last_net_io = current_net_io
        self.last_time = current_time
        
        # Get network interfaces
        interfaces = []
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        
        for name, addresses in addrs.items():
            if name in stats:
                is_up = stats[name].isup
                speed = stats[name].speed
                for addr in addresses:
                    if addr.family.name == 'AF_INET':
                        interfaces.append({
                            "name": name,
                            "ip": addr.address,
                            "is_up": is_up,
                            "speed_mbps": speed
                        })
                        break
        
        return {
            "download_speed_mbps": round(download_speed * 8 / (1024 ** 2), 2),
            "upload_speed_mbps": round(upload_speed * 8 / (1024 ** 2), 2),
            "total_received_gb": round(current_net_io.bytes_recv / (1024 ** 3), 2),
            "total_sent_gb": round(current_net_io.bytes_sent / (1024 ** 3), 2),
            "packets_recv": current_net_io.packets_recv,
            "packets_sent": current_net_io.packets_sent,
            "interfaces": interfaces
        }

    def get_gpu_info(self) -> List[Dict[str, Any]]:
        """Get GPU information including Intel ARC, NVIDIA, and AMD GPUs"""
        gpus = []
        detected_gpu_names = set()
        
        # First try GPUtil for NVIDIA GPUs (provides detailed stats)
        if GPU_AVAILABLE:
            try:
                gpu_list = GPUtil.getGPUs()
                for gpu in gpu_list:
                    detected_gpu_names.add(gpu.name.lower())
                    gpus.append({
                        "id": gpu.id,
                        "name": gpu.name,
                        "vendor": "NVIDIA",
                        "load_percent": round(gpu.load * 100, 1),
                        "memory_total_gb": round(gpu.memoryTotal / 1024, 2),
                        "memory_used_gb": round(gpu.memoryUsed / 1024, 2),
                        "memory_free_gb": round(gpu.memoryFree / 1024, 2),
                        "memory_percent": round(gpu.memoryUtil * 100, 1) if gpu.memoryUtil else 0,
                        "temperature": gpu.temperature,
                        "driver": gpu.driver
                    })
            except (RuntimeError, AttributeError) as e:
                logger.warning(f"GPUtil error: {e}")
            except Exception as e:
                logger.error(f"Unexpected error in GPUtil: {e}")
        
        # Use WMI to detect ALL GPUs including Intel ARC and AMD
        if WMI_AVAILABLE and platform.system() == "Windows":
            try:
                wmi_client = wmi.WMI()
                video_controllers = wmi_client.Win32_VideoController()
                
                for idx, vc in enumerate(video_controllers):
                    gpu_name = vc.Name or "Unknown GPU"
                    
                    # Skip if already detected by GPUtil
                    if any(name in gpu_name.lower() for name in detected_gpu_names):
                        continue
                    
                    # Determine vendor
                    vendor = "Unknown"
                    if "intel" in gpu_name.lower():
                        vendor = "Intel"
                    elif "amd" in gpu_name.lower() or "radeon" in gpu_name.lower():
                        vendor = "AMD"
                    elif "nvidia" in gpu_name.lower() or "geforce" in gpu_name.lower():
                        vendor = "NVIDIA"
                    
                    # Get VRAM - try multiple methods
                    vram_gb, shared_memory_gb, is_integrated = self._get_gpu_vram(vc, gpu_name, vendor)
                    
                    # Get additional info
                    driver_version = vc.DriverVersion or "Unknown"
                    status = vc.Status or "Unknown"
                    
                    gpu_info = {
                        "id": len(gpus),
                        "name": gpu_name,
                        "vendor": vendor,
                        "load_percent": 0,  # WMI doesn't provide real-time load
                        "memory_total_gb": vram_gb,
                        "memory_used_gb": 0,  # Not available via WMI
                        "memory_free_gb": vram_gb,
                        "memory_percent": 0,
                        "temperature": None,  # Not available via standard WMI
                        "driver": driver_version,
                        "status": status,
                        "is_integrated": is_integrated,
                        "shared_memory_gb": shared_memory_gb
                    }
                    
                    # Try to get Intel GPU usage via Performance Counters
                    if vendor == "Intel":
                        gpu_info = self._get_intel_gpu_stats(gpu_info)
                    
                    gpus.append(gpu_info)

            except (ConnectionError, AttributeError) as e:
                logger.warning(f"WMI GPU detection error: {e}")
            except Exception as e:
                logger.error(f"Unexpected error in WMI GPU detection: {e}")
        
        return gpus
    
    def _get_gpu_vram(self, vc, gpu_name: str, vendor: str) -> tuple:
        """
        Get GPU VRAM using multiple methods to handle 32-bit overflow.
        Returns: (dedicated_vram_gb, shared_memory_gb, is_integrated)
        """
        vram_gb = 0
        shared_memory_gb = 0
        is_integrated = False
        
        # Check if this is an integrated GPU (Intel Arc Graphics without model number = integrated)
        # Discrete Intel ARC GPUs have model numbers like A380, A580, A750, A770
        if vendor == "Intel":
            gpu_name_lower = gpu_name.lower()
            # Intel Arc A-series are discrete, plain "Arc Graphics" is integrated
            if "arc" in gpu_name_lower and not any(model in gpu_name_lower for model in ["a310", "a380", "a580", "a750", "a770", "a350m", "a370m", "a550m", "a730m", "a770m"]):
                is_integrated = True
            elif "uhd" in gpu_name_lower or "iris" in gpu_name_lower:
                is_integrated = True
        
        # Method 1: Try WMI AdapterRAM (works for < 4GB)
        vram_bytes = vc.AdapterRAM or 0
        
        # Handle 32-bit signed integer overflow (negative value means > 2GB)
        if vram_bytes < 0:
            # Convert from signed to unsigned 32-bit
            vram_bytes = vram_bytes + (2 ** 32)
        
        if vram_bytes > 0:
            vram_gb = round(vram_bytes / (1024 ** 3), 2)
        
        # For integrated GPUs, calculate shared memory from system RAM
        if is_integrated:
            try:
                mem = psutil.virtual_memory()
                # Integrated GPUs can typically use up to half of system RAM
                shared_memory_gb = round(mem.total / (1024 ** 3) / 2, 1)
                # The reported VRAM is often just the initial allocation, 
                # actual usable memory is dynamic
            except Exception:
                pass
        
        # Method 2: Try reading from Windows Registry for accurate VRAM (for discrete GPUs)
        if not is_integrated and vram_gb <= 4:
            try:
                import winreg
                
                registry_paths = [
                    r"SOFTWARE\Intel\GMM",
                    r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000",
                    r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0001",
                ]
                
                for reg_path in registry_paths:
                    try:
                        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_path)
                        
                        for value_name in ["DedicatedSegmentSize", "HardwareInformation.qwMemorySize", 
                                          "HardwareInformation.MemorySize", "AdapterRAM"]:
                            try:
                                value, _ = winreg.QueryValueEx(key, value_name)
                                if value and value > 0:
                                    if value > 1024 * 1024 * 1024:
                                        reg_vram_gb = round(value / (1024 ** 3), 2)
                                    elif value > 1024:
                                        reg_vram_gb = round(value / 1024, 2)
                                    else:
                                        reg_vram_gb = value
                                    
                                    if reg_vram_gb > vram_gb:
                                        vram_gb = reg_vram_gb
                            except (FileNotFoundError, OSError):
                                continue
                        
                        winreg.CloseKey(key)
                    except (FileNotFoundError, OSError):
                        continue
                        
            except Exception:
                pass
        
        return (vram_gb, shared_memory_gb, is_integrated)
    
    def _get_intel_gpu_stats(self, gpu_info: Dict[str, Any]) -> Dict[str, Any]:
        """Try to get Intel GPU statistics using performance counters"""
        try:
            import subprocess
            
            # Try using PowerShell to get Intel GPU usage
            ps_command = '''
            $counter = Get-Counter -Counter "\\GPU Engine(*engtype_3D)\\Utilization Percentage" -ErrorAction SilentlyContinue
            if ($counter) {
                $values = $counter.CounterSamples | Where-Object { $_.CookedValue -gt 0 }
                if ($values) {
                    [math]::Round(($values | Measure-Object -Property CookedValue -Average).Average, 1)
                } else { 0 }
            } else { -1 }
            '''
            
            result = subprocess.run(
                ["powershell", "-Command", ps_command],
                capture_output=True,
                text=True,
                timeout=3
            )
            
            if result.returncode == 0:
                try:
                    usage = float(result.stdout.strip())
                    if usage >= 0:
                        gpu_info["load_percent"] = usage
                except ValueError:
                    pass
                    
        except Exception:
            pass
        
        return gpu_info

    def get_system_info(self) -> Dict[str, Any]:
        """Get static system information"""
        uname = platform.uname()
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        
        return {
            "system": uname.system,
            "node_name": uname.node,
            "release": uname.release,
            "version": uname.version,
            "machine": uname.machine,
            "processor": uname.processor,
            "boot_time": boot_time.isoformat(),
            "uptime_hours": round((time.time() - psutil.boot_time()) / 3600, 2)
        }

    def get_all_stats(self) -> Dict[str, Any]:
        """Get all system statistics"""
        return {
            "timestamp": datetime.now().isoformat(),
            "cpu": self.get_cpu_info(),
            "memory": self.get_memory_info(),
            "disk": self.get_disk_info(),
            "network": self.get_network_info(),
            "gpu": self.get_gpu_info(),
            "system": self.get_system_info()
        }


# Singleton instance
monitor = SystemMonitor()
