import { _PanzoomAnimation, PanzoomAnimation } from "./animation.js";
import { average, ClientPos, totalDistance } from "./clientpos.js";
import { cancel, fail } from "./misc.js";
import { getMatrix, PanzoomTransform } from "./transform.js";

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
     * How far to allow the panzoom element to overflow
     */
    public overflow: number = 0.5;

    /**
     * The container for the panzoom element
     */
    public readonly container: HTMLElement;

    /** 
     * Don't modify this directly unless you really know what you're doing.
     * Use {@linkcode editTransform} instead so the visuals update.
     */
    protected readonly _transform: PanzoomTransform = {
        x: 0,
        y: 0,
        zoom: 1
    }

    /**
     * Modifies the internal transform then updates it on the panzoom element
     * @param change - how to modify the internal transform
     */
    public editTransform( change: (t: PanzoomTransform) => void ){
        const t = this._transform;
        change(t);
        this.element.style.transform = getMatrix(t);
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

    protected clampZoomChangeMul(z: number){
        const next = z * this._transform.zoom;
        return Math.min( Math.max( next, this.minZoom ), this.maxZoom ) / this._transform.zoom;
    }

    /**
     * Constructs a panzoom for the element, with the parent serving as the boundary
     * @param element - the element
     */
    constructor(public readonly element: HTMLElement){
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

            const factor = this.clampZoomChangeMul( e.deltaY < 0 ? this.wheelZoomRate : 1 / this.wheelZoomRate);

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

            if( this.lastTouchCount === thisTouchCount ){ // ignore one frame if another touch connects or disconnects to prevent discontinuous jump

                const lastTouchAverage = this.lastTouchAverage ?? thisTouchAverage;
                const lastTouchDistance = this.lastTouchDistance ?? thisTouchDistance;

                let factor = thisTouchDistance / lastTouchDistance;
                if( factor !== factor ){ // did we get NaN?
                    factor = 1; // pretend it's fine
                }
                factor = this.clampZoomChangeMul(factor);

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