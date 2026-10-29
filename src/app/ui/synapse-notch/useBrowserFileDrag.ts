type Host = {
  postMessageWithAdditionalObjects(message: string, files: File[]): void;
};
function host(): Host | undefined { return (window as unknown as {chrome?: {webview?: Host}}).chrome?.webview; }

export function sendBrowserFileDrop(files: File[], action: string, text?: string) {
  const bridge = host();
  if (!bridge) throw new Error("WebView2 no expuso el puente de archivos");
  bridge.postMessageWithAdditionalObjects(JSON.stringify({kind: "prisma-synapse-drop", action, text}), files);
}
