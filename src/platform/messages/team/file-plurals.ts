/** „1 Datei“, „42 Dateien“ (G4): the count of files in the file overview – also 0. */
export function filesCount(files: number): string {
  return files === 1 ? "1 Datei" : `${files} Dateien`;
}

/**
 * What a file hangs on after attaching (ST-115, G33), only the parts there are, in the dative the sentence needs
 * („hängt jetzt an 1 Gerät und 2 Modellen“): „1 Gerät“ or „3 Geräten“, „1 Modell“ or „2 Modellen“. Empty for none.
 */
export function attachedNowParts(machines: number, models: number): string[] {
  return [
    machines === 0 ? "" : machines === 1 ? "1 Gerät" : `${machines} Geräten`,
    models === 0 ? "" : models === 1 ? "1 Modell" : `${models} Modellen`,
  ].filter(Boolean);
}
