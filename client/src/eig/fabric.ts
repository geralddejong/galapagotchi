import {Joint} from './joint';
import {Interval} from './interval';
import {Vector3} from 'three';

export class Fabric {

    constructor(
        public joints: Joint[] = [],
        public intervals: Interval[] = []
    ) {
    }

    public joint(name: string, x: number, y: number, z: number) {
        this.joints.push(new Joint(name, new Vector3(x, y, z)));
    }

    public interval(a: number, b: number) {
        this.intervals.push(new Interval(this.joints[a], this.joints[b]));
    }

    public tetra(): Fabric {
        let name = 0;
        const shake = () => (Math.random() - 0.5) * 0.1;
        const joint = (x: number, y: number, z: number) => this.joint(
            (name++).toString(),
            x + shake(),
            y + shake(),
            z + shake()
        );
        joint(1, -1, 1);
        joint(-1, 1, 1);
        joint(-1, -1, -1);
        joint(1, 1, -1);
        this.interval(0, 1);
        this.interval(1, 2);
        this.interval(2, 3);
        this.interval(2, 0);
        this.interval(0, 3);
        this.interval(3, 1);
        this.calculate();
        this.setAltitude(8);
        return this;
    }

    private setAltitude(altitude: number) {
        // todo: should be in constraints
        const lowest = this.joints.reduce((minAltitude: number, curr: Joint) => Math.min(minAltitude, curr.location.y), Number.MAX_VALUE);
        this.joints.forEach(joint => joint.location.y = joint.location.y - lowest + altitude);
    }

    private calculate() {
        this.intervals.forEach(interval => {
            interval.calculate();
            interval.idealSpan = interval.span;
        });
    }

}