import { createConnection, Socket } from "net";
import { PDClasses } from "./PCClasses";
import { SDSConnection } from "./sds";
import { PDObject } from "./PDObject";

const socket = createConnection(11000, "127.0.0.1");
let sdsConnection: SDSConnection;
socket.on("connect", async () => {
    sdsConnection = new SDSConnection(socket);
    await sdsConnection.connect("test123");
    await sdsConnection.changeUser("admin", "");
    await sdsConnection.changePrincipal("test");

    let scriptOID = "259:15";
    let portalScript: PDObject;
    if (!scriptOID) {
        portalScript = await createPortalScript("node-sds-PortalScript");
        scriptOID = portalScript.oId;
    } else {
        portalScript = new PDObject(scriptOID, PDClasses.PortalScript, "PortalScript");
    }

    let sourceCode = "";
    console.time("GetSourcecode");
    for (let i = 0; i < 50000; i++) {
        // if ((i +1) % 1000 === 0) {
        //     console.log(`Iteration: ${i + 1}`);
        // }

        sourceCode = await sdsConnection.getAttributePDObject(portalScript, "SourceCode");
    }
    console.timeEnd("GetSourcecode");

    const length = sourceCode.length;
    const d = 0;
});

async function createPortalScript(name: string): Promise<PDObject> {
    const portalScript = await sdsConnection.createPDObject(PDClasses.PortalScript);
    console.log(`Created portal script: ${portalScript.oId}`);
    await sdsConnection.syncPDObject(portalScript);
    await sdsConnection.setAttributePDObject(portalScript, "Name", name);
    return portalScript;
}
