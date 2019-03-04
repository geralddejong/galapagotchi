import {BehaviorSubject} from "rxjs/BehaviorSubject"
import {Vector3} from "three"

import {NORMAL_TICKS, SPOT_TO_HANGER} from "../body/fabric"
import {Direction} from "../body/fabric-exports"
import {fromGenomeData, IGenomeData} from "../genetics/genome"
import {Hexalot} from "../island/hexalot"
import {Trip} from "../island/trip"

import {compareEvolvers, Evolver} from "./evolver"
import {Gotchi} from "./gotchi"

export const INITIAL_JOINT_COUNT = 47
export const MAX_POPULATION = 24
const MUTATION_COUNT = 3
const MINIMUM_AGE = 15000
const MAXIMUM_AGE = 30000
const INCREASE_AGE_LIMIT = 1000
const SURVIVAL_RATE = 0.66

export class Evolution {
    public evolversNow: BehaviorSubject<Evolver[]> = new BehaviorSubject<Evolver[]>([])
    private rebooting = false
    private ageLimit = MINIMUM_AGE

    constructor(private hexalot: Hexalot, private trip: Trip, private saveGenome: (genome: IGenomeData) => void) {
        let mutatingGenome = hexalot.genome
        const gotchis: Gotchi[] = []
        for (let walk = 0; walk < MAX_POPULATION && mutatingGenome; walk++) {
            const gotchi = this.hexalot.createGotchi(mutatingGenome)
            gotchis.push(gotchi)
            const direction: Direction = Math.floor(Math.random() * 4) + 1
            mutatingGenome = mutatingGenome.withMutatedBehavior(direction, MUTATION_COUNT)
        }
        this.evolversNow.next(gotchis.map(gotchi => this.gotchiToEvolver(gotchi)))
    }

    public get midpoint(): Vector3 {
        const evolvers = this.evolversNow.getValue()
        if (evolvers.length === 0) {
            return new Vector3().add(this.hexalot.center).add(SPOT_TO_HANGER)
        }
        return evolvers
            .map(evolver => evolver.gotchi.fabric.vectors)
            .reduce((prev, array) => {
                prev.x += array[0]
                prev.y += array[1]
                prev.z += array[2]
                return prev
            }, new Vector3())
            .multiplyScalar(1 / evolvers.length)
    }

    public iterate(): void {
        const evolvers = this.evolversNow.getValue()
        if (evolvers.length === 0 || this.rebooting) {
            return
        }
        let frozenCount = 0
        const activeEvolvers = evolvers.filter(evolver => {
            if (evolver.done || evolver.touchedDestination) {
                evolver.done = true
                frozenCount++
                return false
            }
            return evolver.gotchi.age < this.ageLimit
        })
        activeEvolvers.forEach(evolver => {
            const behind = this.ageLimit - evolver.gotchi.age
            evolver.gotchi.iterate(behind > NORMAL_TICKS ? NORMAL_TICKS : behind)
            const gotchiDirection = evolver.gotchi.direction
            const chosenDirection = evolver.voteDirection()
            if (chosenDirection !== undefined && gotchiDirection !== chosenDirection) {
                evolver.gotchi.direction = chosenDirection
            }
        })
        const halfFrozen = frozenCount > evolvers.length / 2
        const noneActive = activeEvolvers.length === 0
        if (halfFrozen || noneActive) {
            this.ageLimit += INCREASE_AGE_LIMIT
            console.log("age limit", this.ageLimit)
            const toSave = this.strongest()
            if (toSave) {
                this.saveGenome(toSave.gotchi.genomeData)
            } else {
                console.log("no strongest?")
            }
            if (this.ageLimit >= MAXIMUM_AGE) {
                this.ageLimit = MINIMUM_AGE
            }
            this.rebootAll(SURVIVAL_RATE)
        }
    }

    public dispose(): void {
        this.evolversNow.getValue().forEach(evolver => evolver.gotchi.dispose())
    }

    // Privates =============================================================

    private get rankedEvolvers(): Evolver[] {
        const evolvers = this.evolversNow.getValue()
        evolvers.forEach(e => e.calculateFitness())
        return evolvers.sort(compareEvolvers)
    }

    private strongest(): Evolver | undefined {
        return this.rankedEvolvers[0]
    }

    private rebootAll(survivalRate: number): void {
        this.rebooting = true
        const ranked: Evolver[] = this.rankedEvolvers
        const deadEvolvers = ranked.splice(Math.ceil(ranked.length * survivalRate))
        console.log(`REBOOT: dead=${deadEvolvers.length} remaining=${ranked.length}`)
        this.evolversNow.next(ranked)
        setTimeout(() => {
            const mutants: Gotchi[] = deadEvolvers.map(evolver => {
                evolver.gotchi.dispose()
                const luckyParent = ranked[Math.floor(ranked.length * Math.random())]
                return this.createOffspring(luckyParent.gotchi, luckyParent.currentDirection, false)
            })
            const clones: Gotchi[] = ranked.map(evolver => {
                evolver.gotchi.dispose()
                return this.createOffspring(evolver.gotchi, evolver.currentDirection, true)
            })
            const offspring = mutants.concat(clones)
            this.evolversNow.next([])
            console.log(`survived=${offspring.length}`)
            this.evolversNow.next(offspring.map(g => this.gotchiToEvolver(g)))
            this.rebooting = false
        }, 1000)
    }

    private createOffspring(parent: Gotchi, direction: Direction, clone: boolean): Gotchi {
        const genome = fromGenomeData(parent.genomeData).withMutatedBehavior(direction, clone ? 0 : MUTATION_COUNT)
        return this.hexalot.createGotchi(genome)
    }

    private gotchiToEvolver = (gotchi: Gotchi): Evolver => {
        const travel = this.trip.createTravel(0)
        return new Evolver(gotchi, travel)
    }
}
