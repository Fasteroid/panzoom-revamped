/**
 * Throws an error.
 * Pass additional arguments for context where applicable.
 */
function fail(msg: string, ...objects: any[]): never {
    console.error(...objects)
    throw new Error(msg);
}

function cancel(e: Event){
    e.preventDefault();
    e.stopPropagation();
}

type PanzoomTransform = {
    x: number
    y: number
    zoom: number
}

type ClientPos = {
    clientX: number
    clientY: number
}

interface ArrayLike<T> {
    readonly length: number
    [index: number]: T;
}

function average(touches: ArrayLike<ClientPos>): ClientPos {
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

function distance(a: ClientPos, b: ClientPos){
    return Math.sqrt( (a.clientX - b.clientX)**2 + (a.clientY - b.clientY)**2 );
}

/**
 * Passing the midpoint and two points will yield the same result as normal distance,
 * so this is an extension of the usual panzoom approach that should work with any number
 * of contact points.
 */
function totalDistance(center: ClientPos, others: ArrayLike<ClientPos>){
    let dist = 0;
    for (let i = 0; i < others.length; i++) {
        const pos = others[i];
        dist += distance(pos, center);
    }
    return dist;
}

export class Panzoom {


    /** 
     * Don't modify this directly unless you really know what you're doing.
     * Use {@linkcode editTransform} instead so the visuals update.
     */
    private _transform: PanzoomTransform = {
        x: 0,
        y: 0,
        zoom: 1
    }

    /**
     * Modifies the internal transform then updates it on the panzoom element
     */
    public editTransform( change: (t: PanzoomTransform) => void ){
        const t = this._transform;
        change(t);
        this.element.style.transform = `matrix(${t.zoom}, 0, 0, ${t.zoom}, ${t.x}, ${t.y})`
    }

    /**
     * Gets a copy of the internal transform
     */
    public getTransform(): PanzoomTransform {
        return {
            x: this._transform.x,
            y: this._transform.y,
            zoom: this._transform.zoom
        }
    }

    /** Converts a document-space position to a container-space position */
    public docToContainer(pos: ClientPos): ClientPos {
        const bounds = this.container.getBoundingClientRect();
            
        return {
            clientX: pos.clientX - bounds.x - bounds.width / 2,
            clientY: pos.clientY - bounds.y - bounds.height / 2
        }
    }

    /** Converts a container-space position to a child-space position (no scaling) */
    public containerToChild(pos: ClientPos): ClientPos {
        return {
            clientX: pos.clientX - this._transform.x,
            clientY: pos.clientY - this._transform.y
        }
    }

    /**
     * What scrolling one wheel click towards you multiplies the zoom factor by.
     */
    public wheelZoomRate: number = 1.1;
    

    /**
     * The container for the panzoom element
     */
    protected container: HTMLElement;


    /**
     * Constructs a panzoom for the element, with the parent serving as the boundary
     * @param element - the element
     */
    constructor(protected element: HTMLElement){
        this.container = element.parentElement ?? fail("The element needs a valid parent to be panzoomable.", element)

        // drag and select will fuck us up, so prevent them
        this.container.addEventListener('selectstart', cancel)
        this.container.addEventListener('dragstart', cancel)

        this.container.addEventListener('mousedown', (e) => {
            this.startMousePan(e);
        });

        this.container.addEventListener('touchstart', (e) => {
            this.startTouchPanzoom(e);
        })

        this.container.addEventListener('wheel', (e: WheelEvent) => {

            const factor = e.deltaY < 0 ? this.wheelZoomRate : 1 / this.wheelZoomRate

            let oldZoomPoint = this.containerToChild ( this.docToContainer(e) );

            /*
                // if we were to scale as-is, where would the mouse end up?
                // subtract how it moves from the final transformation to keep it in the same place relative to the panzoom child.

                let newZoomPoint = {
                    clientX: oldZoomPoint.clientX * factor,
                    clientY: oldZoomPoint.clientY * factor
                }

                let err_x = newZoomPoint.clientX - oldZoomPoint.clientX;
                let err_y = newZoomPoint.clientY - oldZoomPoint.clientY;
            */

            // through a little algebra, the above becomes the following:
            let err_x = oldZoomPoint.clientX * (factor - 1);
            let err_y = oldZoomPoint.clientY * (factor - 1);

            this.editTransform( (t) => {
                t.zoom *= factor
                t.x -= err_x
                t.y -= err_y
            } )

        })

        // this.element.addEventListener('mousedown', () => { console.log("clicked the cat") })
    }

    private lastMousePos: ClientPos | undefined;

    protected startMousePan(e: MouseEvent){

        if( this.lastMousePos ) return;

        this.lastMousePos = e;
        const mousePanCallback = (e: MouseEvent) => {
            const lastPos = this.lastMousePos ?? e;

            const dx = e.clientX - lastPos.clientX;
            const dy = e.clientY - lastPos.clientY;
            
            this.editTransform( (t) => {
                t.x += dx
                t.y += dy
            } )

            this.lastMousePos = e;
        }

        this.container.addEventListener('mousemove', mousePanCallback);

        const mousePanEnd = () => {
            this.container.removeEventListener('mousemove', mousePanCallback);
            document.removeEventListener('mouseup', mousePanEnd)
            this.lastMousePos = undefined;
        }

        document.addEventListener('mouseup', mousePanEnd)
    }

    private lastTouchAverage:  ClientPos | undefined;
    private lastTouchCount:    number | undefined;
    private lastTouchDistance: number | undefined;

    protected startTouchPanzoom(e: TouchEvent) {

        if( this.lastTouchAverage ) return;

        this.lastTouchAverage  = average( e.touches );
        this.lastTouchCount    = e.touches.length;
        this.lastTouchDistance = totalDistance( this.lastTouchAverage, e.touches )

        const touchPanzoomCallback = (e: TouchEvent) => {
            e.preventDefault();

            const thisTouchCount    = e.touches.length;
            const thisTouchAverage  = average(e.touches);
            const thisTouchDistance = totalDistance( thisTouchAverage, e.touches );

            if( this.lastTouchCount === thisTouchCount ){ // ignore one frame if another point connects to prevent discontinuous jump

                const lastTouchAverage = this.lastTouchAverage ?? thisTouchAverage;
                const lastTouchDistance = this.lastTouchDistance ?? thisTouchDistance;

                let factor = thisTouchDistance / lastTouchDistance;
                if( factor !== factor ){ // did we get NaN?
                    factor = 1; // pretend it's fine
                }

                console.log(factor)

                const dx = thisTouchAverage.clientX - lastTouchAverage.clientX;
                const dy = thisTouchAverage.clientY - lastTouchAverage.clientY;
                
                this.editTransform( (t) => {
                    t.x += dx
                    t.y += dy
                    t.zoom *= factor
                } )

            }

            this.lastTouchAverage  = thisTouchAverage;
            this.lastTouchCount    = thisTouchCount;
            this.lastTouchDistance = thisTouchDistance
        }

        this.container.addEventListener('touchmove', touchPanzoomCallback);

        const touchPanzoomEnd = (e: TouchEvent) => {
            if( e.touches.length !== 0 ) return;
            this.container.removeEventListener('touchmove', touchPanzoomCallback);
            document.removeEventListener('touchend', touchPanzoomEnd)
            this.lastTouchAverage = undefined;
        }

        document.addEventListener('touchend', touchPanzoomEnd)
    }

}