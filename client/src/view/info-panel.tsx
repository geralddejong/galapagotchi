import * as React from "react"
import {Carousel, CarouselControl, CarouselIndicators, CarouselItem} from "reactstrap"

import {INFO_PAGES} from "./info-pages"

export interface IInfoPanelState {
    activeIndex: number
}

export class InfoPanel extends React.Component<object, IInfoPanelState> {

    private animating = false

    constructor(props: object) {
        super(props)
        this.state = {
            activeIndex: 0,
        }
    }

    public render(): JSX.Element {
        const {activeIndex} = this.state
        const items = INFO_PAGES.map((pageContent: JSX.Element, index: number) => {
            return (
                <CarouselItem key={`page-${index}`}
                              onExiting={() => this.animating = true}
                              onExited={() => this.animating = false}>
                    <div key={`item-${index}`}>{pageContent}</div>
                </CarouselItem>
            )
        })
        return (
            <Carousel interval={30000}
                      activeIndex={activeIndex}
                      next={() => this.next()}
                      previous={() => this.previous()}>
                <CarouselIndicators items={items}
                                    activeIndex={activeIndex}
                                    onClickHandler={(index) => this.goToIndex(index)}/>
                {items}
                <CarouselControl direction="prev" directionText="Previous"
                                 onClickHandler={() => this.previous()}/>
                <CarouselControl direction="next" directionText="Next"
                                 onClickHandler={() => this.next()}/>
            </Carousel>
        )
    }

    private next(): void {
        if (!this.animating) {
            const nextIndex = this.state.activeIndex === INFO_PAGES.length - 1 ? 0 : this.state.activeIndex + 1
            this.setState({activeIndex: nextIndex})
        }
    }

    private previous(): void {
        if (!this.animating) {
            const nextIndex = this.state.activeIndex === 0 ? INFO_PAGES.length - 1 : this.state.activeIndex - 1
            this.setState({activeIndex: nextIndex})
        }
    }

    private goToIndex(index: number): void {
        if (!this.animating) {
            this.setState({activeIndex: index})
        }
    }
}
