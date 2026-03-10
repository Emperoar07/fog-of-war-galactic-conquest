const { spawnSync } = require("child_process");

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function toWslPath(windowsPath) {
  const normalized = windowsPath.replace(/\\/g, "/");
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!driveMatch) {
    return normalized;
  }

  const drive = driveMatch[1].toLowerCase();
  const rest = driveMatch[2];
  return `/mnt/${drive}/${rest}`;
}

const args = process.argv.slice(2);
let result;

if (process.platform === "win32") {
  const repoRoot = toWslPath(process.cwd());
  const forwardedArgs = args.map(shellQuote).join(" ");
  const command = [
    `cd ${shellQuote(repoRoot)}`,
    `bash scripts/wsl-arcium-build.sh${forwardedArgs ? ` ${forwardedArgs}` : ""}`,
  ].join(" && ");

  result = spawnSync("wsl.exe", ["bash", "-lc", command], {
    stdio: "inherit",
  });
} else {
  result = spawnSync("bash", ["scripts/wsl-arcium-build.sh", ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
