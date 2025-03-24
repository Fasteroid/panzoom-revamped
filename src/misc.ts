export function fail(msg: string, ...objects: any[]): never {
    console.error(...objects)
    throw new Error(msg);
}

export function cancel(e: Event){
    e.preventDefault();
    e.stopPropagation();
}