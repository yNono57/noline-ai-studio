import "server-only";

import { ForgeRuntimeError, type ForgeRuntimeProvider } from "./runtime-foundation";

function unavailable(): never { throw new ForgeRuntimeError("UNAVAILABLE", "Aucun provider runtime isolé n’est configuré."); }

export const unprovisionedRuntimeProvider: ForgeRuntimeProvider = {
  name: "unprovisioned",
  provisioningAvailable: false,
  async createRuntime() { return unavailable(); },
  async getRuntime() { return unavailable(); },
  async destroyRuntime() { unavailable(); },
  async readFile() { return unavailable(); },
  async writeFile() { return unavailable(); },
  async listFiles() { return unavailable(); },
  async executeCommand() { return unavailable(); },
  async getGitStatus() { return unavailable(); },
  async getGitDiff() { return unavailable(); },
};
