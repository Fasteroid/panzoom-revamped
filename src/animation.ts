
import { Panzoom } from "./panzoom.js";
import { parseMatrix } from "./transform.js";

export class _PanzoomAnimation extends Animation {
    
    /** Extends a normal animation to a panzoom animation */
    public static extend(anim: Animation, pz: Panzoom) : _PanzoomAnimation {
        let ret: _PanzoomAnimation = Object.setPrototypeOf(anim, _PanzoomAnimation.prototype);
        ret._pz = pz;
        return ret;
    }

    // don't use
    private constructor(_: Panzoom){
        super();
        this._pz = _;
    }

    private _pz: Panzoom;

    public get done() { return this.playState !== 'running' }

    // just in case someone tries to call this from JavaScript land...
    public override pause(){
        throw new Error("Can't pause panzoom animation (try .interrupt() instead)");
    }

    /** Immediately cancels the animation and reverts the new transformation */
    public override cancel() {
        if( this.done ) throw new Error("The panzoom animation is over")
        super.cancel();
    }

    /** Immediately finishes the animation and commits the new transformation */
    public override finish() {
        if( this.done ) throw new Error("The panzoom animation is over")
        super.finish();
    }

    /** Runs the callback when the animation is completed, canceled, or interrupted */
    public onDone( cb: () => void ){
        this.addEventListener('finish', cb, { once: true });
        this.addEventListener('cancel', cb, { once: true });
    }

    /** Cancels the animation where it is and commits the current transformation */
    public async interrupt() {
        return new Promise<void>( (resolve) => {
            if( this.done ) throw new Error("The panzoom animation is over")

            const transform = parseMatrix( getComputedStyle(this._pz.element).transform );

            super.pause();

            // wait for next frame so the switcheroo is seamless...
            requestAnimationFrame( () => {
                this._pz.editTransform( (t) => {
                    t.x = transform.x,
                    t.y = transform.y,
                    t.zoom = transform.zoom
                });
                super.cancel();
                resolve();
            } )
        } )
    }
}

export type PanzoomAnimation = Pick<_PanzoomAnimation, 
    'addEventListener'    |
    'removeEventListener' |
    'cancel'              |
    'finish'              |
    'interrupt'           |
    'done'
>
