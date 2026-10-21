export interface processInfo {
    hwnd: bigint | null;
    pid: number;
    processName: string;
    processPath: string;
    title: string;
}

export interface functionListenerInfo {
    listenerCbs: ((data: processInfo, isTitleChanged: boolean, readFailed: boolean) => void)[];
    callback: bigint | null;
    fgHook: bigint | null;
    nameHook: bigint | null;
}