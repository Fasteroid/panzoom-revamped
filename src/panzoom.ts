import { _PanzoomAnimation, PanzoomAnimation } from "./animation.js";
import { average, ClientPos, totalDistance } from "./vector.js";
import { cancel, fail } from "./misc.js";
import { getMatrix, PanzoomTransform, PanzoomTransformCallback } from "./transform.js";
import { Kinetic } from "./kinetic.js";

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
     * The container for the panzoom element
     */
    public readonly container: HTMLElement;

    public readonly kinetic = new Kinetic();

    /** 
     * Don't modify this directly unless you really know what you're doing.
     * Use {@linkcode editTransform} instead so the visuals update.
     */
    protected readonly transform: PanzoomTransform = {
        x: 0,
        y: 0,
        zoom: 1
    }

    protected readonly transformCallbacks = new Set<PanzoomTransformCallback>();

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


        const left = x + viewportRect.width / 2 + newWidth;
        if( left < minVisible ) {
            x += ( minVisible - left )
        }

        const top = y + viewportRect.height / 2 + newHeight;
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

        this.editTransform((t) => {
            t.x = x
            t.y = y
            t.zoom = changed.zoom
        });
        
    }


    private anim?: PanzoomAnimation
    /**
     * Computes a change to the internal transform and animates a transition towards it.
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

    /** Converts a document-space position to a child-space position (no scaling) */
    public docToChild(pos: ClientPos): ClientPos {
        const bounds = this.container.getBoundingClientRect();
            
        return {
            clientX: pos.clientX - bounds.x - bounds.width / 2 - this.transform.x, 
            clientY: pos.clientY - bounds.y - bounds.height / 2 - this.transform.y
        }
    }

    public childToDoc(pos: ClientPos): ClientPos {
        const bounds = this.container.getBoundingClientRect();
        return {
            clientX: pos.clientX + bounds.x + bounds.width / 2 + this.transform.x,
            clientY: pos.clientY + bounds.y + bounds.height / 2 + this.transform.y
        }
    }

    public clampZoomChangeMul(z: number){
        const next = z * this.transform.zoom;
        return Math.min( Math.max( next, this.minZoom ), this.maxZoom ) / this.transform.zoom;
    }

    private blockMobileScrolling: boolean = false;

    /**
     * Constructs a panzoom for the element, with the parent serving as the boundary
     * @param element - the element
     */
    constructor(public readonly element: HTMLElement){
        this.container = element.parentElement ?? fail("The element needs a valid parent to be panzoomable.", element)

        // these events are problematic for panzooming, so we disable them
        this.container.addEventListener('selectstart', cancel, {capture: true})
        this.container.addEventListener('dragstart', cancel, {capture: true})

        // we need this gross hack to prevent ios from scrolling reliably
        document.body.addEventListener('touchmove', this.blockScrollingIfPanning, {passive: false, capture: true})

        this.container.addEventListener('mousedown', this.startMousePan);
        this.container.addEventListener('touchstart', this.startTouchPanzoom, {passive: true})
        this.container.addEventListener('wheel', this.doWheelZoom, {passive: false})

        this.kinetic.onVelocityChanged( (vel) => {
            this.editTransformConstrained( (t) => {
                t.x += vel.dx;
                t.y += vel.dy;
            } )
        } )
    }


    public dispose(){
        this.container.removeEventListener('selectstart', cancel, {capture: true});
        this.container.removeEventListener('dragstart', cancel, {capture: true});

        document.body.removeEventListener('touchmove', this.blockScrollingIfPanning, {capture: true})

        this.container.removeEventListener('mousedown', this.startMousePan);
        this.container.removeEventListener('touchstart', this.startTouchPanzoom);
        this.container.removeEventListener('wheel', this.doWheelZoom);
    }


    protected blockScrollingIfPanning = (e: TouchEvent) => {
        console.log(e)
        if( this.blockMobileScrolling ){
            e.preventDefault();
        }
    }


    protected doWheelZoom = (e: WheelEvent) => {

        e.preventDefault();
        e.stopPropagation();

        const factor = this.clampZoomChangeMul( e.deltaY < 0 ? this.wheelZoomRate : 1 / this.wheelZoomRate );

        let oldZoomPoint = this.docToChild(e);

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

        this.editTransformConstrained( (t) => {
            t.zoom *= factor
            t.x -= err_x
            t.y -= err_y
        } )

    }



    
    private lastMousePos: ClientPos | undefined;
    private lastMouseTime: number | undefined;

    protected startMousePan = (e: MouseEvent) => {

        if( this.lastMousePos ) return;

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





    private lastTouchAverage:  ClientPos | undefined;
    private lastTouchCount:    number | undefined;
    private lastTouchDistance: number | undefined;
    private lastTouchTime:     number | undefined;

    protected startTouchPanzoom = (e: TouchEvent) => {

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
                const dx = thisTouchAverage.clientX - lastTouchAverage.clientX;
                const dy = thisTouchAverage.clientY - lastTouchAverage.clientY;


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