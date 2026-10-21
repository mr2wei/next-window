import { useState, useEffect } from 'react'
import { processInfo } from '../types/win-api-types'
import '../styles/dashboard.css'

export default function Dashboard() {
    const [currentForegroundInfo, setCurrentForegroundInfo] = useState<processInfo | null>(null);
    const [readFailed, setReadFailed] = useState(false);

    const handleForegroundChange = (data: processInfo, isTitleChanged: boolean, readFailed: boolean) => {
        setReadFailed(readFailed);
        if (!readFailed) {
            setCurrentForegroundInfo(data);
        }
    };

    useEffect(() => {
        window.winApi.getForegroundInfo().then(setCurrentForegroundInfo);

        const stop = window.winApi.onForegroundChange(handleForegroundChange);
        return () => stop();
    }, []);

    return (
        <div className="page dashboard">
            <h1 className="page-title">Dashboard</h1>
            <div className="page-content">
                <div className="page-content-card">
                    <h2 className={`page-content-card-title ${readFailed ? 'error' : ''}`}>Current Process Name</h2>
                    <div className="page-content-card-text-content">
                        <p>{currentForegroundInfo?.processName}</p>
                    </div>
                </div>
                <div className="page-content-card">
                    <h2 className={`page-content-card-title ${readFailed ? 'error' : ''}`}>Current Process Title</h2>
                    <div className="page-content-card-text-content">
                        <p>{currentForegroundInfo?.title}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}