import * as React from "react"
import {Button} from "reactstrap"
import {BehaviorSubject} from "rxjs/BehaviorSubject"
import {Subscription} from "rxjs/Subscription"
import {PerspectiveCamera} from "three"

import {IFabricExports} from "./body/fabric-exports"
import {createFabricKernel, FabricKernel} from "./body/fabric-kernel"
import {Physics} from "./body/physics"
import {INITIAL_JOINT_COUNT, MAX_POPULATION} from "./gotchi/evolution"
import {Island} from "./island/island"
import {IslandState} from "./island/island-state"
import {Surface} from "./island/spot"
import {LocalStorage} from "./storage/local-storage"
import {ActionsPanel} from "./view/actions-panel"
import {GotchiView} from "./view/gotchi-view"
import {InfoPanel} from "./view/info-panel"
import {OrbitDistance} from "./view/orbit"

interface IAppProps {
    fabricExports: IFabricExports
    storage: LocalStorage
}

export interface IAppState {
    orbitDistance: OrbitDistance
    islandState: IslandState
    width: number
    height: number
    left: number
    top: number
    infoPanel: boolean
}

function updateDimensions(): object {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        left: window.screenLeft,
        top: window.screenTop,
    }
}

function getInfoPanelMaximized(): boolean {
    return "true" === localStorage.getItem("InfoPanel.maximized")
}

function setInfoPanelMaximized(maximized: boolean): void {
    localStorage.setItem("InfoPanel.maximized", maximized ? "true" : "false")
}

class App extends React.Component<IAppProps, IAppState> {
    private subs: Subscription[] = []
    private perspectiveCamera: PerspectiveCamera
    private orbitDistanceSubject = new BehaviorSubject<OrbitDistance>(OrbitDistance.HELICOPTER)
    private physics: Physics
    private fabricKernel: FabricKernel

    constructor(props: IAppProps) {
        super(props)
        this.physics = new Physics(props.storage)
        this.physics.applyToFabric(props.fabricExports)
        this.fabricKernel = createFabricKernel(props.fabricExports, MAX_POPULATION, INITIAL_JOINT_COUNT)
        const island = new Island("rotterdam", this.fabricKernel, this.props.storage)
        this.state = {
            infoPanel: getInfoPanelMaximized(),
            orbitDistance: this.orbitDistanceSubject.getValue(),
            islandState: island.state,
            width: window.innerWidth,
            height: window.innerHeight,
            left: window.screenLeft,
            top: window.screenTop,
        }
        this.perspectiveCamera = new PerspectiveCamera(50, this.state.width / this.state.height, 1, 500000)
    }

    public componentDidMount(): void {
        window.addEventListener("resize", () => this.setState(updateDimensions))
        this.subs.push(this.orbitDistanceSubject.subscribe(orbitDistance => this.setState({orbitDistance})))
        this.subs.push(this.state.islandState.subject.subscribe(islandState => {
            const homeHexalot = islandState.homeHexalot
            if (homeHexalot) {
                const spotCenters = homeHexalot.spots.map(spot => spot.center)
                const surface = homeHexalot.spots.map(spot => spot.surface === Surface.Land)
                this.fabricKernel.setHexalot(spotCenters, surface)
                this.props.storage.loadJourney(homeHexalot, islandState.island)
                location.replace(`/#/${homeHexalot.id}`)
            } else {
                location.replace("/#/")
            }
            this.setState({islandState})
        }))
    }

    public componentWillUnmount(): void {
        window.removeEventListener("resize", () => this.setState(updateDimensions))
        this.subs.forEach(s => s.unsubscribe())
    }

    public render(): JSX.Element {
        return (
            <div className="everything">
                <GotchiView
                    perspectiveCamera={this.perspectiveCamera}
                    islandState={this.state.islandState}
                    width={this.state.width}
                    height={this.state.height}
                    left={this.state.left}
                    top={this.state.top}
                    orbitDistance={this.orbitDistanceSubject}
                />
                {!this.state.infoPanel ? (
                    <div className="info-panel-collapsed floating-panel">
                        <Button color="link" onClick={() => {
                            this.setState({infoPanel: true})
                            setInfoPanelMaximized(true)
                        }}>?</Button>
                    </div>
                ) : (
                    <div className="info-panel floating-panel">
                        <span>Galapagotchi</span>
                        <div className="info-title">
                            <div className="info-exit">
                                <Button onClick={() => {
                                    this.setState({infoPanel: false})
                                    setInfoPanelMaximized(false)
                                }}>X</Button>
                            </div>
                        </div>
                        <InfoPanel/>
                    </div>
                )}
                <div className="actions-panel-outer floating-panel">
                    <div className="actions-panel-inner">
                        <ActionsPanel
                            orbitDistance={this.orbitDistanceSubject}
                            islandState={this.state.islandState}
                            location={this.perspectiveCamera.position}
                        />
                    </div>
                </div>
            </div>
        )
    }
}

export default App
