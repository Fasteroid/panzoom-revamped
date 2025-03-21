
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

        // prevent drag handlers on the element itself from firing
        this.element.addEventListener('selectstart', cancel)
        this.element.addEventListener('dragstart', cancel)

        this.container.addEventListener('mousedown', (e) => {
            this.startMousePan(e);
        });

        this.container.addEventListener('wheel', (e: WheelEvent) => {

            const factor = e.deltaY < 0 ? this.wheelZoomRate : 1 / this.wheelZoomRate

            this.editTransform( (t) => {
                t.zoom *= factor
            } )

        })


        // this.element.addEventListener('mousedown', () => { console.log("clicked the cat") })
    }


    private lastMousePos: ClientPos | undefined;
    private isMousePanActive: boolean = false;

    protected startMousePan(e: MouseEvent){

        if( this.isMousePanActive ) return;
        this.isMousePanActive = true;

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
            this.isMousePanActive = false;
        }

        document.addEventListener('mouseup', mousePanEnd)
    }

}