import {Vector3} from 'three';
import {Gotch, gotchTreeString} from './gotch';
import {ADJACENT, BRANCH_STEP, GOTCH_SHAPE, STOP_STEP} from './shapes';
import {coordSort, equals, ICoords, plus, Spot, spotsToString, Surface, zero} from './spot';
import {Genome} from '../genetics/genome';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {IGotchiFactory} from '../gotchi/gotchi';

export interface IslandPattern {
    gotches: string;
    spots: string;
}

export interface IslandChange {
    gotchCount: number;
    spotCount: number;
    masterGotch?: Gotch;
}

const sortSpotsOnCoord = (a: Spot, b: Spot): number => coordSort(a.coords, b.coords);
const gotchWithMaxNonce = (gotches: Gotch[]) => gotches.reduce((withMax, adjacent) => {
    if (withMax) {
        return adjacent.nonce > withMax.nonce ? adjacent : withMax;
    } else {
        return adjacent;
    }
});

export class Island {
    public islandChange = new BehaviorSubject<IslandChange>({gotchCount: 0, spotCount: 0});
    public spots: Spot[] = [];
    public gotches: Gotch[] = [];
    public masterGotch?: Gotch;

    constructor(public islandName: string, private gotchiFactory: IGotchiFactory) {
        const patternString = localStorage.getItem(this.islandName);
        const pattern: IslandPattern = patternString ? JSON.parse(patternString) : {gotches: '', spots: ''};
        this.spots = [];
        this.gotches = [];
        this.apply(pattern);
    }

    public set master(masterName: string | undefined) {
        this.masterGotch = this.gotches.find(gotch => gotch.master === masterName);
    }

    public get master(): string | undefined {
        return this.masterGotch ? this.masterGotch.master : undefined;
    }

    public get freeGotch(): Gotch | undefined {
        return this.gotches.find(gotch => !gotch.genome);
    }

    public get legal(): boolean {
        return !this.spots.find(spot => !spot.legal);
    }

    public refresh() {
        this.spots.forEach(spot => {
            spot.adjacentSpots = this.getAdjacentSpots(spot);
            spot.connected = spot.adjacentSpots.length < 6;
        });
        let flowChanged = true;
        while (flowChanged) {
            flowChanged = false;
            this.spots.forEach(spot => {
                if (!spot.connected) {
                    const connectedByAdjacent = spot.adjacentSpots.find(adj => (adj.surface === spot.surface) && adj.connected);
                    if (connectedByAdjacent) {
                        spot.connected = true;
                        flowChanged = true;
                    }
                }
            });
        }
        this.spots.forEach(spot => spot.refresh());
        this.islandChange.next({
            gotchCount: this.gotches.length,
            spotCount: this.spots.length,
            masterGotch: this.master ? this.findGotch(this.master) : undefined
        });
    }

    public save() {
        if (this.legal) {
            localStorage.setItem(this.islandName, JSON.stringify(this.pattern));
            this.gotches.forEach(gotch => {
                if (gotch.genome) {
                    localStorage.setItem(gotch.createFingerprint(), gotch.genome.toJSON());
                }
            });
            console.log(`Saved ${this.islandName}`);
        } else {
            console.log(`Not legal yet: ${this.islandName}`);
        }
    }

    public findGotch(master: string): Gotch | undefined {
        return this.gotches.find(gotch => !!gotch.genome && gotch.genome.master === master)
    }

    public removeFreeGotches(): void {
        const deadGotches = this.gotches.filter(gotch => !gotch.genome);
        deadGotches.forEach(deadGotch => {
            this.gotches = this.gotches.filter(gotch => !equals(gotch.coords, deadGotch.coords));
            deadGotch.destroy().forEach(deadSpot => {
                this.spots = this.spots.filter(spot => !equals(spot.coords, deadSpot.coords));
            });
        });
    }

    public createGotch(spot: Spot, master: string): Gotch | undefined {
        if (this.gotches.find(gotch => gotch.master === master)) {
            console.error(`${master} already has a gotch!`);
            return undefined;
        }
        if (!spot.canBeNewGotch) {
            console.error(`${JSON.stringify(spot.coords)} cannot be a gotch!`);
            return undefined;
        }
        return this.gotchAroundSpot(spot);
    }

    public get singleGotch(): Gotch | undefined {
        return this.gotches.length === 1 ? this.gotches[0] : undefined;
    }

    public get midpoint(): Vector3 {
        return this.spots
            .reduce((sum: Vector3, spot: Spot) => sum.add(spot.center), new Vector3())
            .multiplyScalar(1 / this.spots.length);
    }

    public get pattern(): IslandPattern | undefined {
        if (this.spots.find(spot => !spot.legal)) {
            return undefined;
        }
        this.spots.sort(sortSpotsOnCoord);
        return {
            gotches: gotchTreeString(this.gotches),
            spots: spotsToString(this.spots)
        } as IslandPattern;
    }

    // ================================================================================================

    private apply(pattern: IslandPattern) {
        let gotch: Gotch | undefined = this.getOrCreateGotch(undefined, zero);
        const stepStack = pattern.gotches.split('').reverse().map(stepChar => Number(stepChar));
        const gotchStack: Gotch[] = [];
        while (stepStack.length > 0) {
            const step = stepStack.pop();
            switch (step) {
                case STOP_STEP:
                    gotch = gotchStack.pop();
                    break;
                case BRANCH_STEP:
                    if (gotch) {
                        gotchStack.push(gotch);
                    }
                    break;
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                    if (gotch) {
                        gotch = this.gotchAroundSpot(gotch.spots[step]);
                    }
                    break;
                default:
                    console.error('Error step');
            }
        }
        const hexChars = pattern.spots ? pattern.spots.split('') : [];
        const numbers = hexChars.map(hexChar => parseInt(hexChar, 16));
        const booleanArrays = numbers.map(nyb => {
            const b0 = (nyb & 8) !== 0;
            const b1 = (nyb & 4) !== 0;
            const b2 = (nyb & 2) !== 0;
            const b3 = (nyb & 1) !== 0;
            return [b0, b1, b2, b3];
        });
        const landStack = [].concat.apply([], booleanArrays).reverse();
        this.spots.sort(sortSpotsOnCoord);
        if (landStack.length) {
            this.spots.forEach(spot => {
                const land = landStack.pop();
                spot.surface = land ? Surface.Land : Surface.Water;
            });
        } else if (this.singleGotch) {
            this.singleGotch.spots[0].surface = Surface.Land;
        }
        this.gotches.forEach(g => {
            const fingerprint = g.createFingerprint();
            const storedGenome = localStorage.getItem(fingerprint);
            if (storedGenome) {
                g.genome = new Genome(JSON.parse(storedGenome));
            }
        });
        this.refresh();
    }

    private gotchAroundSpot(spot: Spot): Gotch {
        const adjacentMaxNonce = gotchWithMaxNonce(spot.adjacentGotches);
        return this.getOrCreateGotch(adjacentMaxNonce, spot.coords);
    }

    private getOrCreateGotch(parent: Gotch | undefined, coords: ICoords): Gotch {
        const existing = this.gotches.find(existingGotch => equals(existingGotch.coords, coords));
        if (existing) {
            return existing;
        }
        const spots = GOTCH_SHAPE.map(c => this.getOrCreateSpot(plus(c, coords)));
        const gotch = new Gotch(parent, coords, spots, this.gotchiFactory);
        this.gotches.push(gotch);
        return gotch;
    }

    private getOrCreateSpot(coords: ICoords): Spot {
        const existing = this.getSpot(coords);
        if (existing) {
            return existing;
        }
        const spot = new Spot(coords);
        this.spots.push(spot);
        return spot;
    }

    private getAdjacentSpots(spot: Spot): Spot[] {
        const adjacentSpots: Spot[] = [];
        const coords = spot.coords;
        ADJACENT.forEach(a => {
            const adjacentSpot = this.getSpot(plus(a, coords));
            if (adjacentSpot) {
                adjacentSpots.push(adjacentSpot);
            }
        });
        return adjacentSpots;
    }

    private getSpot(coords: ICoords): Spot | undefined {
        return this.spots.find(p => equals(p.coords, coords));
    }
}