import { spawnSync } from "node:child_process";
import process from "node:process";

/**
 * Libera de forma robusta uno o varios puertos terminando los procesos activos que los estén ocupando.
 * Adaptado de la práctica de AuroraHub para el ecosistema Biglex.
 */
export function freePort(port: number | string): boolean {
    const portNum = Number(port);
    if (!portNum || isNaN(portNum)) return false;

    const isWindows = process.platform === "win32";

    try {
        if (isWindows) {
            const psCmd = `Get-NetTCPConnection -LocalPort ${portNum} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`;
            spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCmd], {
                stdio: "ignore",
                windowsHide: true,
            });

            const netstat = spawnSync("cmd.exe", ["/c", `netstat -ano | findstr :${portNum}`], {
                encoding: "utf-8",
                windowsHide: true,
            });

            if (netstat.stdout) {
                const lines = netstat.stdout.split("\n");
                for (const line of lines) {
                    const match = line.trim().match(/LISTENING\s+(\d+)/i);
                    if (match && match[1]) {
                        const pid = match[1];
                        if (pid !== "0" && pid !== String(process.pid)) {
                            spawnSync("taskkill", ["/F", "/T", "/PID", pid], { stdio: "ignore", windowsHide: true });
                        }
                    }
                }
            }
        } else {
            spawnSync("sh", ["-c", `lsof -ti:${portNum} | xargs kill -9 2>/dev/null || fuser -k ${portNum}/tcp 2>/dev/null`], {
                stdio: "ignore",
            });
        }
        return true;
    } catch {
        return false;
    }
}

export function freePorts(ports: (number | string)[]): void {
    for (const p of ports) {
        freePort(p);
    }
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    const targetPorts = args.length > 0 ? args : [1421];
    for (const port of targetPorts) {
        freePort(port);
    }
}
