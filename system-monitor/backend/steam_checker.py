"""
Steam Top 10 Games Compatibility Checker
Compares system specs against minimum requirements
"""

from typing import Dict, Any, List
from dataclasses import dataclass


@dataclass
class GameRequirements:
    name: str
    cpu_benchmark: int  # PassMark score equivalent
    ram_gb: int
    gpu_vram_gb: float
    storage_gb: int
    image_url: str = ""


# Steam Top 10 Games (2024) - Minimum Requirements
# CPU benchmark scores are approximate PassMark equivalents
STEAM_TOP_10_GAMES: List[GameRequirements] = [
    GameRequirements(
        name="Black Myth: Wukong",
        cpu_benchmark=8000,  # i5-8400 / Ryzen 5 1600
        ram_gb=16,
        gpu_vram_gb=6,  # GTX 1060 6GB
        storage_gb=130,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/2358720/header.jpg"
    ),
    GameRequirements(
        name="Helldivers 2",
        cpu_benchmark=7500,  # i7-4790K / Ryzen 5 1500X
        ram_gb=8,
        gpu_vram_gb=4,  # GTX 1050 Ti
        storage_gb=100,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/553850/header.jpg"
    ),
    GameRequirements(
        name="Call of Duty: Black Ops 6",
        cpu_benchmark=5500,  # i5-6600 / Ryzen 5 1400
        ram_gb=8,
        gpu_vram_gb=2,  # GTX 960
        storage_gb=128,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/2933620/header.jpg"
    ),
    GameRequirements(
        name="Palworld",
        cpu_benchmark=5000,  # i5-3570K
        ram_gb=16,
        gpu_vram_gb=2,  # GTX 1050 2GB
        storage_gb=40,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/1623730/header.jpg"
    ),
    GameRequirements(
        name="Baldur's Gate 3",
        cpu_benchmark=5200,  # i5-4690 / FX 8350
        ram_gb=8,
        gpu_vram_gb=4,  # GTX 970
        storage_gb=150,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/1086940/header.jpg"
    ),
    GameRequirements(
        name="Counter-Strike 2",
        cpu_benchmark=3000,  # i5-750
        ram_gb=8,
        gpu_vram_gb=1,  # 1GB VRAM
        storage_gb=85,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg"
    ),
    GameRequirements(
        name="Elden Ring",
        cpu_benchmark=8000,  # i5-8400 / Ryzen 3 3300X
        ram_gb=12,
        gpu_vram_gb=3,  # GTX 1060 3GB
        storage_gb=60,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg"
    ),
    GameRequirements(
        name="Warhammer 40K: Space Marine 2",
        cpu_benchmark=9000,  # i5-8600K / Ryzen 5 2600X
        ram_gb=8,
        gpu_vram_gb=6,  # GTX 1060 6GB
        storage_gb=75,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/2183900/header.jpg"
    ),
    GameRequirements(
        name="Path of Exile 2",
        cpu_benchmark=7500,  # i7-7700 / Ryzen 5 2500X
        ram_gb=8,
        gpu_vram_gb=3,  # GTX 960 3GB
        storage_gb=100,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/2694490/header.jpg"
    ),
    GameRequirements(
        name="Apex Legends",
        cpu_benchmark=4000,  # i3-6300 / FX-4350
        ram_gb=6,
        gpu_vram_gb=1,  # GT 640
        storage_gb=75,
        image_url="https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg"
    ),
]


# Approximate CPU benchmark mapping (common CPUs -> PassMark scores)
CPU_BENCHMARKS = {
    # Intel
    "i9-14900": 60000,
    "i9-13900": 55000,
    "i9-12900": 40000,
    "i7-14700": 45000,
    "i7-13700": 40000,
    "i7-12700": 30000,
    "i7-11700": 22000,
    "i7-10700": 17000,
    "i7-9700": 14000,
    "i7-8700": 13000,
    "i7-7700": 10000,
    "i5-14600": 35000,
    "i5-13600": 30000,
    "i5-12600": 22000,
    "i5-11600": 18000,
    "i5-10600": 13000,
    "i5-10400": 12000,
    "i5-9400": 9500,
    "i5-8400": 8500,
    # AMD Ryzen
    "ryzen 9 7950": 60000,
    "ryzen 9 5950": 40000,
    "ryzen 9 5900": 35000,
    "ryzen 7 7800": 35000,
    "ryzen 7 5800": 28000,
    "ryzen 7 5700": 25000,
    "ryzen 7 3700": 22000,
    "ryzen 5 7600": 28000,
    "ryzen 5 5600": 22000,
    "ryzen 5 3600": 17000,
    "ryzen 5 2600": 14000,
    "ryzen 5 1600": 12000,
    "ryzen 3 3300": 10000,
}


def estimate_cpu_benchmark(processor_name: str) -> int:
    """Estimate CPU benchmark score from processor name"""
    processor_lower = processor_name.lower()
    
    for cpu_name, score in CPU_BENCHMARKS.items():
        if cpu_name.lower() in processor_lower:
            return score
    
    # Default fallback - assume mid-range if unknown
    if "i9" in processor_lower or "ryzen 9" in processor_lower:
        return 40000
    elif "i7" in processor_lower or "ryzen 7" in processor_lower:
        return 20000
    elif "i5" in processor_lower or "ryzen 5" in processor_lower:
        return 12000
    elif "i3" in processor_lower or "ryzen 3" in processor_lower:
        return 8000
    
    return 10000  # Default assumption


def check_game_compatibility(
    processor_name: str,
    ram_gb: float,
    gpu_vram_gb: float,
    available_storage_gb: float
) -> List[Dict[str, Any]]:
    """
    Check compatibility for all Steam Top 10 games
    Returns list of games with compatibility status
    """
    cpu_benchmark = estimate_cpu_benchmark(processor_name)
    results = []
    
    for game in STEAM_TOP_10_GAMES:
        cpu_ok = cpu_benchmark >= game.cpu_benchmark
        ram_ok = ram_gb >= game.ram_gb
        gpu_ok = gpu_vram_gb >= game.gpu_vram_gb
        storage_ok = available_storage_gb >= game.storage_gb
        
        all_ok = cpu_ok and ram_ok and gpu_ok and storage_ok
        partial = (cpu_ok or ram_ok or gpu_ok) and not all_ok
        
        if all_ok:
            status = "compatible"
            status_text = "✅ 실행 가능"
        elif partial:
            status = "partial"
            status_text = "⚠️ 일부 충족"
        else:
            status = "incompatible"
            status_text = "❌ 사양 부족"
        
        results.append({
            "name": game.name,
            "image_url": game.image_url,
            "requirements": {
                "cpu_benchmark": game.cpu_benchmark,
                "ram_gb": game.ram_gb,
                "gpu_vram_gb": game.gpu_vram_gb,
                "storage_gb": game.storage_gb
            },
            "checks": {
                "cpu": cpu_ok,
                "ram": ram_ok,
                "gpu": gpu_ok,
                "storage": storage_ok
            },
            "status": status,
            "status_text": status_text
        })
    
    return results


def get_games_list() -> List[Dict[str, Any]]:
    """Get list of Steam Top 10 games with requirements"""
    return [
        {
            "name": game.name,
            "image_url": game.image_url,
            "requirements": {
                "cpu_benchmark": game.cpu_benchmark,
                "ram_gb": game.ram_gb,
                "gpu_vram_gb": game.gpu_vram_gb,
                "storage_gb": game.storage_gb
            }
        }
        for game in STEAM_TOP_10_GAMES
    ]
