/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IContainerContext, IRuntime } from "@prague/container-definitions";

export { FlowDocument } from "./document";
export { Editor } from "./editor";

export async function instantiateRuntime(context: IContainerContext): Promise<IRuntime> {
    const entry = await import(/* webpackChunkName: "runtime", webpackPreload: true */ "./runtime");
    return entry.instantiateRuntime(context);
}