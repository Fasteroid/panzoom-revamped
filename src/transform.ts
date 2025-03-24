export type PanzoomTransform = {
    x: number
    y: number
    zoom: number
}

/**
 * Gets the transformation matrix for a {@linkcode PanzoomTransform}
 */
export function getMatrix(t: PanzoomTransform) {
    return `matrix(${t.zoom}, 0, 0, ${t.zoom}, ${t.x}, ${t.y})`
}

class PanzoomMatrixParseError extends Error {
    constructor(public readonly matrix: string){
        super(`failed to parse panzoom matrix: ${matrix}`);
    }
}

const MATRIX_PARSE_REGEX = /matrix\((-?\d+(?:\.\d+)?), 0, 0, (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/
export function parseMatrix(s: string): PanzoomTransform {
    const match = MATRIX_PARSE_REGEX.exec(s);
    if( match === null ) throw new PanzoomMatrixParseError(s);

    const parsed: PanzoomTransform = {
        x:    parseFloat( match[3] ),
        y:    parseFloat( match[4] ),
        zoom: parseFloat( match[1] ),
    }

    // make sure they were valid numbers
    if(
        (parsed.x !== parsed.x) ||
        (parsed.y !== parsed.y) ||
        (parsed.zoom !== parsed.zoom)
    ){
        throw new PanzoomMatrixParseError(s);;
    }

    return parsed;
}