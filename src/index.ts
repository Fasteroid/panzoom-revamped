
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
    x: number;
    y: number;
    zoom: number;
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
    public transform( change: (t: PanzoomTransform) => void ){
        const t = this._transform;
        change(t);
        this.element.style.transform = `matrix(${t.zoom}, 0, 0, ${t.zoom}, ${t.x}, ${t.y})`
    }

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


        // this.element.addEventListener('mousedown', () => { console.log("clicked the cat") })
    }

    protected startMousePan(e: MouseEvent){        
        const mousePanCallback = (e: MouseEvent) => {
            const bounds = this.container.getBoundingClientRect();
            
            this.transform( (t) => {
                t.x = e.clientX - bounds.x - bounds.width / 2
                t.y = e.clientY - bounds.y - bounds.height / 2
            } )
        }

        this.container.addEventListener('mousemove', mousePanCallback);

        document.addEventListener('mouseup', () => {
            this.container.removeEventListener('mousemove', mousePanCallback);
        })
    }

}