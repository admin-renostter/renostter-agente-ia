import fs from "fs";
import path from "path";

let _config: Record<string, unknown> | null = null;

export function getConfig(): Record<string, unknown> {
  if (_config) return _config;
  const configPath = path.join(process.cwd(), "setup.config.json");
  _config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  return _config!;
}
