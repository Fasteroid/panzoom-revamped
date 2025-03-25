import { CircularArray } from "./circulararray.js";
import { awaitAnimationFrame } from "./misc.js";

type Vel = {dx: number, dy: number}

type WeightedVel = Vel & {dt: number}

type KineticCallback = (v: Vel) => any;

const MAGIC_SCALING_FACTOR = 8;

export class Kinetic {

    /** Velocities below this will be considered zero */
    public minVelocity: number = 1;

    /** How much velocity to loose per unit time, `ice [0 <=> 1] rubber` */
    public friction:    number = 0.05;

    /** Velocity smoother, set its `.size` to modify smoothing */
    public readonly smoothing = new CircularArray<WeightedVel>(5);
    
    private lock: {} = {};

    public async startKinetics(){
        
        let lock = {};
        this.lock = lock;

        let dx = 0; let dy = 0; let dt = 0;
        for( let item of this.smoothing.items ){
            dx += item.dx;
            dy += item.dy;
            dt += item.dt;
        }
        if( dt === 0 ){ dt = 1 }; // don't produce NaN
        dt /= MAGIC_SCALING_FACTOR; // not sure where this 10 comes from but it seems necessary
        dx /= dt;
        dy /= dt;
        this.smoothing.clear();

        let lastFrame = await awaitAnimationFrame();
        
        while( Math.sqrt( dx ** 2 + dy ** 2 ) >= this.minVelocity ){
            if( this.lock !== lock ) return; // we started again
            
            this.callbacks.forEach( (cb) => cb({dx, dy}) );

            const thisFrame = await awaitAnimationFrame();
            const dt = thisFrame - lastFrame; // calculate dt for framerate-independent kinetics
            lastFrame = thisFrame;

            const fac = Math.pow(1 - this.friction, dt / MAGIC_SCALING_FACTOR);

            dx *= fac;
            dy *= fac;
        }

        dx = 0;
        dy = 0;
        
        this.callbacks.forEach( (cb) => cb({dx, dy}) );
        
    }

    public stopKinetics(){
        this.lock = {};
    }

    protected readonly callbacks = new Set<KineticCallback>();
    public onVelocityChanged( cb: KineticCallback ) {
        this.callbacks.add(cb);
        return {
            unsubscribe: () => this.callbacks.delete(cb)
        }
    }

}