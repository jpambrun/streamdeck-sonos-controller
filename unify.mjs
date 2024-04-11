import { Controller, Client } from 'unifi-client';

const controller = new Controller({
    username: 'apiuser',
    password: process.env.UNIFI_PASSWORD,
    url: 'https://192.168.1.1',
    strictSSL: false
});

const clientFromMac = (site, mac) => new Client({ controller: site.getController(), site }, { mac });

const isaacDevices = [
    "78:dd:12:87:e7:22", //maybe play room tv
    "64:b5:c6:c1:33:cf", // nintendo switch
    "82:1a:ba:55:0a:2e", // tabletter maman
    "cc:60:c8:19:b6:eb", // xbox
    "c2:90:ae:7e:43:1c", // quest
]

async function isAnyIsaacDeviceBlocked(site) {
    site ||= await getSite();
    const allClient = await site.clients.list({ type: 'blocked' });
    return allClient.some(client => isaacDevices.includes(client.mac));
}

async function toggleIsaacDevices(site) {
    site ||= await getSite();
    if(await isAnyIsaacDeviceBlocked(site)) {
        console.log('Unblocking all devices');
        for (let i = 0; i < isaacDevices.length; i++) {
            const mac = isaacDevices[i];
            console.log(`unblocking '${mac}'`);
            await clientFromMac(site, mac).unblock();
        }
    } else {
        console.log('Blocking all devices');
        for (let i = 0; i < isaacDevices.length; i++) {
            const mac = isaacDevices[i];
            console.log(`blocking '${mac}'`);
            await clientFromMac(site, mac).block();
        }
    }
}

async function getSite() {
    await controller.login()
    const [site] = await controller.getSites();
    return site;
}

async function kickDevice(site, mac) {
    const client = clientFromMac(site, mac);
    const resp = await client.getInstance().post('/cmd/stamgr', {
        cmd: 'kick-sta',
        mac: client.mac.toLowerCase()
    })
    if (resp.status !== 200) throw new Error(`Failed to kick device ${mac}`);
}

async function unblockAllDevices(site) {
    site ||= await getSite();
    const allClient = await site.clients.list({ type: 'blocked' });
    for (let i = 0; i < allClient.length; i++) {
        const client = allClient[i];
        console.log(`unblocking '${client.mac}'`);
        await clientFromMac(site, client.mac).unblock();
    }
}

async function reconnectAllDevices(site) {
    site ||= await getSite();
    const allClient = await site.clients.list3();
    for (let i = 0; i < allClient.length; i++) {
        const client = allClient[i];
        if (client.isWired === false && client.mac !== 'b8:27:eb:02:8f:8c') {
            console.log(`reconnecting ${client.hostname || 'unknown'} from ${client.oui} with mac ${client.mac}`);
            await kickDevice(site, client.mac);
        }
    }
}

export { reconnectAllDevices, unblockAllDevices, kickDevice, getSite, toggleIsaacDevices, isAnyIsaacDeviceBlocked}
