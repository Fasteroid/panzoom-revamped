
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


export class Panzoom {

    protected container: HTMLElement;


    /**
     * Constructs a panzoom for the element, with the parent serving as the boundary
     * @param element - the element
     */
    constructor(protected element: HTMLElement){
        this.container = element.parentElement ?? fail("The element needs a valid parent to be panzoomable.", element)

        // prevent drag handlers on the element from firing
        this.element.addEventListener('selectstart', cancel)
        this.element.addEventListener('dragstart', cancel)
    }




}