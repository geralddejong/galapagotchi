import {GeneSequence} from './gene-sequence';
import {Behavior} from './behavior';
import {Fabric} from '../body/fabric';
import {Embryology} from './embryology';

export interface IGenome {
    master: string;
    embryoSequence: number[];
    behaviorSequence: number[];
}

export class Genome {
    private master: string;
    private embryoSequence: number[];
    private behaviorSequence: number[];

    constructor(genome: IGenome) {
        this.master = genome.master;
        this.embryoSequence = genome.embryoSequence ? this.embryoSequence = genome.embryoSequence : [];
        this.behaviorSequence = genome.behaviorSequence ? this.behaviorSequence = genome.behaviorSequence : [];
    }

    public embryology(fabric: Fabric): Embryology {
        return new Embryology(fabric, new GeneSequence(this.embryoSequence));
    }

    public behavior(fabric: Fabric): Behavior {
        return new Behavior(fabric, new GeneSequence(this.behaviorSequence));
    }

    public withMutatedBehavior(mutations: number): Genome {
        const genome = new Genome({
            master: this.master,
            embryoSequence: this.embryoSequence.slice(),
            behaviorSequence: this.behaviorSequence.slice()
        });
        for (let hit = 0; hit < mutations; hit++) {
            const geneNumber = Math.floor(Math.random() * genome.behaviorSequence.length);
            genome.behaviorSequence[geneNumber] = Math.random();
        }
        return genome;
    }

    public toIGenome(): IGenome {
        return {
            master: this.master,
            embryoSequence: this.embryoSequence,
            behaviorSequence: this.behaviorSequence
        };
    }
}

