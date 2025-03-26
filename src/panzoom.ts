import { _PanzoomAnimation, PanzoomAnimation } from './animation.js';
import { Kinetic } from './kinetic.js';
import { cancel, fail } from './misc.js';
import { getMatrix, PanzoomTransform, PanzoomTransformCallback } from './transform.js';
import { average, ClientPos, totalDistance } from './vector.js';



const SCROLL_DIRECTION = {
    VERTICAL: false,
    HORIZONTAL: true
} as const;

export class Panzoom {


    /**
     * What scrolling one wheel click towards you multiplies the zoom factor by.
     */
    public wheelZoomRate: number = 1.1;

    /**
     * Maximum zoom factor
     */
    public maxZoom: number = 512;

    /**
     * Minimum zoom factor
     */
    public minZoom: number = 1 / this.maxZoom;

    /**
     * If set, ensures the user cannot lose the panzoomed element by dragging it completely outside the viewport,
     * with at least this many px of it remaining as a partial border.
     */
    public minVisible?: number | undefined;

    /**
     * The parent of the element passed to the constructor.
     */
    public readonly container: HTMLElement;

    /**
     * The kinetic scrolling controller for this panzoom
     */
    public readonly kinetic = new Kinetic();

    private readonly transform: PanzoomTransform = {
        x: 0,
        y: 0,
        zoom: 1
    }

    private readonly transformCallbacks = new Set<PanzoomTransformCallback>();

    /**
     * Modifies the internal transform then updates it on the panzoom element
     * @param change - how to modify the internal transform
     */
    public editTransform( change: (t: PanzoomTransform) => void ){
        const t = this.transform;
        change(t);
        this.transformCallbacks.forEach( cb => cb( this.getTransform() ) )
        this.element.style.transform = getMatrix(t);
    }

    /**
     * Gets a copy of the internal transform
     */
    public getTransform(): PanzoomTransform {
        return {
            x: this.transform.x,
            y: this.transform.y,
            zoom: this.transform.zoom
        }
    }

    /**
     * Adds a callback that will be called whenever the transform changes.

     * You can remove it by calling `unsubscribe` on the return value.
     * @param cb - the callback
     */
    public onTransformChanged( cb: PanzoomTransformCallback ) {
        this.transformCallbacks.add(cb);
        return {
            unsubscribe: () => this.transformCallbacks.delete(cb)
        }
    }

    /**
     * Like {@link editTransform}, but respects viewport constraints 
     * @param change - how to modify the internal transform
     */
    public editTransformConstrained( change: (t: PanzoomTransform) => void ) {

        const minVisible = this.minVisible ?? -Infinity

        const changed = this.getTransform();
        change(changed);

        let x = changed.x;
        let y = changed.y;
        
        const childRect    = this.element.getBoundingClientRect();
        const viewportRect = this.container.getBoundingClientRect();

        const factor  = this.clampZoomChangeMul( changed.zoom / this.transform.zoom );

        const newWidth = childRect.width * factor / 2;
        const newHeight = childRect.height * factor / 2;

        // check bounds once...
        let left = x + viewportRect.width / 2 + newWidth;
        if( left < minVisible ) {
            x += ( minVisible - left )
        }

        let top = y + viewportRect.height / 2 + newHeight;
        if( top < minVisible ) {
            y += ( minVisible - top )
        }

        const right = -x + viewportRect.width / 2 + newWidth;
        if( right < minVisible ) {
            x += ( right - minVisible )
        }

        const bottom = -y + viewportRect.height / 2 + newHeight;
        if( bottom < minVisible ) {
            y += ( bottom - minVisible )
        }

        // check the first two again; if they're invalid just center it instead
        left = x + viewportRect.width / 2 + newWidth;
        if( left < minVisible ) {
            x = 0;
        }

        top = y + viewportRect.height / 2 + newHeight;
        if( top < minVisible ) {
            y = 0;
        }

        this.editTransform((t) => {
            t.x = x
            t.y = y
            t.zoom = changed.zoom
        });
        
    }

    /**
     * The current animation (which could be finished), if any.
     */
    protected anim: PanzoomAnimation | undefined;

    /**
     * Computes a change to the internal transform and animates a transition towards it.
     * @param change - how to modify the internal transform
     * @param duration - how long the animation should last in milliseconds
     * @param easing - the css easing function to use
     */
    public async animateTransform( change: (t: PanzoomTransform) => void, duration: number = 500, easing: string = "ease-in-out" ) {

        if( this.anim && !this.anim.done )
            await this.anim.interrupt(); // AGGHHH HOLD ON

        const next = this.getTransform();
        change(next);
        const matrix = getMatrix(next);

        const anim = this.element.animate(
            [
                { transform: this.element.style.transform },
                { transform: matrix }
            ],
            {
                duration,
                easing
            }
        )

        anim.addEventListener('finish', () => {
            this.editTransform( (t) => {
                t.x    = next.x
                t.y    = next.y
                t.zoom = next.zoom
            })
        })
        
        const ret = _PanzoomAnimation.extend(anim, this)
        this.anim = ret;
        
        return ret;
    }

    /** Converts a document-space position to a child-space position, without any scaling applied, and returns that. */
    public docToChild(pos: Readonly<ClientPos>): ClientPos {
        const bounds = this.container.getBoundingClientRect();
            
        return {
            clientX: pos.clientX - bounds.x - bounds.width / 2 - this.transform.x, 
            clientY: pos.clientY - bounds.y - bounds.height / 2 - this.transform.y
        }
    }

    /** Converts a child-space position to a document-space position, without any scaling applied, and returns that. */
    public childToDoc(pos: Readonly<ClientPos>): ClientPos {
        const bounds = this.container.getBoundingClientRect();
        return {
            clientX: pos.clientX + bounds.x + bounds.width / 2 + this.transform.x,
            clientY: pos.clientY + bounds.y + bounds.height / 2 + this.transform.y
        }
    }

    /** Finds a new value for {@link z} to clamp `this.transform.zoom * z` between {@linkcode minZoom} and {@linkcode maxZoom} */
    public clampZoomChangeMul(z: number){
        const next = z * this.transform.zoom;
        return Math.min( Math.max( next, this.minZoom ), this.maxZoom ) / this.transform.zoom;
    }

    /**
     * Constructs a panzoom for the element, with the parent serving as the boundary
     * @param element - the element
     */
    constructor(public readonly element: HTMLElement){
        this.container = element.parentElement ?? fail("The element needs a valid parent to be panzoomable.", element)

        // drag events completely break panzooming, so we cancel them
        this.container.addEventListener('dragstart', cancel, {capture: true})

        // select events also look kinda weird
        this.container.addEventListener('selectstart', cancel, {capture: true})

        // we need this gross hack to (reliably) prevent iOS from scrolling the page when panzooming
        const blockScrollingIfPanning = (e: TouchEvent) => this.blockScrollingIfPanning(e);
        document.body.addEventListener('touchmove', blockScrollingIfPanning, {passive: false, capture: true})

        // actual panzoom events
        const startMousePan = (e: MouseEvent) => this.startMousePan(e);
        this.container.addEventListener('mousedown', startMousePan);

        const startTouchPanzoom = (e: TouchEvent) => this.startTouchPanzoom(e);
        this.container.addEventListener('touchstart', startTouchPanzoom, {passive: true})

        const doWheelZoom = (e: WheelEvent) => this.doWheelZoom(e);
        this.container.addEventListener('wheel', doWheelZoom, {passive: false})

        this.dispose = () => {
            this.container.removeEventListener('dragstart', cancel, {capture: true});
            this.container.removeEventListener('selectstart', cancel, {capture: true});
    
            document.body.removeEventListener('touchmove', blockScrollingIfPanning, {capture: true})
    
            this.container.removeEventListener('mousedown', startMousePan);
            this.container.removeEventListener('touchstart', startTouchPanzoom);
            this.container.removeEventListener('wheel', doWheelZoom);
    
            this.transformCallbacks.clear();
        }

        this.kinetic.onVelocityChanged( (vel) => {
            this.editTransformConstrained( (t) => {
                t.x += vel.dx;
                t.y += vel.dy;
            } )
        } )
    }


    /**
     * If using this in the context of a framework, **call this when the panzoom goes out-of-scope**.
     * 
     * *(If you don't, you'll probably get event listener memory leaks!)*
     */
    public dispose: () => void

    private blockMobileScrolling: boolean = false;
    private blockScrollingIfPanning (e: TouchEvent){
        if( this.blockMobileScrolling ){
            e.preventDefault();
        }
    }

    /** 
     * Callback for wheel events.  
     * 
     * Can be overridden. 
     */
    protected doWheelZoom(e: WheelEvent) {

        e.preventDefault();
        e.stopPropagation();

        const factor = this.clampZoomChangeMul( e.deltaY < 0 ? this.wheelZoomRate : 1 / this.wheelZoomRate );

        let oldZoomPoint = this.docToChild(e);

        // if we were to scale as-is, where would the mouse end up?
        // subtract how it moves from the final transformation to keep it in the same place relative to the panzoom child.
        // through a little algebra, the above is equivalent to this:
        let err_x = oldZoomPoint.clientX * (factor - 1);
        let err_y = oldZoomPoint.clientY * (factor - 1);

        this.editTransformConstrained( (t) => {
            t.zoom *= factor
            t.x -= err_x
            t.y -= err_y
        } )

    }



    /** The position of the mouse from the last mouse event. */
    protected lastMousePos: ClientPos | undefined;

    /** A `performance.now()` timestamp from the last mouse event. */
    protected lastMouseTime: number | undefined;

    /**
     * Callback for mouse events.
     * 
     * Can be overridden.
     */
    protected startMousePan(e: MouseEvent) {

        if( this.lastMousePos ) return;

        if( e.button !== 0 ) return; // primary button only

        this.kinetic.stopKinetics();

        this.lastMousePos = e;
        this.lastMouseTime = performance.now();

        const mousePanCallback = (e: MouseEvent) => {
            const lastPos = this.lastMousePos ?? e;
            const lastTime = this.lastMouseTime ?? performance.now();
            const thisTime = performance.now();
            const dt = thisTime - lastTime 

            const dx = e.clientX - lastPos.clientX;
            const dy = e.clientY - lastPos.clientY;

            this.kinetic.smoothing.push({dx, dy, dt})
            
            this.editTransformConstrained( (t) => {
                t.x += dx
                t.y += dy
            } )

            this.lastMousePos = e;
            this.lastMouseTime = thisTime;
        }

        document.addEventListener('mousemove', mousePanCallback);

        const mousePanEnd = (e: MouseEvent) => {
            document.removeEventListener('mousemove', mousePanCallback);
            document.removeEventListener('mouseup', mousePanEnd)

            mousePanCallback(e); // one last update to catch the user slowing their cursor to a stop before releasing

            this.kinetic.startKinetics();
            this.lastMousePos = undefined;
        }

        document.addEventListener('mouseup', mousePanEnd)
    }

    /** The average touch position from the last touch event */
    protected lastTouchAverage:  ClientPos | undefined;

    /** The number of touches observed in the last touch event */
    protected lastTouchCount:    number | undefined;

    /** The distance between the touch points from the last touch event */
    protected lastTouchDistance: number | undefined;

    /** A `performance.now()` timestamp from the last touch event. */
    protected lastTouchTime:     number | undefined;


    /**
     * Callback for touch events.
     * 
     * Can be overridden.
     */
    protected startTouchPanzoom(e: TouchEvent) {

        if( this.lastTouchAverage ) return;

        this.kinetic.stopKinetics();

        this.blockMobileScrolling = true;
        this.lastTouchAverage  = average( e.touches );
        this.lastTouchCount    = e.touches.length;
        this.lastTouchDistance = totalDistance( this.lastTouchAverage, e.touches )
        this.lastTouchTime     = performance.now();

        const touchPanzoomCallback = (e: TouchEvent) => {

            const thisTouchCount    = e.touches.length;
            const thisTouchAverage  = average(e.touches);
            const thisTouchDistance = totalDistance( thisTouchAverage, e.touches );
            const thisTouchTime     = performance.now();

            if( this.lastTouchCount === thisTouchCount ){ // ignore one frame if another touch connects or disconnects to prevent discontinuous jump

                const lastTouchAverage  = this.lastTouchAverage ?? thisTouchAverage;
                const lastTouchDistance = this.lastTouchDistance ?? thisTouchDistance;
                const lastTouchTime     = this.lastTouchTime ?? thisTouchTime;

                let factor = thisTouchDistance / lastTouchDistance;
                if( factor !== factor ){ // did we get NaN?
                    factor = 1; // pretend it's fine
                }
                factor = this.clampZoomChangeMul(factor);

                const dt = thisTouchTime - lastTouchTime;
                let dx = thisTouchAverage.clientX - lastTouchAverage.clientX;
                let dy = thisTouchAverage.clientY - lastTouchAverage.clientY;

                let oldZoomPoint = this.docToChild(thisTouchAverage);
                let err_x = oldZoomPoint.clientX * (factor - 1);
                let err_y = oldZoomPoint.clientY * (factor - 1);

                dx -= err_x;
                dy -= err_y;

                this.kinetic.smoothing.push({dx, dy, dt});

                
                this.editTransformConstrained( (t) => {
                    t.x += dx
                    t.y += dy
                    t.zoom *= factor
                } )

            }

            this.lastTouchAverage  = thisTouchAverage;
            this.lastTouchCount    = thisTouchCount;
            this.lastTouchDistance = thisTouchDistance
            this.lastTouchTime     = thisTouchTime;
        }

        this.container.addEventListener('touchmove', touchPanzoomCallback);

        const touchPanzoomEnd = (e: TouchEvent) => {
            if( e.touches.length !== 0 ) return;
            touchPanzoomCallback(e);

            this.container.removeEventListener('touchmove', touchPanzoomCallback);
            document.removeEventListener('touchend', touchPanzoomEnd);

            this.kinetic.startKinetics();

            this.lastTouchAverage = undefined;
            this.blockMobileScrolling = false;
        }

        document.addEventListener('touchend', touchPanzoomEnd)
    }

}