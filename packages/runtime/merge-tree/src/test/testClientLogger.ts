/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISequencedDocumentMessage } from "@prague/container-definitions";
import * as assert from "assert";
import { IMergeTreeOp } from "../ops";
import { TestClient } from "./testClient";

export class TestClientLogger {
    private readonly incrementalLog = false;

    private readonly paddings: number[] = [];
    private readonly roundLogLines: string[][] = [];

    constructor(
        private readonly clients: TestClient[],
        private readonly title?: string) {

        this.roundLogLines.push([
            "seq",
            "op",
            ...this.clients.map((c) => `client ${c.longClientId}`),
        ]);

        this.roundLogLines[0].forEach((v) => this.paddings.push(v.length));
    }

    public log(msg?: ISequencedDocumentMessage, preAction?: (c: TestClient) => void) {
        const seq = msg ? msg.sequenceNumber.toString() : "";
        const opType = msg ? (msg.contents as IMergeTreeOp).type.toString() : "";
        const client = msg ? msg.clientId : "";
        const clientOp = `${client}${opType}`;
        const line: string[] = [
            seq,
            clientOp,
        ];
        this.paddings[0] = Math.max(line[0].length, this.paddings[0]);
        this.paddings[1] = Math.max(line[1].length, this.paddings[1]);
        this.roundLogLines.push(line);
        this.clients.forEach((c, i) => {
            if (preAction) {
                try {
                    preAction(c);
                } catch (e) {
                    // tslint:disable-next-line: no-unsafe-any
                    e.message += this.toString();
                    throw e;
                }
            }
            line.push(c.getText());
            this.paddings[i + 2] = Math.max(line[i + 2].length, this.paddings[i + 2]);
        });
        if (this.incrementalLog) {
            console.log(line.map((v, i) => v.padEnd(this.paddings[i])).join(" | "));
        }
    }

    public validate() {
        this.clients.forEach(
            (c) => assert.equal(
                c.getText(),
                this.clients[0].getText(),
                `Client ${c.longClientId} does not match client ${this.clients[0].longClientId}${this.toString()}`));
    }

    public toString() {
        let str = "\n";
        if (this.title) {
            str += `${this.title}\n`;
        }
        str += this.roundLogLines
            .map((line) => line.map((v, i) => v.padEnd(this.paddings[i])).join(" | "))
            .join("\n");

        return str;
    }
}