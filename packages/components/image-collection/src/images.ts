/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ComponentRuntime } from "@prague/component-runtime";
import {
    IComponent,
    IComponentHTMLViewable,
    IComponentRouter,
    IHTMLView,
    IRequest,
    IResponse,
    ISharedComponent,
} from "@prague/container-definitions";
import { ISharedMap, MapExtension } from "@prague/map";
import {
    ComponentDisplayType,
    IComponentCollection,
    IComponentContext,
    IComponentLayout,
    IComponentRenderHTML,
    IComponentRuntime,
} from "@prague/runtime-definitions";
import { ISharedObjectExtension } from "@prague/shared-object-common";
import { EventEmitter } from "events";

export class ImageComponent implements
    ISharedComponent, IComponentHTMLViewable, IComponentRouter, IComponentRenderHTML, IComponentLayout {
    public static supportedInterfaces = [
        "IComponentLoadable",
        "IComponentHTMLViewable",
        "IComponentLayout",
        "IComponentRouter",
        "IComponentRenderHTML"];

    private playerDiv: HTMLDivElement;

    // Video def has a preferred aspect ratio
    public aspectRatio?: number;
    public minimumWidthBlock?: number;
    public minimumHeightInline?: number;
    public readonly canInline = true;
    public readonly preferInline = false;

    constructor(public imageUrl: string, public url: string) {
    }

    public query(id: string): any {
        return ImageComponent.supportedInterfaces.indexOf(id) !== -1 ? this : undefined;
    }

    public list(): string[] {
        return ImageComponent.supportedInterfaces;
    }

    public async addView(host: IComponent, element: HTMLElement): Promise<IHTMLView> {
        this.render(element);

        return {
            remove: () => {
                this.playerDiv.remove();
            },
        };
    }

    public render(elm: HTMLElement, displayType?: ComponentDisplayType): void {
        const img = document.createElement("img");
        img.src = this.imageUrl;
        elm.appendChild(img);
    }

    public async request(request: IRequest): Promise<IResponse> {
        return {
            mimeType: "prague/component",
            status: 200,
            value: this,
        };
    }
}

export class ImageCollection extends EventEmitter implements
    ISharedComponent, IComponentRouter, IComponentCollection {

    public static supportedInterfaces = [
        "IComponentLoadable",
        "IComponentRouter",
        "IComponentCollection"];

    public static async load(runtime: IComponentRuntime, context: IComponentContext) {
        const collection = new ImageCollection(runtime, context);
        await collection.initialize();

        return collection;
    }

    public url: string;

    private images = new Map<string, ImageComponent>();
    private root: ISharedMap;

    constructor(private runtime: IComponentRuntime, context: IComponentContext) {
        super();

        this.url = context.id;
    }

    public query(id: string): any {
        return ImageCollection.supportedInterfaces.indexOf(id) !== -1 ? this : undefined;
    }

    public list(): string[] {
        return ImageCollection.supportedInterfaces;
    }

    public create(): ImageComponent {
        const id = `image-${Date.now()}`;
        this.root.set(id, "https://media.giphy.com/media/13V60VgE2ED7oc/giphy.gif");
        // Relying on valueChanged event to create the bar is error prone
        return this.images.get(id);
    }

     public remove(instance: IComponent): void {
        throw new Error("Method not implemented.");
    }

    public getProgress(): string[] {
        return Array.from(this.root.keys()).map((key) => `/${key}`);
    }

    public async request(request: IRequest): Promise<IResponse> {
        // TODO the request is not stripping / off the URL
        const trimmed = request.url
            .substr(1)
            .substr(0, request.url.indexOf("/", 1) === -1 ? request.url.length : request.url.indexOf("/"));

        if (!trimmed) {
            return {
                mimeType: "prague/component",
                status: 200,
                value: this,
            };
        }

        // TODO we need a way to return an observable for a request route (if asked for) to notice updates
        // or at least to request a value >= a sequence number
        await this.root.wait(trimmed);

        return this.images.get(trimmed).request({ url: trimmed.substr(1 + trimmed.length) });
    }

    private async initialize() {
        if (!this.runtime.existing) {
            this.root = this.runtime.createChannel("root", MapExtension.Type) as ISharedMap;
            this.root.attach();
        } else {
            this.root = await this.runtime.getChannel("root") as ISharedMap;
        }

        for (const key of this.root.keys()) {
            this.images.set(
                key,
                new ImageComponent(this.root.get(key), `${this.url}/${key}`));
        }

        this.root.on("valueChanged", (changed, local) => {
            if (this.images.has(changed.key)) {
                // TODO add support for video playback values
                // this.videoPlayers.get(changed.key).update(this.root.get(changed.key));
            } else {
                const player = new ImageComponent(
                    this.root.get(changed.key),
                    `${this.url}/${changed.key}`);
                this.images.set(changed.key, player);
            }
        });
    }
}

export async function instantiateComponent(context: IComponentContext): Promise<IComponentRuntime> {
    const dataTypes = new Map<string, ISharedObjectExtension>();
    dataTypes.set(MapExtension.Type, new MapExtension());

    const runtime = await ComponentRuntime.load(context, dataTypes);
    const progressCollectionP = ImageCollection.load(runtime, context);
    runtime.registerRequestHandler(async (request: IRequest) => {
        const progressCollection = await progressCollectionP;
        return progressCollection.request(request);
    });

    return runtime;
}