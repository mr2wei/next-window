import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import v8 from "node:v8";
import { Prediction, TransitionMatrix, TransitionState } from "../types/optimiser-types";

const LAMBDA_SHORT = Math.pow(0.5, 1 / 50);   // half-life: 50 switches
const LAMBDA_LONG = Math.pow(0.5, 1 / 5000); // half-life: 5000 switches

const SHORT_TERM_WEIGHT = 0.75;

const state: TransitionState = loadTransitions();

function transitionsPath(): string {
    return path.join(app.getPath("userData"), "transitions.bin");
}

export function loadTransitions(): TransitionState {
    let raw: Buffer;
    try {
        raw = fs.readFileSync(transitionsPath());
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { matrix: new Map(), step: 0 };
        }
        throw err;
    }
    return v8.deserialize(raw) as TransitionState;
}

export function saveTransitions(matrix: TransitionMatrix, step: number): void {
    const target = transitionsPath();
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, v8.serialize({ matrix, step }));
    fs.renameSync(tmp, target);
}

export function predict(processName: string): Prediction[] {
    const matrix = new Map(state.matrix.get(processName));
    if (matrix.size === 0) return [];
    matrix.forEach((cell, key) => {
        matrix.set(key, {
            shortCount: cell.shortCount * Math.pow(LAMBDA_SHORT, state.step - cell.lastStep),
            longCount: cell.longCount * Math.pow(LAMBDA_LONG, state.step - cell.lastStep),
            lastStep: state.step
        });
    });
    const shortTotal = Array.from(matrix.values()).reduce((acc, cell) => acc + cell.shortCount, 0);
    const longTotal = Array.from(matrix.values()).reduce((acc, cell) => acc + cell.longCount, 0);
    return Array.from(matrix.entries()).map(([key, cell]) => ({
        process: key,
        probability:
            (shortTotal === 0 ? 0 : cell.shortCount / shortTotal) * SHORT_TERM_WEIGHT +
            (longTotal === 0 ? 0 : cell.longCount / longTotal) * (1 - SHORT_TERM_WEIGHT)
    })).sort((a, b) => b.probability - a.probability);
}

export function update(from: string, to: string): void {
    state.step++;
    const matrix = state.matrix.get(from);
    if (!matrix){
        state.matrix.set(from, new Map([[to, { shortCount: 1, longCount: 1, lastStep: state.step }]]));
        return;
    }
    const cell = matrix.get(to);
    if (!cell){
        matrix.set(to, { shortCount: 1, longCount: 1, lastStep: state.step });
        return;
    }
    cell.shortCount = cell.shortCount * Math.pow(LAMBDA_SHORT, state.step - cell.lastStep) + 1;
    cell.longCount = cell.longCount * Math.pow(LAMBDA_LONG, state.step - cell.lastStep) + 1;
    cell.lastStep = state.step;
}