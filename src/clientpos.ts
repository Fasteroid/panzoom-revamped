
export type ClientPos = {
    clientX: number
    clientY: number
}

export interface ArrayLike<T> {
    readonly length: number
    [index: number]: T;
}

export function average(touches: ArrayLike<ClientPos>): ClientPos {
    const pos: ClientPos = {
        clientX: 0,
        clientY: 0
    }

    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        pos.clientX += touch.clientX;
        pos.clientY += touch.clientY;
    }

    pos.clientX /= touches.length;
    pos.clientY /= touches.length;

    return pos;
}

export function distance(a: ClientPos, b: ClientPos){
    return Math.sqrt( (a.clientX - b.clientX)**2 + (a.clientY - b.clientY)**2 );
}

/**
 * Passing the midpoint and two points will yield the same result as distance between those two,
 * so this is an extension of the usual panzoom approach that should work with any number
 * of contact points.
 */
export function totalDistance(center: ClientPos, others: ArrayLike<ClientPos>){
    let dist = 0;
    for (let i = 0; i < others.length; i++) {
        const pos = others[i];
        dist += distance(pos, center);
    }
    return dist;
}