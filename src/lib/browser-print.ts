type BrowserPrintDevice = {
  uid?: string;
  name?: string;
  send: (
    data: string,
    success?: (value?: unknown) => void,
    error?: (message?: unknown) => void
  ) => void;
};

type BrowserPrintApi = {
  getDefaultDevice: (
    type: "printer",
    success: (device: BrowserPrintDevice | null) => void,
    error: (message?: unknown) => void
  ) => void;
};

function getBrowserPrint(): BrowserPrintApi | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    globalThis as typeof globalThis & {
      BrowserPrint?: BrowserPrintApi;
    }
  ).BrowserPrint ?? null;
}

export async function sendZplToBrowserPrint(zpl: string) {
  const browserPrint = getBrowserPrint();
  if (!browserPrint) {
    throw new Error("Zebra Browser Print is not available in this browser.");
  }

  const device = await new Promise<BrowserPrintDevice>((resolve, reject) => {
    browserPrint.getDefaultDevice(
      "printer",
      (selectedDevice) => {
        if (!selectedDevice) {
          reject(new Error("No Zebra printer is connected to Browser Print."));
          return;
        }
        resolve(selectedDevice);
      },
      (message) => reject(new Error(String(message ?? "Unable to reach Browser Print.")))
    );
  });

  await new Promise<void>((resolve, reject) => {
    device.send(
      zpl,
      () => resolve(),
      (message) => reject(new Error(String(message ?? "Zebra print failed.")))
    );
  });
}
