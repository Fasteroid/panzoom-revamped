export class CircularArray<T> {
    protected ptr: number = 0;

    protected readonly _items: T[] = [];
    public readonly items: readonly T[] = this._items;

    protected _size: number;
    public get size(){ return this._size }
    public set size(s: number){
        this._size = s;
        this.clear();
    }

    constructor(size: number) { this._size = size }

    public push(item: T) {
        this._items[this.ptr] = item;
        this.ptr = (this.ptr + 1) % this.size;
    }

    public clear(){
        this._items.splice(0,this._items.length);
        this.ptr = 0;
    }
}