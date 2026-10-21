
export type TransitionCell = {
    shortCount: number;
    longCount: number;
    lastStep: number;
};

export type TransitionMatrix = Map<string, Map<string, TransitionCell>>;

export type TransitionState = { matrix: TransitionMatrix; step: number };

export type Prediction = { 
    process: string; 
    probability: number 
};