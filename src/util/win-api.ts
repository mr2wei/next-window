import path from 'node:path'
import koffi from 'koffi'
import { functionListenerInfo, processInfo } from '../types/win-api-types'

const lib = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

const HANDLE = koffi.pointer('HANDLE', koffi.opaque())
const HWND = koffi.alias('HWND', HANDLE)
const HWINEVENTHOOK = koffi.alias('HWINEVENTHOOK', HANDLE)

const EVENT_SYSTEM_FOREGROUND = 0x0003
const EVENT_OBJECT_NAMECHANGE = 0x800c
const WINEVENT_OUTOFCONTEXT = 0x0000
const WINEVENT_SKIPOWNPROCESS = 0x0002
const OBJID_WINDOW = 0
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

const WinEventProc = koffi.proto(
    'void __stdcall WinEventProc(HWINEVENTHOOK hWinEventHook, uint32_t event, HWND hwnd, int32_t idObject, int32_t idChild, uint32_t idEventThread, uint32_t dwmsEventTime)'
)

const GetForegroundWindow = lib.func('HWND __stdcall GetForegroundWindow()')
const IsWindowVisible = lib.func('bool __stdcall IsWindowVisible(HWND hWnd)')
const GetWindowTextW = lib.func('int __stdcall GetWindowTextW(HWND hWnd, _Out_ uint16_t *lpString, int nMaxCount)')
const GetWindowThreadProcessId = lib.func('uint32_t __stdcall GetWindowThreadProcessId(HWND hWnd, _Out_ uint32_t *lpdwProcessId)')
const SetWinEventHook = lib.func(
    'HWINEVENTHOOK __stdcall SetWinEventHook(uint32_t eventMin, uint32_t eventMax, HANDLE hmodWinEventProc, WinEventProc *pfnWinEventProc, uint32_t idProcess, uint32_t idThread, uint32_t dwFlags)'
)
const UnhookWinEvent = lib.func('bool __stdcall UnhookWinEvent(HWINEVENTHOOK hWinEventHook)')

const OpenProcess = kernel32.func('HANDLE __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)')
const QueryFullProcessImageNameW = kernel32.func(
    'bool __stdcall QueryFullProcessImageNameW(HANDLE hProcess, uint32_t dwFlags, _Out_ uint16_t *lpExeName, _Inout_ uint32_t *lpdwSize)'
)
const CloseHandle = kernel32.func('bool __stdcall CloseHandle(HANDLE hObject)')

const callbackMap: Map<string, functionListenerInfo> = new Map();


function getWindowTitle(hwnd: bigint | null): string {
    if (!hwnd) return ''
    const buf = Buffer.alloc(512 * 2) // 512 WCHARs
    const len = GetWindowTextW(hwnd, buf, 512) as number
    return len ? buf.toString('utf16le', 0, len * 2) : ''
}

function getWindowProcessInfo(hwnd: bigint | null): processInfo {
    if (!hwnd) return { hwnd: null, pid: 0, processName: '', processPath: '', title: '' }
    const pidOut: [number] = [0]
    GetWindowThreadProcessId(hwnd, pidOut)
    const pid = pidOut[0]
    if (!pid) return { hwnd, pid: 0, processName: '', processPath: '', title: getWindowTitle(hwnd) }

    const hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) as bigint | null
    if (!hProcess) return { hwnd, pid, processName: '', processPath: '', title: getWindowTitle(hwnd) }

    const buf = Buffer.alloc(1024 * 2)
    const sizeOut: [number] = [1024]
    const ok = QueryFullProcessImageNameW(hProcess, 0, buf, sizeOut) as boolean
    CloseHandle(hProcess)

    const processPath = ok ? buf.toString('utf16le', 0, sizeOut[0] * 2) : ''
    const processName = processPath ? path.basename(processPath) : ''
    return { hwnd, pid, processName, processPath, title: getWindowTitle(hwnd) }
}

export function getForegroundInfo(): processInfo {
    const hwnd = GetForegroundWindow()
    return getWindowProcessInfo(hwnd ? koffi.address(hwnd) : null)
}

export function onForegroundChange(onChange: (data: processInfo, isTitleChanged: boolean, readFailed: boolean) => void): () => void {

    if (!callbackMap.has('foregroundChange')) {
        callbackMap.set('foregroundChange', {
            listenerCbs: [],
            callback: null,
            fgHook: null,
            nameHook: null
        })
    }

    const entry = callbackMap.get('foregroundChange')!; // guaranteed to exist

    if (!entry.callback) {
        let current = getForegroundInfo()

        const callback = koffi.register(
            (_hook: bigint, event: number, hwnd: bigint | null, idObject: number) => {
                if (event === EVENT_SYSTEM_FOREGROUND) {
                    const address = hwnd ? koffi.address(hwnd) : null;
                    if (address === current.hwnd) return;
                    current = getWindowProcessInfo(address);
                    // onChange(current, false, (current.processName === ''))
                    [...entry.listenerCbs].forEach(cb => cb(current, false, (current.processName === '')));
                } else if (event === EVENT_OBJECT_NAMECHANGE) {
                    if (idObject !== OBJID_WINDOW || !hwnd) return;

                    const address = koffi.address(hwnd);

                    if (address !== current.hwnd) return;

                    const newTitle = getWindowTitle(hwnd);

                    if (newTitle === current.title) return;
                    current = { ...current, title: newTitle };
                    // onChange(current, true, false)
                    [...entry.listenerCbs].forEach(cb => cb(current, true, false));
                }
            },
            koffi.pointer(WinEventProc)
        )
        const flags = WINEVENT_OUTOFCONTEXT;

        const fgHook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            null,
            callback,
            0,
            0,
            flags
        ) as bigint;
        const nameHook = SetWinEventHook(
            EVENT_OBJECT_NAMECHANGE,
            EVENT_OBJECT_NAMECHANGE,
            null,
            callback,
            0,
            0,
            flags
        ) as bigint;

        entry.callback = callback;  
        entry.fgHook = fgHook;
        entry.nameHook = nameHook;
    }


    entry.listenerCbs.push(onChange);

    return () => {
        const i = entry.listenerCbs.indexOf(onChange);
        if (i === -1) return // already unsubscribed: idempotent
        entry.listenerCbs.splice(i, 1);
        if (entry.listenerCbs.length === 0) {
            callbackMap.delete('foregroundChange');
            if (entry.fgHook) UnhookWinEvent(entry.fgHook);
            if (entry.nameHook) UnhookWinEvent(entry.nameHook);
            koffi.unregister(entry.callback as bigint);
        }
    }
}